const jwt = require("jsonwebtoken");

function generateToken(admin) {

    return jwt.sign(

        {
            id: admin._id,
            username: admin.username,
            role: admin.role
        },

        process.env.JWT_SECRET,

        {
            expiresIn: "7d"
        }

    );

}

module.exports = generateToken;