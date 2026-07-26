/*
 * Recursively strips any object key starting with "$" or containing "."
 * from request input. Prevents NoSQL / MongoDB operator injection, e.g.
 * a client sending { "user_key": { "$ne": null } } to bypass a
 * License.findOne({ key: user_key }) check.
 */

function sanitizeValue(value) {

    if (Array.isArray(value)) {

        return value.map(sanitizeValue);

    }

    if (value && typeof value === "object" && !(value instanceof Date)) {

        const clean = {};

        for (const [key, val] of Object.entries(value)) {

            if (key.startsWith("$") || key.includes(".")) {

                continue;

            }

            clean[key] = sanitizeValue(val);

        }

        return clean;

    }

    return value;

}

function sanitizeInPlace(target) {

    if (!target || typeof target !== "object") {

        return;

    }

    for (const key of Object.keys(target)) {

        if (key.startsWith("$") || key.includes(".")) {

            delete target[key];

            continue;

        }

        target[key] = sanitizeValue(target[key]);

    }

}

function sanitizeInput(req, res, next) {

    try {

        sanitizeInPlace(req.body);
        sanitizeInPlace(req.params);

        next();

    }

    catch (error) {

        console.error(error);

        next();

    }

}

module.exports = sanitizeInput;
