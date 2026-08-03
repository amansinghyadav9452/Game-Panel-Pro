const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const {
    handleChat,
    handleConfirm,
    handleCancel,
    handleHistory,
    handleClear
} = require("../controllers/aiController");

router.use(auth);

router.post("/chat", handleChat);
router.post("/confirm", handleConfirm);
router.post("/cancel", handleCancel);
router.get("/history", handleHistory);
router.post("/clear", handleClear);

module.exports = router;
