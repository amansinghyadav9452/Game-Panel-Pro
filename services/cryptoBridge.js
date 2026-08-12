function xorBytes(buf, key) {

    const keyBuf = Buffer.from(key, "utf8");
    const out = Buffer.alloc(buf.length);

    for (let i = 0; i < buf.length; i++) {

        out[i] = buf[i] ^ keyBuf[i % keyBuf.length];

    }

    return out;

}

function encryptAES(plainText, key) {

    const plainBuf = Buffer.from(plainText, "utf8");

    return xorBytes(plainBuf, key).toString("base64");

}

function decryptAES(cipherBase64, key) {

    const cipherBuf = Buffer.from(cipherBase64, "base64");

    return xorBytes(cipherBuf, key).toString("utf8");

}

function simpleHash(input) {

    let h = 5381;

    for (let i = 0; i < input.length; i++) {

        const c = input.charCodeAt(i) & 0xFF;

        h = (h * 33 + c) >>> 0;

    }

    return h.toString(16).padStart(16, "0");

}

function generateSignature(dataString, timestamp, key) {

    return simpleHash(`${dataString}|${timestamp}|${key}`);

}

module.exports = {

    encryptAES,

    decryptAES,

    generateSignature

};
