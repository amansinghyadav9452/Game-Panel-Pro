const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");

async function createAdmin() {

    const exists = await Admin.findOne({
        username: "admin"
    });

    if (exists) {
        console.log("✅ Admin already exists");
        return;
    }

    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    await Admin.create({

        username: "admin",

        password: hashedPassword

    });

    console.log("✅ Default Admin Created");

}

module.exports = createAdmin;