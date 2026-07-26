// Replicates the client's XOR-based "encryptAES" / simple-hash signature
// scheme (see Main.cpp's encryptAES/decryptAES/simpleHash/generateSignature)
// byte-for-byte, so the server can talk to game builds that wrap /connect
// requests in an encrypted envelope instead of sending plain fields.
//
// NOTE: despite the name, this is NOT real AES - it's a repeating-key XOR
// cipher followed by base64. It's fully reversible and the key is embedded
// in plaintext in the client binary, so this is not meant to be "secure",
// only compatible with what that specific client already does.

function xorBytes(buf, key) {

    const keyBuf = Buffer.from(key, "utf8");
    const out = Buffer.alloc(buf.length);

    for (let i = 0; i < buf.length; i++) {

        out[i] = buf[i] ^ keyBuf[i % keyBuf.length];

    }

    return out;

}

// Mirrors: std::string encryptAES(const std::string& d, const std::string& k)
function encryptAES(plainText, key) {

    const plainBuf = Buffer.from(plainText, "utf8");

    return xorBytes(plainBuf, key).toString("base64");

}

// Mirrors: std::string decryptAES(const std::string& e, const std::string& k)
function decryptAES(cipherBase64, key) {

    const cipherBuf = Buffer.from(cipherBase64, "base64");

    return xorBytes(cipherBuf, key).toString("utf8");

}

// Mirrors: std::string simpleHash(const std::string& in) - a DJB2 variant
// using unsigned 32-bit wraparound, formatted as a zero-padded 16-char hex string.
function simpleHash(input) {

    let h = 5381;

    for (let i = 0; i < input.length; i++) {

        const c = input.charCodeAt(i) & 0xFF;

        h = (h * 33 + c) >>> 0;

    }

    return h.toString(16).padStart(16, "0");

}

// Mirrors: std::string generateSignature(const std::string& d, long long t, const std::string& k)
function generateSignature(dataString, timestamp, key) {

    return simpleHash(`${dataString}|${timestamp}|${key}`);

}

module.exports = {

    encryptAES,

    decryptAES,

    generateSignature

};
