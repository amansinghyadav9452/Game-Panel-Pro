require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./config/database");
const createAdmin = require("./services/createAdmin");
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const publicRoutes = require("./routes/public");
const connectRoutes = require("./routes/connect");
const errorHandler = require("./middleware/errorHandler");
const rateLimiter = require("./middleware/rateLimiter");
const activityRoutes = require("./routes/activity");
const premiumRoutes = require("./routes/premium");
const settingsRoutes = require("./routes/settings");
const createSettings = require("./services/createSettings");


const app = express();
app.set("view engine","ejs");
app.set("views","./views/pages");
app.use(express.static("public"));

connectDB().then(async () => {
    await createAdmin();
    await createSettings();
});

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors());
app.use(rateLimiter);

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                scriptSrc: [
                    "'self'",
                    "https://challenges.cloudflare.com"
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
                ]
            }
        }
    })
);

app.use(morgan("dev"));
app.use(authRoutes);
app.use(dashboardRoutes);
app.use(publicRoutes);
app.use(connectRoutes);

app.use(activityRoutes);
app.use(premiumRoutes);
app.use("/settings", settingsRoutes);

app.use(errorHandler);
app.get("/", (req, res) => {
    res.redirect("/login");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});