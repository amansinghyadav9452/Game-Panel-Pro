const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");

async function createAdmin() {

const username = "bhukha_cheeta01";

const exists = await Admin.findOne({ username });

    if (exists) {
        console.log("✅ Admin already exists");
        return;
    }

    const hashedPassword = await bcrypt.hash("ta@lib@@swati##", 10);

await Admin.create({

    username,

    password: hashedPassword

});

    console.log("✅ Default Admin Created");

}

module.exports = createAdmin;