const { nanoid } = require("nanoid");

function generateKey(type) {

    const prefix =
        type === "premium"
        ? "PREM"
        : "PUB";

    return `${prefix}-${nanoid(12).toUpperCase()}`;
}

module.exports = generateKey;