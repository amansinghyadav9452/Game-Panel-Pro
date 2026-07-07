const express = require("express");
const bcrypt = require("bcrypt");

const Admin = require("../models/Admin");
const generateToken = require("../services/tokenGenerator");

const router = express.Router();

router.post("/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        const admin = await Admin.findOne({ username });

        if (!admin) {

            return res.json({

                success: false,

                message: "Invalid Username or Password"

            });

        }

        const match = await bcrypt.compare(

            password,

            admin.password

        );

        if (!match) {

            return res.json({

                success: false,

                message: "Invalid Username or Password"

            });

        }

        const token = generateToken(admin);

        res.json({

            success: true,

            token

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

module.exports = router;