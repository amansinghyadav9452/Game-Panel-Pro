const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");

async function createAdmin() {

    const username = "bhukha_cheeta01";

    const password = "ta@lib@swati##";

    const exists = await Admin.findOne({
        username
    });

    if (exists) {

        console.log("✅ Admin already exists");

        return;

    }

    const hashedPassword =
        await bcrypt.hash(password, 12);

await Admin.create({

    username,

    password: hashedPassword,

    sessionVersion:0

});

    console.log("✅ Default Admin Created");

}

module.exports = createAdmin;