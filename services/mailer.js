async function sendOtpEmail(to, otp) {

    var htmlBody =
        '<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;">' +
        '<h2 style="margin-bottom:4px;">Verification Code</h2>' +
        '<p style="color:#555;">Use the code below to continue. It expires in 5 minutes.</p>' +
        '<p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#2563eb;margin:20px 0;">' +
        otp +
        '</p>' +
        '<p style="color:#888;font-size:13px;">If you did not request this code, you can safely ignore this email.</p>' +
        '</div>';

    var response = await fetch("https://api.resend.com/emails", {

        method: "POST",

        headers: {

            "Content-Type": "application/json",

            Authorization: "Bearer " + process.env.RESEND_API_KEY

        },

        body: JSON.stringify({

            from: process.env.RESEND_FROM_EMAIL || "Game Panel <onboarding@resend.dev>",

            to: to,

            subject: "Your Game Panel Verification Code",

            html: htmlBody

        })

    });

    if (!response.ok) {

        var errorData = await response.json().catch(function () {

            return {};

        });

        console.error("Resend error:", errorData);

        throw new Error(

            errorData.message || "Failed to send verification email."

        );

    }

}

module.exports = { sendOtpEmail: sendOtpEmail };