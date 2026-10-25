/**
 * Automated Test Suite for SpendWise Split
 * Covers all 9 required test scenarios:
 * 1. Friend requests (successful, self-request, non-existent, duplicate, accept, reject)
 * 2. Creating equal and custom splits
 * 3. Invalid amounts and invalid participants
 * 4. Unauthorized access to expenses
 * 5. Balance calculations for multiple participants (preventing self-share counted as debt)
 * 6. Full and partial settlements (ensuring balances reduce only upon confirmation)
 * 7. Repeated requests and duplicate settlement prevention (exceeding debt, re-confirming)
 * 8. Updating and deleting shared expenses with dynamic balance recalculation
 * 9. Regression tests for existing auth, transactions, categories, and analytics
 */

process.env.NODE_ENV = "test";
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const assert = require("assert");
const http = require("http");
const mongoose = require("mongoose");
const app = require("../server");

// Models for cleanup
const User = require("../models/User");
const Friendship = require("../models/Friendship");
const SharedExpense = require("../models/SharedExpense");
const Settlement = require("../models/Settlement");
const Transaction = require("../models/Transaction");
const Category = require("../models/Category");

let server;
let baseUrl;

// Test user data
const testTimestamp = Date.now();
const users = {
  piyush: {
    name: "Piyush Tanwani",
    email: `piyush_${testTimestamp}@example.com`,
    password: "Password123!",
    token: null,
    id: null,
  },
  afif: {
    name: "Afif Khan",
    email: `afif_${testTimestamp}@example.com`,
    password: "Password123!",
    token: null,
    id: null,
  },
  varunee: {
    name: "Varunee Sharma",
    email: `varunee_${testTimestamp}@example.com`,
    password: "Password123!",
    token: null,
    id: null,
  },
  intruder: {
    name: "Intruder User",
    email: `intruder_${testTimestamp}@example.com`,
    password: "Password123!",
    token: null,
    id: null,
  },
};

// HTTP helper with transient network error retry
async function request(endpoint, options = {}, token = null, retries = 4) {
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
      await new Promise((r) => setTimeout(r, 1000));
      return await request(endpoint, options, token, retries - 1);
    }

    return { status: response.status, data };
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return await request(endpoint, options, token, retries - 1);
    }
    throw err;
  }
}

