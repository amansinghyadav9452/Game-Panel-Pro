/*module.exports = {

    rpName: "GAME PANEL",

    rpID: "premium-game-panel.onrender.com",

    origin: "https://premium-game-panel.onrender.com"

};*/

module.exports = {

    rpName: process.env.WEBAUTHN_RP_NAME,

    rpID: process.env.WEBAUTHN_RP_ID,

    origin: process.env.WEBAUTHN_ORIGIN

};