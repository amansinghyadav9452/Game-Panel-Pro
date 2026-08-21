const jwt = require("jsonwebtoken");
const Customer = require("../models/Customer");

async function customerAuth(req, res, next) {

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

        if (decoded.scope !== "customer") {

            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });

        }

        const customer = await Customer.findById(decoded.id);

        if (!customer) {

            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });

        }

        if (decoded.sessionVersion !== customer.sessionVersion) {

            return res.status(401).json({
                success: false,
                message: "Session expired. Please login again."
            });

        }

        if (customer.status === "disabled") {

            return res.status(403).json({
                success: false,
                message: "Your account has been disabled by admin."
            });

        }

        if (customer.expiryAt <= new Date()) {

            return res.status(403).json({
                success: false,
                message: "Your referral access has expired. Contact admin for a new code."
            });

        }

        req.customer = customer;

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

module.exports = customerAuth;