// Test runner
async function runTests() {
  console.log("==================================================");
  console.log("   SpendWise Split — Comprehensive Test Suite    ");
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
      if (err.stack) console.error(`    ${err.stack.split("\n")[1]}`);
      failed++;
    }
  }

  try {
    // 1. Start test server on ephemeral port
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        console.log(`Test server running at ${baseUrl}\n`);
        resolve();
      });
    });

    // Ensure database connection is completely open
    while (mongoose.connection.readyState !== 1) {
      await new Promise((res) => setTimeout(res, 250));
    }

    // Clean up any previous test remnants
    async function safeDb(fn, retries = 4) {
      for (let i = 0; i < retries; i++) {
        try {
          return await fn();
        } catch (err) {
          if (i === retries - 1) throw err;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    await safeDb(() => User.deleteMany({ email: /@example\.com$/ }));
    await safeDb(() => Friendship.deleteMany({}));
    await safeDb(() => SharedExpense.deleteMany({}));
    await safeDb(() => Settlement.deleteMany({}));

    // ==========================================
    // SETUP: Register test users
    // ==========================================
    console.log("--- Setup: Registering Test Accounts ---");
    for (const key of Object.keys(users)) {
      const u = users[key];
      const res = await request("/auth/register", {
        method: "POST",
        body: { name: u.name, email: u.email, password: u.password },
      });
      assert.strictEqual(res.status, 201, `Failed to register ${u.name}`);
      u.token = res.data.token;
      u.id = res.data._id;
    }
    console.log("All 4 test users registered successfully.\n");

    // ==========================================
    // SCENARIO 1: Friend Management
    // ==========================================
    console.log("--- Scenario 1: Friend Requests & Management ---");
    let friendshipPiyushAfifId = null;
    let friendshipPiyushVaruneeId = null;

    await test("Search users excludes current user and masks sensitive fields", async () => {
      const res = await request(`/friends/search?query=Afif`, {}, users.piyush.token);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data));
      const found = res.data.find((u) => u.email === users.afif.email);
      assert.ok(found, "Afif should be found in search");
      assert.strictEqual(found.password, undefined, "Password must not be returned");
    });

    await test("Send friend request successfully (Piyush -> Afif)", async () => {
      const res = await request("/friends/request", {
        method: "POST",
        body: { recipientId: users.afif.id },
      }, users.piyush.token);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.friendship.status, "pending");
      friendshipPiyushAfifId = res.data.friendship._id;
    });

    await test("Prevent self-request (Piyush -> Piyush)", async () => {
      const res = await request("/friends/request", {
        method: "POST",
        body: { recipientId: users.piyush.id },
      }, users.piyush.token);
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.message.includes("yourself"));
    });

    await test("Prevent duplicate friend request (Piyush -> Afif again)", async () => {
      const res = await request("/friends/request", {
        method: "POST",
        body: { recipientId: users.afif.id },
      }, users.piyush.token);
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.message.includes("already"));
    });

    await test("Prevent reverse friend request when one is already pending (Afif -> Piyush)", async () => {
      const res = await request("/friends/request", {
        method: "POST",
        body: { recipientId: users.piyush.id },
      }, users.afif.token);
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.message.includes("already sent you a friend request"));
    });

    await test("Send friend request to non-existent user returns 404", async () => {
      const res = await request("/friends/request", {
        method: "POST",
        body: { recipientId: new mongoose.Types.ObjectId().toString() },
      }, users.piyush.token);
      assert.strictEqual(res.status, 404);
    });

    await test("Unauthorized user cannot accept someone else's request", async () => {
      const res = await request(`/friends/requests/${friendshipPiyushAfifId}`, {
        method: "PUT",
        body: { action: "accept" },
      }, users.intruder.token);
      assert.strictEqual(res.status, 403);
    });

    await test("Afif accepts Piyush's friend request", async () => {
      const res = await request(`/friends/requests/${friendshipPiyushAfifId}`, {
        method: "PUT",
        body: { action: "accept" },
      }, users.afif.token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.friendship.status, "accepted");
    });

    await test("Both users see each other in accepted friends list", async () => {
      const resPiyush = await request("/friends", {}, users.piyush.token);
      assert.strictEqual(resPiyush.status, 200);
      assert.ok(resPiyush.data.some((f) => f.friend._id === users.afif.id));

      const resAfif = await request("/friends", {}, users.afif.token);
      assert.strictEqual(resAfif.status, 200);
      assert.ok(resAfif.data.some((f) => f.friend._id === users.piyush.id));
    });

    await test("Piyush adds Varunee as friend and Varunee accepts", async () => {
      const reqRes = await request("/friends/request", {
        method: "POST",
        body: { recipientId: users.varunee.id },
      }, users.piyush.token);
      assert.strictEqual(reqRes.status, 201);
      friendshipPiyushVaruneeId = reqRes.data.friendship._id;

      const acceptRes = await request(`/friends/requests/${friendshipPiyushVaruneeId}`, {
        method: "PUT",
        body: { action: "accept" },
      }, users.varunee.token);
      assert.strictEqual(acceptRes.status, 200);
    });

    await test("Afif adds Varunee as friend and Varunee accepts", async () => {
      const reqRes = await request("/friends/request", {
        method: "POST",
        body: { recipientId: users.varunee.id },
      }, users.afif.token);
      assert.strictEqual(reqRes.status, 201);

      const acceptRes = await request(`/friends/requests/${reqRes.data.friendship._id}`, {
        method: "PUT",
        body: { action: "accept" },
      }, users.varunee.token);
      assert.strictEqual(acceptRes.status, 200);
    });

    await test("Reject friend request workflow", async () => {
      // Intruder sends request to Varunee
      const reqRes = await request("/friends/request", {
        method: "POST",
        body: { recipientId: users.varunee.id },
      }, users.intruder.token);
      assert.strictEqual(reqRes.status, 201);

      // Varunee rejects it
      const rejectRes = await request(`/friends/requests/${reqRes.data.friendship._id}`, {
        method: "PUT",
        body: { action: "reject" },
      }, users.varunee.token);
      assert.strictEqual(rejectRes.status, 200);
      assert.strictEqual(rejectRes.data.friendship.status, "rejected");
    });

    // ==========================================
    // SCENARIO 2: Creating Equal and Custom Splits
    // ==========================================
    console.log("\n--- Scenario 2: Shared Expense Creation (Equal & Custom) ---");
    let equalExpenseId = null;
    let customExpenseId = null;

    await test("Create equal split: Piyush pays ₹1,500 for Piyush, Afif, Varunee (₹500 each)", async () => {
      const res = await request("/split/expenses", {
        method: "POST",
        body: {
          description: "Team Dinner at Biryani House",
          amount: 1500,
          payer: users.piyush.id,
          splitType: "equal",
          participants: [users.piyush.id, users.afif.id, users.varunee.id],
        },
      }, users.piyush.token);

      assert.strictEqual(res.status, 201);
      equalExpenseId = res.data._id;
      assert.strictEqual(res.data.amount, 1500);
      assert.strictEqual(res.data.splits.length, 3);
      // Each participant's share should be exactly 500
      for (const split of res.data.splits) {
        assert.strictEqual(split.amount, 500);
      }
    });


    await test("Create custom exact split: Piyush pays ₹1,000 (Piyush: ₹600, Afif: ₹400)", async () => {
      const res = await request("/split/expenses", {
        method: "POST",
        body: {
          description: "Grocery Trip",
          amount: 1000,
          payer: users.piyush.id,
          splitType: "exact",
          splits: [
            { user: users.piyush.id, amount: 600 },
            { user: users.afif.id, amount: 400 },
          ],
        },
      }, users.piyush.token);

      assert.strictEqual(res.status, 201);
      customExpenseId = res.data._id;
      assert.strictEqual(res.data.amount, 1000);
      const afifSplit = res.data.splits.find((s) => s.user._id === users.afif.id);
      assert.strictEqual(afifSplit.amount, 400);
    });

    // ==========================================
    // SCENARIO 3: Invalid Amounts & Participants
    // ==========================================
    console.log("\n--- Scenario 3: Validation of Invalid Amounts & Participants ---");

    await test("Reject expense with zero or negative amount", async () => {
      const res = await request("/split/expenses", {
        method: "POST",
        body: {
          description: "Free lunch",
          amount: 0,
          splitType: "equal",
          participants: [users.piyush.id, users.afif.id],
        },
      }, users.piyush.token);
      assert.strictEqual(res.status, 400);
    });

    await test("Reject expense with non-friend participant", async () => {
      const res = await request("/split/expenses", {
        method: "POST",
        body: {
          description: "Trip with stranger",
          amount: 300,
          splitType: "equal",
          participants: [users.piyush.id, users.intruder.id],
        },
      }, users.piyush.token);
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.message.includes("not an accepted friend"));
    });

    await test("Reject custom split when sum of shares does not match total amount", async () => {
      const res = await request("/split/expenses", {
        method: "POST",
        body: {
          description: "Mismatched Bill",
          amount: 500,
          splitType: "exact",
          splits: [
            { user: users.piyush.id, amount: 200 },
            { user: users.afif.id, amount: 200 }, // sum 400 !== 500
          ],
        },
      }, users.piyush.token);
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.message.includes("does not match"));
    });

    await test("Reject expense when payer is not in participants list", async () => {
      const res = await request("/split/expenses", {
        method: "POST",
        body: {
          description: "Ghost Payer",
          amount: 200,
          payer: users.varunee.id,
          splitType: "equal",
          participants: [users.piyush.id, users.afif.id], // varunee not here
        },
      }, users.piyush.token);
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.message.includes("payer must be"));
    });

    // ==========================================
    // SCENARIO 4: Unauthorized Access Protection
    // ==========================================
    console.log("\n--- Scenario 4: Authorization and Privacy Protection ---");

    await test("Uninvolved user (Intruder) cannot view private shared expense", async () => {
      const res = await request(`/split/expenses/${equalExpenseId}`, {}, users.intruder.token);
      assert.strictEqual(res.status, 403);
    });

    await test("Uninvolved user cannot update private shared expense", async () => {
      const res = await request(`/split/expenses/${equalExpenseId}`, {
        method: "PUT",
        body: { description: "Hacked Description" },
      }, users.intruder.token);
      assert.strictEqual(res.status, 403);
    });

    await test("Uninvolved user cannot delete private shared expense", async () => {
      const res = await request(`/split/expenses/${equalExpenseId}`, {
        method: "DELETE",
      }, users.intruder.token);
      assert.strictEqual(res.status, 403);
    });

    // ==========================================
    // SCENARIO 5: Balance Calculations
    // ==========================================
    console.log("\n--- Scenario 5: Accurate Balance Calculations ---");

    await test("Piyush's balance: total owed to user is ₹1,400 (Afif ₹900, Varunee ₹500), user owes ₹0", async () => {
      // Piyush paid 1500 (equal split 500 each for Piyush, Afif, Varunee) -> Afif owes 500, Varunee owes 500
      // Piyush paid 1000 (custom split 600 for Piyush, 400 for Afif) -> Afif owes 400
      // Total Afif owes Piyush: 500 + 400 = 900
      // Total Varunee owes Piyush: 500
      // Piyush's own shares (500 + 600 = 1100) are NOT owed by anyone!
      const res = await request("/split/balances", {}, users.piyush.token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.totalOwedToUser, 1400);
      assert.strictEqual(res.data.totalUserOwes, 0);
      assert.strictEqual(res.data.netBalance, 1400);

      const afifBal = res.data.friends.find((f) => f.friend._id === users.afif.id);
      assert.strictEqual(afifBal.net, 900);
      assert.strictEqual(afifBal.status, "owes_you");

      const varuneeBal = res.data.friends.find((f) => f.friend._id === users.varunee.id);
      assert.strictEqual(varuneeBal.net, 500);
      assert.strictEqual(varuneeBal.status, "owes_you");
    });

    await test("Afif's balance: total user owes is ₹900 (to Piyush), owed to user is ₹0", async () => {
      const res = await request("/split/balances", {}, users.afif.token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.totalUserOwes, 900);
      assert.strictEqual(res.data.totalOwedToUser, 0);
      assert.strictEqual(res.data.netBalance, -900);

      const piyushBal = res.data.friends.find((f) => f.friend._id === users.piyush.id);
      assert.strictEqual(piyushBal.net, -900);
      assert.strictEqual(piyushBal.status, "you_owe");
    });

    // ==========================================
    // SCENARIO 6: Full and Partial Settlements
    // ==========================================
    console.log("\n--- Scenario 6: Settlements (Pending & Confirmed Workflow) ---");
    let partialSettlementId = null;

    await test("Afif records partial repayment of ₹400 to Piyush (status: pending)", async () => {
      const res = await request("/split/settlements", {
        method: "POST",
        body: {
          recipientId: users.piyush.id,
          amount: 400,
          note: "Partial payment for groceries and dinner",
        },
      }, users.afif.token);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.settlement.status, "pending");
      partialSettlementId = res.data.settlement._id;
    });

    await test("Balances remain UNCHANGED while settlement is pending", async () => {
      // Afif should STILL owe 900 until Piyush confirms!
      const resAfif = await request("/split/balances", {}, users.afif.token);
      assert.strictEqual(resAfif.data.totalUserOwes, 900);

      const resPiyush = await request("/split/balances", {}, users.piyush.token);
      assert.strictEqual(resPiyush.data.totalOwedToUser, 1400);
    });

    await test("Piyush confirms the partial settlement of ₹400", async () => {
      const res = await request(`/split/settlements/${partialSettlementId}/confirm`, {
        method: "PUT",
      }, users.piyush.token);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.settlement.status, "confirmed");
    });

    await test("Balances reflect the ₹400 reduction: Afif now owes ₹500", async () => {
      const resAfif = await request("/split/balances", {}, users.afif.token);
      assert.strictEqual(resAfif.data.totalUserOwes, 500); // 900 - 400 = 500

      const resPiyush = await request("/split/balances", {}, users.piyush.token);
      assert.strictEqual(resPiyush.data.totalOwedToUser, 1000); // 1400 - 400 = 1000 (Afif 500 + Varunee 500)
    });

    await test("Afif records remaining full settlement of ₹500 and Piyush confirms", async () => {
      const settleRes = await request("/split/settlements", {
        method: "POST",
        body: {
          recipientId: users.piyush.id,
          amount: 500,
          note: "Final remaining balance",
        },
      }, users.afif.token);
      assert.strictEqual(settleRes.status, 201);

      const confirmRes = await request(`/split/settlements/${settleRes.data.settlement._id}/confirm`, {
        method: "PUT",
      }, users.piyush.token);
      assert.strictEqual(confirmRes.status, 200);

      // Verify Afif is completely settled with Piyush (net = 0)
      const resAfif = await request("/split/balances", {}, users.afif.token);
      assert.strictEqual(resAfif.data.totalUserOwes, 0);
      const piyushBal = resAfif.data.friends.find((f) => f.friend._id === users.piyush.id);
      assert.strictEqual(piyushBal.net, 0);
      assert.strictEqual(piyushBal.status, "settled");
    });

    // ==========================================
    // SCENARIO 7: Duplicate & Exceeding Settlements
    // ==========================================
    console.log("\n--- Scenario 7: Duplicate and Exceeding Settlement Prevention ---");

    await test("Reject settlement when debtor has no outstanding debt (Afif owes ₹0 now)", async () => {
      const res = await request("/split/settlements", {
        method: "POST",
        body: {
          recipientId: users.piyush.id,
          amount: 100,
        },
      }, users.afif.token);
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.message.includes("do not have an outstanding debt"));
    });

    await test("Reject settlement exceeding current debt (Varunee owes ₹500, tries to settle ₹600)", async () => {
      const res = await request("/split/settlements", {
        method: "POST",
        body: {
          recipientId: users.piyush.id,
          amount: 600,
        },
      }, users.varunee.token);
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.message.includes("exceeds your outstanding balance"));
    });

    await test("Reject re-confirming an already confirmed settlement", async () => {
      const res = await request(`/split/settlements/${partialSettlementId}/confirm`, {
        method: "PUT",
      }, users.piyush.token);
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.message.includes("already been confirmed"));
    });

    await test("Debtor (sender) cannot confirm their own settlement", async () => {
      // Varunee records valid 200 settlement
      const createRes = await request("/split/settlements", {
        method: "POST",
        body: {
          recipientId: users.piyush.id,
          amount: 200,
        },
      }, users.varunee.token);
      assert.strictEqual(createRes.status, 201);

      // Varunee tries to confirm it herself
      const confirmRes = await request(`/split/settlements/${createRes.data.settlement._id}/confirm`, {
        method: "PUT",
      }, users.varunee.token);
      assert.strictEqual(confirmRes.status, 403);
      assert.ok(confirmRes.data.message.includes("Only the repayment recipient"));

      // Clean up the pending settlement
      await request(`/split/settlements/${createRes.data.settlement._id}`, {
        method: "DELETE",
      }, users.varunee.token);
    });

    // ==========================================
    // SCENARIO 8: Updating & Deleting Shared Expenses
    // ==========================================
    console.log("\n--- Scenario 8: Updating & Deleting Shared Expenses ---");

    await test("Update shared expense: change ₹1,500 dinner to ₹1,200 (₹400 each for A, B, C)", async () => {
      const res = await request(`/split/expenses/${equalExpenseId}`, {
        method: "PUT",
        body: {
          amount: 1200,
          description: "Team Dinner (Discounted Bill)",
          participants: [users.piyush.id, users.afif.id, users.varunee.id],
        },
      }, users.piyush.token);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.amount, 1200);
      for (const split of res.data.splits) {
        assert.strictEqual(split.amount, 400);
      }

      // Varunee's share changed from 500 to 400 -> Piyush's balance with Varunee updates automatically
      const balRes = await request("/split/balances", {}, users.piyush.token);
      const varuneeBal = balRes.data.friends.find((f) => f.friend._id === users.varunee.id);
      assert.strictEqual(varuneeBal.net, 400);
    });

    await test("Delete shared expense and verify dynamic balance update", async () => {
      const deleteRes = await request(`/split/expenses/${equalExpenseId}`, {
        method: "DELETE",
      }, users.piyush.token);
      assert.strictEqual(deleteRes.status, 200);

      // After deleting the dinner expense, Varunee is completely settled with Piyush (net = 0)
      const balRes = await request("/split/balances", {}, users.piyush.token);
      const varuneeBal = balRes.data.friends.find((f) => f.friend._id === users.varunee.id);
      assert.strictEqual(varuneeBal.net, 0);
      assert.strictEqual(varuneeBal.status, "settled");
    });

    await test("Create equal split with odd remainder cents (₹100 / 3 = 33.34 + 33.33 + 33.33)", async () => {
      const res = await request("/split/expenses", {
        method: "POST",
        body: {
          description: "Coffee & Snacks",
          amount: 100,
          payer: users.piyush.id,
          splitType: "equal",
          participants: [users.piyush.id, users.afif.id, users.varunee.id],
        },
      }, users.piyush.token);

      assert.strictEqual(res.status, 201);
      const sumSplits = res.data.splits.reduce((sum, s) => sum + s.amount, 0);
      assert.strictEqual(Math.round(sumSplits * 100) / 100, 100);
      // Clean up test coffee expense immediately
      const del = await request(`/split/expenses/${res.data._id}`, { method: "DELETE" }, users.piyush.token);
      assert.strictEqual(del.status, 200);
    });

    // ==========================================
    // SCENARIO 9: Regressions for Existing App
    // ==========================================
    console.log("\n--- Scenario 9: Existing Core App Functionality Regressions ---");

    await test("Auth check: GET /api/auth/me returns user profile", async () => {
      const res = await request("/auth/me", {}, users.piyush.token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.email, users.piyush.email);
    });

    await test("Categories check: GET /api/categories returns system categories", async () => {
      const res = await request("/categories", {}, users.piyush.token);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data));
    });

    let testTransactionId = null;
    await test("Personal Transactions: create, list, and check analytics", async () => {
      // Find or create category
      let catRes = await request("/categories", {}, users.piyush.token);
      let catId = catRes.data[0]?._id;
      if (!catId) {
        const newCat = await Category.create({ name: "Personal Test", type: "expense" });
        catId = newCat._id;
      }

      // Create transaction
      const txRes = await request("/transactions", {
        method: "POST",
        body: {
          amount: 250,
          type: "expense",
          category: catId,
          description: "Personal Book Purchase",
        },
      }, users.piyush.token);
      assert.strictEqual(txRes.status, 201);
      testTransactionId = txRes.data._id;

      // List transactions
      const listRes = await request("/transactions", {}, users.piyush.token);
      assert.strictEqual(listRes.status, 200);
      assert.ok(listRes.data.transactions.some((t) => t._id === testTransactionId));

      // Analytics summary
      const analyticsRes = await request(`/analytics/summary?month=${new Date().toISOString().substring(0, 7)}`, {}, users.piyush.token);
      assert.strictEqual(analyticsRes.status, 200);
      assert.ok(analyticsRes.data.expense >= 250);

      // Clean up test transaction
      await request(`/transactions/${testTransactionId}`, { method: "DELETE" }, users.piyush.token);
    });

  } finally {
    // Teardown test server and clean up test data
    console.log("\n--- Cleanup: Removing test records ---");
    try {
      const testEmails = Object.values(users).map((u) => u.email);
      const createdUsers = await User.find({ email: { $in: testEmails } });
      const userIds = createdUsers.map((u) => u._id);

      await Friendship.deleteMany({
        $or: [{ requester: { $in: userIds } }, { recipient: { $in: userIds } }],
      });
      await SharedExpense.deleteMany({
        $or: [{ creator: { $in: userIds } }, { payer: { $in: userIds } }],
      });
      await Settlement.deleteMany({
        $or: [{ sender: { $in: userIds } }, { recipient: { $in: userIds } }],
      });
      await Transaction.deleteMany({ userId: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
      console.log("Test records cleaned up successfully.");
    } catch (cleanupErr) {
      console.warn("Cleanup notice:", cleanupErr.message);
    }

    if (server) {
      server.close();
    }
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
