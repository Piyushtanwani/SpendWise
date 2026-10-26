/**
 * Automated Test Suite for Budget Management & Financial Planning
 * Tests budget creation, upsert mechanics, expense spend tracking, threshold warnings, and deletion
 */

process.env.NODE_ENV = "test";
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const assert = require("assert");
const http = require("http");
const mongoose = require("mongoose");
const app = require("../server");

const User = require("../models/User");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");

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

async function safeDb(fn, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function runBudgetApiTests() {
  console.log("==================================================");
  console.log("   Budget Management & Financial Planning Suite   ");
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

  let userA, tokenA;
  let userB, tokenB;
  let testCat;
  let budgetId;
  const createdTxIds = [];

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

    const emailA = `varunee_test_a_${Date.now()}@example.com`;
    const emailB = `varunee_test_b_${Date.now()}@example.com`;

    console.log("--- Scenario 1: User Onboarding ---");
    await test("Register primary budget planner (User A)", async () => {
      const res = await request("/auth/register", {
        method: "POST",
        body: { name: "Varunee Planner", email: emailA, password: "Password123!" },
      });
      assert.strictEqual(res.status, 201);
      userA = res.data;
      tokenA = res.data.token;
    });

    await test("Register secondary user (User B)", async () => {
      const res = await request("/auth/register", {
        method: "POST",
        body: { name: "Varunee Secondary", email: emailB, password: "Password123!" },
      });
      assert.strictEqual(res.status, 201);
      userB = res.data;
      tokenB = res.data.token;
    });

    console.log("\n--- Scenario 2: Validation of Budget Endpoints ---");
    await test("Reject GET /api/budgets when month parameter is missing", async () => {
      const res = await request("/budgets", { method: "GET" }, tokenA);
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /month query param.*is required/i);
    });

    await test("Reject POST /api/budgets when required fields are missing", async () => {
      const res = await request("/budgets", {
        method: "POST",
        body: { monthlyLimit: 5000 },
      }, tokenA);
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /Category, monthlyLimit, and month are required/i);
    });

    console.log("\n--- Scenario 3: Budget Creation & Upsert Mechanics ---");
    await test("Create custom budget category", async () => {
      const res = await request("/categories", {
        method: "POST",
        body: { name: "Dining & Coffee", type: "expense", color: "#C1533E" },
      }, tokenA);
      assert.strictEqual(res.status, 201);
      testCat = res.data;
    });

    await test("Create initial budget limit of ₹5,000 for October 2026", async () => {
      const res = await request("/budgets", {
        method: "POST",
        body: {
          category: testCat._id,
          monthlyLimit: 5000,
          month: "2026-10",
        },
      }, tokenA);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.monthlyLimit, 5000);
      assert.strictEqual(res.data.month, "2026-10");
      budgetId = res.data._id;
    });

    await test("Upsert budget limit to ₹6,000 without duplicating record", async () => {
      const res = await request("/budgets", {
        method: "POST",
        body: {
          category: testCat._id,
          monthlyLimit: 6000,
          month: "2026-10",
        },
      }, tokenA);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.monthlyLimit, 6000);
      assert.strictEqual(res.data._id, budgetId); // ID remains the same

      const all = await request("/budgets?month=2026-10", { method: "GET" }, tokenA);
      assert.strictEqual(all.data.length, 1);
    });

    console.log("\n--- Scenario 4: Spend Tracking Against Budget Limit ---");
    await test("Track initial spending: spent = 0 when no transactions exist", async () => {
      const res = await request("/budgets?month=2026-10", { method: "GET" }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data[0].spent, 0);
      assert.strictEqual(res.data[0].monthlyLimit, 6000);
    });

    await test("Add transactions within budget and verify dynamic spent calculation", async () => {
      const tx1 = await request("/transactions", {
        method: "POST",
        body: {
          amount: 2500,
          type: "expense",
          category: testCat._id,
          description: "Family Dinner",
          date: "2026-10-08T19:00:00.000Z",
        },
      }, tokenA);
      assert.strictEqual(tx1.status, 201);
      createdTxIds.push(tx1.data._id);

      const tx2 = await request("/transactions", {
        method: "POST",
        body: {
          amount: 1200,
          type: "expense",
          category: testCat._id,
          description: "Café Lunch",
          date: "2026-10-14T13:00:00.000Z",
        },
      }, tokenA);
      assert.strictEqual(tx2.status, 201);
      createdTxIds.push(tx2.data._id);

      const res = await request("/budgets?month=2026-10", { method: "GET" }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data[0].spent, 3700); // 2500 + 1200
      assert.strictEqual(res.data[0].monthlyLimit, 6000);
    });

    await test("Verify transactions in other months do not inflate October budget", async () => {
      const txOld = await request("/transactions", {
        method: "POST",
        body: {
          amount: 3000,
          type: "expense",
          category: testCat._id,
          description: "September Dinner",
          date: "2026-09-20T19:00:00.000Z",
        },
      }, tokenA);
      assert.strictEqual(txOld.status, 201);
      createdTxIds.push(txOld.data._id);

      const res = await request("/budgets?month=2026-10", { method: "GET" }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data[0].spent, 3700); // Remains unchanged
    });

    console.log("\n--- Scenario 5: Overspending Warning Detection ---");
    await test("Detect overspending when expenses exceed monthly limit", async () => {
      const txOver = await request("/transactions", {
        method: "POST",
        body: {
          amount: 3000,
          type: "expense",
          category: testCat._id,
          description: "Celebration Feast",
          date: "2026-10-24T20:00:00.000Z",
        },
      }, tokenA);
      assert.strictEqual(txOver.status, 201);
      createdTxIds.push(txOver.data._id);

      const res = await request("/budgets?month=2026-10", { method: "GET" }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data[0].spent, 6700);
      assert.strictEqual(res.data[0].monthlyLimit, 6000);
      assert.ok(res.data[0].spent > res.data[0].monthlyLimit, "Spent should exceed monthly limit");
    });

    console.log("\n--- Scenario 6: Authorization & Deletion ---");
    await test("Ensure User B receives empty budgets list for October", async () => {
      const res = await request("/budgets?month=2026-10", { method: "GET" }, tokenB);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.length, 0);
    });

    await test("Prevent User B from deleting User A's budget", async () => {
      const res = await request(`/budgets/${budgetId}`, { method: "DELETE" }, tokenB);
      assert.strictEqual(res.status, 403);
      assert.match(res.data.message, /Not authorized/i);
    });

    await test("User A successfully deletes budget", async () => {
      const res = await request(`/budgets/${budgetId}`, { method: "DELETE" }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.message, "Budget deleted");

      const after = await request("/budgets?month=2026-10", { method: "GET" }, tokenA);
      assert.strictEqual(after.data.length, 0);
    });

    // Cleanup
    console.log("\n--- Cleanup: Removing test records ---");
    await safeDb(() => Transaction.deleteMany({ _id: { $in: createdTxIds } }));
    await safeDb(() => Category.deleteOne({ _id: testCat._id }));
    await safeDb(() => Budget.deleteOne({ _id: budgetId }));
    await safeDb(() => User.deleteMany({ _id: { $in: [userA._id, userB._id] } }));
    console.log("Budget test records cleaned up successfully.");

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

runBudgetApiTests();
