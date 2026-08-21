const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Customer = require("../models/Customer");

// Same JWT check as middleware/auth.js, but does NOT block the
// "developer" role - Messenger is the one place both admin and
// developer are allowed in. Customers (scope:"customer") are also
// allowed here, since they get their own thread with the developer.
async function messengerAuth(req, res, next) {

    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {

        return res.status(401).json({
            success: false,
            message: "Authorization token missing."
        });

    }

    try {

        const token = header.substring(7);

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.scope === "customer") {

            const customer = await Customer.findById(decoded.id);

            if (!customer || decoded.sessionVersion !== customer.sessionVersion) {

                return res.status(401).json({
                    success: false,
                    message: "Unauthorized"
                });

            }

            if (customer.status === "disabled" || customer.expiryAt <= new Date()) {

                return res.status(403).json({
                    success: false,
                    message: "Unauthorized"
                });

            }

            req.customer = customer;
            req.role = "customer";

            return next();

        }

        const admin = await Admin.findById(decoded.id);

        if (!admin) {

            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });

        }

        if (decoded.sessionVersion !== admin.sessionVersion) {

            return res.status(401).json({
                success: false,
                message: "Session expired. Please login again."
            });

        }

        if (admin.role !== "admin" && admin.role !== "developer") {

            return res.status(403).json({
                success: false,
                message: "Unauthorized"
            });

        }

        req.admin = admin;
        req.role = admin.role;

        next();

    }

    catch (err) {

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

module.exports = messengerAuth;
