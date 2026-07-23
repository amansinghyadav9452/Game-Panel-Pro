const multer = require("multer");

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

    storage: multer.memoryStorage(),

    fileFilter,

    limits: {

        fileSize: 2 * 1024 * 1024

    }

});