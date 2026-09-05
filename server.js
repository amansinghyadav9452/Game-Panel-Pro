require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./config/database");
const createAdmin = require("./services/createAdmin");
const deleteExpiredLicenses = require("./services/licenseCleanup");
const { bulkSyncLicenseStatuses } = require("./services/licenseService");
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const webauthnRoutes = require("./routes/webauthn");
const publicRoutes = require("./routes/public");
const connectRoutes = require("./routes/connect");
const errorHandler = require("./middleware/errorHandler");
const rateLimiter = require("./middleware/rateLimiter");
const connectRateLimiter = require("./middleware/connectRateLimiter");
const sanitizeInput = require("./middleware/sanitizeInput");
const activityRoutes = require("./routes/activity");
const premiumRoutes = require("./routes/premium");
const settingsRoutes = require("./routes/settings");
const logsRoutes = require("./routes/logs");
const createSettings = require("./services/createSettings");
const bannedDeviceRoutes = require("./routes/bannedDevices");
const aiRoutes = require("./routes/ai");
const customerAiRoutes = require("./routes/customerAi");
const aiRateLimiter = require("./middleware/aiRateLimiter");
const messengerRoutes = require("./routes/messenger");
const referralRoutes = require("./routes/referral");
const customerRoutes = require("./routes/customer");
const registerDevChat = require("./sockets/devChat");
const ensureGameApplicationSetup = require("./services/gameApplicationSetup");
const gameApplicationRoutes = require("./routes/gameApplications");
const pushRoutes = require("./routes/push");

const fs = require("fs");
const path = require("path");

const app = express();
app.set("trust proxy", 1);
app.set("view engine","ejs");
app.set("views","./views/pages");

// Service worker version = server process ke boot ka timestamp. Har
// deploy/restart pe yeh khud badal jaata hai, isliye purana service-
// worker cache automatically invalid ho jaata hai aur naya push turant
// sabke panel pe reflect hota hai - kisi ko manually browsing data
// clear karne ki zaroorat nahi. (Agar future me multiple server
// instances/cluster mode use karoge, isko ek fixed build id/commit
// hash se replace kar dena taaki sabhi instances same version bheje.)
const SW_VERSION = Date.now().toString();

app.get("/sw.js", (req, res) => {

    fs.readFile(path.join(__dirname, "public", "sw.js"), "utf8", (err, content) => {

        if (err) {
            return res.status(500).end();
        }

        const versioned = content.replace(/__SW_VERSION__/g, SW_VERSION);

        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Service-Worker-Allowed", "/");

        res.send(versioned);

    });

});

app.use(express.static("public", {

    etag: true,

    lastModified: true,

    setHeaders: (res, filePath) => {

        if (filePath.endsWith(".css") || filePath.endsWith(".js")) {

            // Was "no-cache", which forces a revalidation round-trip for
            // every CSS/JS file on every single page load. A short
            // max-age lets the browser reuse the file instantly while
            // still picking up changes within a minute of a deploy.
            res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");

        }

    }

}));

connectDB().then(async () => {
    await createAdmin();
    await createSettings();
    await ensureGameApplicationSetup();

    // Background maintenance: used to run inline on every dashboard/
    // public/premium list request (that's what made pages slow). Now it
    // runs on its own schedule instead, so page loads never wait on it.
    const runLicenseMaintenance = () => {
        bulkSyncLicenseStatuses().catch((err) =>
            console.error("License status sync failed:", err)
        );
        deleteExpiredLicenses().catch((err) =>
            console.error("Expired license cleanup failed:", err)
        );
    };

    runLicenseMaintenance();
    setInterval(runLicenseMaintenance, 15 * 60 * 1000); // every 15 minutes
});

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(sanitizeInput);

const allowedOrigins = (
    process.env.CORS_ORIGINS ||
    process.env.WEBAUTHN_ORIGIN ||
    ""
)
    .split(",")
    .map(o => o.trim())
    .filter(Boolean);

app.use(
    cors({

        origin: (origin, callback) => {

            if (!origin) {

                return callback(null, true);

            }

            if (allowedOrigins.includes(origin)) {

                return callback(null, true);

            }

            return callback(new Error("Not allowed by CORS"));

        },

        credentials: true

    })
);

const server = http.createServer(app);

const io = new Server(server, {

    cors: {
        origin: allowedOrigins.length ? allowedOrigins : true,
        credentials: true
    }

});

