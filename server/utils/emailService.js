const nodemailer = require("nodemailer");

// Create reusable Nodemailer transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "spendwise.global@gmail.com",
    pass: (process.env.EMAIL_PASS || "ppxzjudaxxzdmfap").replace(/\s+/g, ""),
  },
});

/**
 * Build rich HTML email template matching SpendWise's ledger aesthetic
 */
function buildOtpEmailHtml({ otp, purpose, name }) {
  let title = "Verification Code";
  let explanation = "Use the one-time code below to complete your verification:";

  if (purpose === "reset_password") {
    title = "Password Reset Request";
    explanation =
      "We received a request to reset your SpendWise account password. Use this code to proceed:";
  } else if (purpose === "login") {
    title = "One-Time Login Code";
    explanation =
      "Use this secure code to sign in to your SpendWise account without a password:";
  } else if (purpose === "verify_email") {
    title = "Confirm Your Email";
    explanation =
      "Please enter the code below to verify your email address on SpendWise:";
  }

  const greeting = name ? `Hello ${name},` : "Hello,";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SpendWise Security Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d1821; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0d1821; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #fcfbf9; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #111b24; padding: 28px 32px; text-align: center; border-bottom: 2px solid #2d5a27;">
              <h1 style="margin: 0; color: #f7f4ec; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">SpendWise</h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Track Smarter · Financial Ledger</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 12px 0; color: #0d1821; font-size: 20px; font-weight: 600;">${title}</h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #334155;">${greeting}</p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #475569;">${explanation}</p>

              <!-- OTP Display Box -->
              <div style="background-color: #f1f8f3; border: 1.5px dashed #2d5a27; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 10px; color: #1e3f20; display: inline-block; padding-left: 10px;">
                  ${otp}
                </span>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #2d5a27; font-weight: 500;">
                  Valid for 10 minutes
                </p>
              </div>

              <!-- Security Warning -->
              <div style="background-color: #f8fafc; border-left: 3px solid #cbd5e1; padding: 12px 14px; margin: 20px 0 0 0;">
                <p style="margin: 0; font-size: 12px; line-height: 1.4; color: #64748b;">
                  <strong>Security Note:</strong> SpendWise will never ask you to share your OTP code. If you did not initiate this request, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 18px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                © ${new Date().getFullYear()} SpendWise Inc. All rights reserved.
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                Sent to you by spendwise.global@gmail.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Send an OTP code to a recipient email
 */
async function sendOtpEmail({ to, otp, purpose = "reset_password", name = "" }) {
  const subjectMap = {
    reset_password: `Your SpendWise Password Reset Code: ${otp}`,
    login: `Your SpendWise Login Code: ${otp}`,
    verify_email: `Verify your SpendWise Email: ${otp}`,
  };

  const mailOptions = {
    from: `"SpendWise" <${process.env.EMAIL_USER || "spendwise.global@gmail.com"}>`,
    to,
    subject: subjectMap[purpose] || `SpendWise Security Code: ${otp}`,
    text: `Your SpendWise verification code is: ${otp}. This code is valid for 10 minutes. If you did not request this code, please ignore this email.`,
    html: buildOtpEmailHtml({ otp, purpose, name }),
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Verify transporter connectivity
 */
async function verifyEmailService() {
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  transporter,
  sendOtpEmail,
  verifyEmailService,
};
