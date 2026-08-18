const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Session = require("../models/Session");

async function auth(req, res, next) {

const header = req.headers.authorization;

if (!header || !header.startsWith("Bearer ")) {

    return res.status(401).json({

        success: false,

        message: "Authorization token missing."

    });

}

    try {

        const token = header.substring(7);

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const admin = await Admin.findById(decoded.id);

if (!admin) {

    return res.status(401).json({

        success:false,

        message:"Unauthorized"

    });

}

if (decoded.sessionVersion !== admin.sessionVersion) {

    return res.status(401).json({

        success:false,

        message:"Session expired. Please login again."

    });

}

// Developer role sirf Messenger ke liye hai - admin panel ke kisi bhi
// route (dashboard, settings, logs, keys, banned devices, AI, etc.)
// tak iski pahuch nahi honi chahiye.
if (admin.role === "developer") {

    return res.status(403).json({

        success:false,

        message:"Developers only have access to Messenger."

    });

}

if (decoded.sessionId) {

    const session = await Session.findOne({

        sessionId: decoded.sessionId,

        adminId: admin._id

    });

    if (!session) {

        return res.status(401).json({

            success:false,

            message:"Session expired. Please login again."

        });

    }

    session.lastActiveAt = new Date();

    session.save().catch(() => {});

    req.sessionId = decoded.sessionId;

}

req.admin = admin;

next();

} catch (err) {

    if (err.name === "TokenExpiredError") {

        return res.status(401).json({

            success: false,

            message: "Session expired. Please login again."

        });

    }

    if (err.name === "JsonWebTokenError") {

        return res.status(401).json({

            success: false,

            message: "Invalid authentication token."

        });

    }

    console.error(err);

    return res.status(500).json({

        success: false,

        message: "Authentication failed."

    });

}

}

module.exports = auth;