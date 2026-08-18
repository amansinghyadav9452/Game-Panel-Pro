const bcrypt = require("bcrypt");
const crypto = require("crypto");
const Admin = require("../models/Admin");

// Default admin credentials must never be hardcoded in source — this repo
// is public, so a hardcoded username/password here is effectively a leaked
// secret. Both are read from the environment instead. If no password is
// supplied, a random one is generated and printed once so it can be
// captured and rotated immediately.
async function createAdmin() {

    const username = process.env.DEFAULT_ADMIN_USERNAME;

    if (!username) {

        console.warn(
            "⚠️  DEFAULT_ADMIN_USERNAME not set — skipping default admin creation."
        );

        return;

    }

    const exists = await Admin.findOne({
        username
    });

    if (exists) {

        console.log("✅ Admin already exists");

        return;

    }

    let password = process.env.DEFAULT_ADMIN_PASSWORD;
    let generated = false;

    if (!password) {

        password = crypto.randomBytes(18).toString("base64url");
        generated = true;

    }

    const hashedPassword =
        await bcrypt.hash(password, 12);

await Admin.create({

    username,

    password: hashedPassword,

    sessionVersion:0

});

    console.log("✅ Default Admin Created");

    if (generated) {

        console.warn(
            "⚠️  DEFAULT_ADMIN_PASSWORD was not set. A random password was generated:\n" +
            `    Username: ${username}\n` +
            `    Password: ${password}\n` +
            "    Log in and change this password immediately — it will not be shown again."
        );

    }

}

module.exports = createAdmin;