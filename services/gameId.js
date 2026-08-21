const crypto = require("crypto");

const GameApplication = require("../models/GameApplication");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomGameId() {
    let value = "";
    for (let i = 0; i < 16; i++) {
        value += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
    }
    return `GME-${value}`;
}

async function generateUniqueGameId() {
    for (let i = 0; i < 10; i++) {
        const gameId = randomGameId();
        if (!(await GameApplication.exists({ gameId }))) return gameId;
    }
    throw new Error("Unable to generate a unique Game ID.");
}

module.exports = { generateUniqueGameId };