registerDevChat(io);

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                scriptSrc: [
                    "'self'",
                    "https://challenges.cloudflare.com",
                    "https://cdnjs.cloudflare.com"
                ],

                frameSrc: [
                    "'self'",
                    "https://challenges.cloudflare.com"
                ],

                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://fonts.googleapis.com",
                    "https://cdnjs.cloudflare.com"
                ],

                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com",
                    "https://cdnjs.cloudflare.com"
                ],

                connectSrc: [
                    "'self'",
                    "ws:",
                    "wss:"
                ],
                                imgSrc: [

                    "'self'",

                    "data:",

                    "https://res.cloudinary.com",
                    "https://c.ndtvimg.com",
                    "https://tse1.mm.bing.net"

                ],
            }
        }
    })
);


// Same-origin device-visual renderer. Product images are fetched server-side so
// the browser never needs to talk to third-party image hosts directly. The SVG
// keeps the asset transparent and uses a soft fade instead of a hard image box.
const deviceVisualCache = new Map();
const DEVICE_VISUAL_HOSTS = new Set(["c.ndtvimg.com", "tse1.mm.bing.net", "cdn.beebom.com", "infinixmobiles.in"]);

app.get("/logs/device-visual", async (req, res) => {
    try {
        const raw = String(req.query.src || "").trim();
        const mode = String(req.query.mode || "dark") === "light" ? "light" : "dark";
        if (!raw) return res.status(400).end();
        const target = new URL(raw);
        if (!DEVICE_VISUAL_HOSTS.has(target.hostname) || !/^https?:$/.test(target.protocol)) {
            return res.status(403).end();
        }

        const cacheKey = target.toString();
        let payload = deviceVisualCache.get(cacheKey);
        if (!payload) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 7000);
            try {
                const response = await fetch(target, {
                    signal: controller.signal,
                    headers: {"User-Agent":"GamePanelPro/1.0 device-visual"}
                });
                if (!response.ok) return res.status(404).end();
                const contentType = String(response.headers.get("content-type") || "image/jpeg").split(";")[0];
                if (!contentType.startsWith("image/")) return res.status(415).end();
                const bytes = Buffer.from(await response.arrayBuffer());
                if (bytes.length > 4 * 1024 * 1024) return res.status(413).end();
                payload = { mime: contentType, data: bytes.toString("base64") };
                deviceVisualCache.set(cacheKey, payload);
                if (deviceVisualCache.size > 80) deviceVisualCache.delete(deviceVisualCache.keys().next().value);
            } finally {
                clearTimeout(timer);
            }
        }

        const needsWhiteKey = target.hostname === "tse1.mm.bing.net" || target.hostname === "infinixmobiles.in";
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="520" viewBox="0 0 760 520">
  <defs>
    <filter id="whiteKey" x="-15%" y="-15%" width="130%" height="140%" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -0.55 -0.55 -0.55 0 1.15"/>
    </filter>
    <filter id="shadow" x="-60%" y="-60%" width="220%" height="240%">
      <feGaussianBlur stdDeviation="13"/>
    </filter>
  </defs>
  <ellipse cx="555" cy="458" rx="132" ry="22" fill="#000" opacity=".55" filter="url(#shadow)"/>
  <g transform="translate(292 12) rotate(4) skewY(-2)">
    <image href="data:${payload.mime};base64,${payload.data}" x="0" y="0" width="410" height="448" preserveAspectRatio="xMidYMid meet" ${needsWhiteKey ? 'filter="url(#whiteKey)"' : ''}/>
  </g>
</svg>`;
        res.set("Content-Type", "image/svg+xml");
        res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        return res.send(svg);
    } catch (_) {
        return res.status(404).end();
    }
});

app.use(morgan("dev"));
app.use(rateLimiter, authRoutes);
app.use(rateLimiter, dashboardRoutes);
app.use("/api/webauthn", rateLimiter, webauthnRoutes);
app.use(rateLimiter, publicRoutes);
app.use(connectRateLimiter, connectRoutes);

app.use(rateLimiter, activityRoutes);
app.use(rateLimiter, premiumRoutes);
app.use("/settings", rateLimiter, settingsRoutes);
app.use("/logs", rateLimiter, logsRoutes);
app.use("/api/banned-devices", rateLimiter, bannedDeviceRoutes);
app.use("/api/ai", aiRateLimiter, aiRoutes);
app.use("/api/customer-ai", aiRateLimiter, customerAiRoutes);
app.use(rateLimiter, messengerRoutes);
app.use(rateLimiter, referralRoutes);
app.use("/api/game-apps", rateLimiter, gameApplicationRoutes);
app.use(rateLimiter, customerRoutes);
app.use(rateLimiter, pushRoutes);

app.use(errorHandler);
app.get("/", (req, res) => {
    res.redirect("/login");
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});