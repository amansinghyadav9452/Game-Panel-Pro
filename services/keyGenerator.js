const crypto = require("crypto");

const UPPER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const MIXED_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateKey(type, settings) {

    const prefix = type === "premium" ? "PREM" : "PUB";

    const length =
        settings && Number.isFinite(Number(settings.licenseLength))
            ? Math.min(32, Math.max(6, Number(settings.licenseLength)))
            : 16;

    const autoUppercase =
        settings ? settings.autoUppercase !== false : true;

    const alphabet = autoUppercase ? UPPER_ALPHABET : MIXED_ALPHABET;

    let random = "";

    for (let i = 0; i < length; i++) {

        random += alphabet[crypto.randomInt(0, alphabet.length)];

    }

    return `${prefix}-${random}`;

}

module.exports = generateKey;
