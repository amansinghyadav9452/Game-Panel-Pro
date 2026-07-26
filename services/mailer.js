const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({

    service: "gmail",

    auth: {

        user: process.env.GMAIL_USER,

        pass: process.env.GMAIL_APP_PASSWORD

    }

});

async function sendOtpEmail(to, otp) {

    await transporter.sendMail({

        from: `"Game Panel" <${process.env.GMAIL_USER}>`,

        to,

        subject: "Your Game Panel Verification Code",

        html: `
            <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;">
                <h2 style="margin-bottom:4px;">Verification Code</h2>
                <p style="color:#555;">Use the code below to continue. It expires in 5 minutes.</p>
                <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#2563eb;margin:20px 0;">
                    ${otp}
                </p>
                <p style="color:#888;font-size:13px;">
                    If you did not request this code, you can safely ignore this email.
                </p>
            </div>
        `

    });

}

module.exports = { sendOtpEmail };
