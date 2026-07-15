const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

async function auth(req, res, next) {

    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({
            success: false,
            message: "Access Denied"
        });
    }

    try {

        const token = header.split(" ")[1];

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

        req.admin = decoded;

        next();

    } catch (err) {

        return res.status(401).json({
            success: false,
            message: "Invalid Token"
        });

    }

}

module.exports = auth;