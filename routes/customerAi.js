const express = require("express");
const router = express.Router();

const customerAuth = require("../middleware/customerAuth");
const {
    handleChat,
    handleConfirm,
    handleCancel,
    handleHistory,
    handleClear
} = require("../controllers/customerAiController");

router.use(customerAuth);

router.post("/chat", handleChat);
router.post("/confirm", handleConfirm);
router.post("/cancel", handleCancel);
router.get("/history", handleHistory);
router.post("/clear", handleClear);

module.exports = router;
