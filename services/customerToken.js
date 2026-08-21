const jwt = require("jsonwebtoken");

function generateCustomerToken(customer) {

    return jwt.sign(

        {
            id: customer._id,
            username: customer.username,
            sessionVersion: customer.sessionVersion,
            scope: "customer"
        },

        process.env.JWT_SECRET,

        {
            // Customer token stays valid for a week at a time - they are
            // not high-privilege admin sessions, so a long-lived login
            // is a reasonable trade-off for a smoother experience.
            expiresIn: "7d"
        }

    );

}

module.exports = generateCustomerToken;
