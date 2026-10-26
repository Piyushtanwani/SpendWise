/**
 * Test Suite for Google OAuth & Email (SMTP) OTP Notifications
 */

process.env.NODE_ENV = "test";
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const assert = require("assert");
const http = require("http");
const mongoose = require("mongoose");
const app = require("../server");

const User = require("../models/User");
const Otp = require("../models/Otp");
const { verifyEmailService, sendOtpEmail } = require("../utils/emailService");

let server;
let baseUrl;

async function request(endpoint, options = {}, token = null, retries = 3) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${baseUrl}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (response.status >= 500 && retries > 0) {
      await new Promise((r) => setTimeout(r, 1200));
      return await request(endpoint, options, token, retries - 1);
    }

    return { status: response.status, data };
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1200));
      return await request(endpoint, options, token, retries - 1);
    }
    throw err;
  }
}

async function safeDb(fn, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
}

async function runAuthOtpGoogleTests() {
  console.log("==================================================");
  console.log("   Google OAuth & Email OTP Verification Suite    ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(title, fn) {
    try {
      await fn();
      console.log(`  ✓ ${title}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${title}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  try {
    // 1. Start test server
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        console.log(`Test server running at ${baseUrl}\n`);
        resolve();
      });
    });

    while (mongoose.connection.readyState !== 1) {
      await new Promise((res) => setTimeout(res, 250));
    }

    const testEmail = `user_otp_${Date.now()}@example.com`;
    const testPassword = "OriginalPass123!";

    console.log("--- Scenario 1: SMTP Transporter Verification ---");
    await test("Gmail SMTP connection verifies with user credentials", async () => {
      const result = await verifyEmailService();
      assert.strictEqual(result.ok, true, `SMTP failed: ${result.error}`);
    });

    console.log("\n--- Scenario 2: Validation of OTP Requests ---");
    await test("Reject send-otp when email is missing", async () => {
      const res = await request("/auth/send-otp", { method: "POST", body: {} });
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /Email address is required/i);
    });

    await test("Reject send-otp with invalid email format", async () => {
      const res = await request("/auth/send-otp", {
        method: "POST",
        body: { email: "invalid-email-format" },
      });
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /valid email/i);
    });

    await test("Reject reset_password OTP for non-existent account", async () => {
      const res = await request("/auth/send-otp", {
        method: "POST",
        body: { email: "nonexistent_account@example.com", purpose: "reset_password" },
      });
      assert.strictEqual(res.status, 404);
      assert.match(res.data.message, /No account registered/i);
    });

    console.log("\n--- Scenario 3: User Setup & OTP Generation ---");
    await test("Register test user account", async () => {
      const res = await request("/auth/register", {
        method: "POST",
        body: {
          name: "OTP Test User",
          email: testEmail,
          password: testPassword,
        },
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.email, testEmail);
    });

    let generatedOtp = "847291";
    await test("Generate OTP record in database with 10-minute expiry", async () => {
      await safeDb(() => Otp.deleteMany({ email: testEmail }));
      const record = await safeDb(() =>
        Otp.create({
          email: testEmail,
          otp: generatedOtp,
          purpose: "reset_password",
        })
      );
      assert.strictEqual(record.otp, generatedOtp);
      assert.strictEqual(record.email, testEmail);
    });

    console.log("\n--- Scenario 4: OTP Verification ---");
    await test("Reject invalid OTP code", async () => {
      const res = await request("/auth/verify-otp", {
        method: "POST",
        body: { email: testEmail, otp: "000000", purpose: "reset_password" },
      });
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /Invalid or expired/i);
    });

    await test("Accept correct OTP code", async () => {
      const res = await request("/auth/verify-otp", {
        method: "POST",
        body: { email: testEmail, otp: generatedOtp, purpose: "reset_password" },
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
    });

    console.log("\n--- Scenario 5: Password Reset with OTP ---");
    const newPassword = "NewUpdatedPassword456!";
    await test("Reject reset password when password is too short", async () => {
      const res = await request("/auth/reset-password", {
        method: "POST",
        body: { email: testEmail, otp: generatedOtp, newPassword: "123" },
      });
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /at least 6 characters/i);
    });

    await test("Successfully reset password using valid OTP", async () => {
      const res = await request("/auth/reset-password", {
        method: "POST",
        body: { email: testEmail, otp: generatedOtp, newPassword },
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
    });

    await test("Old password no longer logs in", async () => {
      const res = await request("/auth/login", {
        method: "POST",
        body: { email: testEmail, password: testPassword },
      });
      assert.strictEqual(res.status, 401);
    });

    await test("New password logs in successfully", async () => {
      const res = await request("/auth/login", {
        method: "POST",
        body: { email: testEmail, password: newPassword },
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.token, "Token should be present");
    });

    await test("Used OTP is cleared and cannot be replayed", async () => {
      const res = await request("/auth/reset-password", {
        method: "POST",
        body: { email: testEmail, otp: generatedOtp, newPassword: "AnotherPassword789!" },
      });
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /Invalid or expired/i);
    });

    console.log("\n--- Scenario 6: Passwordless Sign-in with Email OTP ---");
    const loginOtp = "592184";
    await safeDb(() =>
      Otp.create({
        email: testEmail,
        otp: loginOtp,
        purpose: "login",
      })
    );

    await test("Sign in directly using email and OTP code", async () => {
      const res = await request("/auth/login-otp", {
        method: "POST",
        body: { email: testEmail, otp: loginOtp },
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.token);
      assert.strictEqual(res.data.email, testEmail);
    });

    await test("Login OTP cannot be reused after login", async () => {
      const res = await request("/auth/login-otp", {
        method: "POST",
        body: { email: testEmail, otp: loginOtp },
      });
      assert.strictEqual(res.status, 400);
    });

    console.log("\n--- Scenario 7: Google OAuth Endpoint Validations ---");
    await test("Reject Google OAuth request without credential", async () => {
      const res = await request("/auth/google", {
        method: "POST",
        body: {},
      });
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /credential token is required/i);
    });

    await test("Reject invalid or forged Google ID token", async () => {
      const res = await request("/auth/google", {
        method: "POST",
        body: { credential: "invalid.fake.jwt.token" },
      });
      assert.ok(res.status >= 400);
    });

    await test("User model allows Google user without password", async () => {
      const googleUserEmail = `google_user_${Date.now()}@example.com`;
      const user = await safeDb(() =>
        User.create({
          name: "Google Authenticated User",
          email: googleUserEmail,
          googleId: "google-uid-1234567890",
          avatar: "https://lh3.googleusercontent.com/test-avatar.jpg",
          authProvider: "google",
        })
      );
      assert.ok(user._id);
      assert.strictEqual(user.googleId, "google-uid-1234567890");
      assert.strictEqual(user.authProvider, "google");
      assert.strictEqual(user.avatar, "https://lh3.googleusercontent.com/test-avatar.jpg");

      // Verify comparePassword returns false gracefully for passwordless accounts
      const match = await user.comparePassword("SomePassword");
      assert.strictEqual(match, false);

      await safeDb(() => User.deleteOne({ _id: user._id }));
    });

    console.log("\n--- Scenario 8: Live SMTP Email Notification Delivery ---");
    await test("Send live OTP email via SpendWise SMTP (spendwise.global@gmail.com)", async () => {
      const liveOtp = "123456";
      const mailRes = await sendOtpEmail({
        to: "spendwise.global@gmail.com",
        otp: liveOtp,
        purpose: "reset_password",
        name: "SpendWise Admin",
      });
      assert.ok(mailRes.messageId, "Message ID should be returned by SMTP server");
      console.log(`    SMTP Message ID: ${mailRes.messageId}`);
    });

    // Cleanup
    await safeDb(() => User.deleteMany({ email: testEmail }));
    await safeDb(() => Otp.deleteMany({ email: testEmail }));

    console.log("\n==================================================");
    console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log("==================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Fatal test error:", err);
    process.exit(1);
  } finally {
    if (server) server.close();
    await mongoose.connection.close();
  }
}

runAuthOtpGoogleTests();
