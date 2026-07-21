const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({

    destination(req, file, cb) {

        cb(null, "public/uploads/profile");

    },

    filename(req, file, cb) {

        const ext = path.extname(file.originalname);

        cb(null, `admin-${Date.now()}${ext}`);

    }

});

const fileFilter = (req, file, cb) => {

    const allowed = [

        "image/png",

        "image/jpeg",

        "image/jpg",

        "image/webp"

    ];

    if (allowed.includes(file.mimetype)) {

        cb(null, true);

    } else {

        cb(new Error("Only PNG, JPG and WEBP images are allowed"));

    }

};

module.exports = multer({

    storage,

    fileFilter,

    limits: {

        fileSize: 2 * 1024 * 1024

    }

});