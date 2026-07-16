// module.exports = {

//     rpName: "GAME PANEL",

//     rpID: "localhost",

//     origin: "http://localhost:3000"

// };

module.exports = {

    rpName: process.env.WEBAUTHN_RP_NAME,

    rpID: process.env.WEBAUTHN_RP_ID,

    origin: process.env.WEBAUTHN_ORIGIN

};