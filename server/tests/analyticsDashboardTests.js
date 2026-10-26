/**
 * Automated Test Suite for Dashboard & Analytics Engine
 * Tests monthly summary KPIs, category spending breakdowns, and annual trends
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

async function runAnalyticsDashboardTests() {
  console.log("==================================================");
  console.log("   Dashboard & Financial Analytics Test Suite     ");
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

  let testUser;
  let userToken;
  let catSalary, catFood, catRent;
  const createdTransactions = [];

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

    const testEmail = `analytics_test_${Date.now()}@example.com`;

    console.log("--- Scenario 1: User Onboarding & Auth Token ---");
    await test("Register test user for analytics evaluation", async () => {
      const res = await request("/auth/register", {
        method: "POST",
        body: { name: "Piyush Analytics Tester", email: testEmail, password: "Password123!" },
      });
      assert.strictEqual(res.status, 201);
      assert.ok(res.data.token);
      testUser = res.data;
      userToken = res.data.token;
    });

    console.log("\n--- Scenario 2: Setup Test Categories & Transactions ---");
    await test("Create categories for testing income and expenses", async () => {
      const resIncome = await request("/categories", {
        method: "POST",
        body: { name: "Analytics Salary", type: "income", color: "#3F7259" },
      }, userToken);
      assert.strictEqual(resIncome.status, 201);
      catSalary = resIncome.data;

      const resFood = await request("/categories", {
        method: "POST",
        body: { name: "Analytics Groceries", type: "expense", color: "#C1533E" },
      }, userToken);
      assert.strictEqual(resFood.status, 201);
      catFood = resFood.data;

      const resRent = await request("/categories", {
        method: "POST",
        body: { name: "Analytics Housing", type: "expense", color: "#C98A2C" },
      }, userToken);
      assert.strictEqual(resRent.status, 201);
      catRent = resRent.data;
    });

    await test("Seed transactions across October 2026 and March 2026", async () => {
      // October 2026 transactions:
      // Income: 50,000
      // Expense: Groceries 8,000 + Housing 15,000 = 23,000
      // Net balance: 27,000
      const tx1 = await request("/transactions", {
        method: "POST",
        body: {
          amount: 50000,
          type: "income",
          category: catSalary._id,
          description: "Monthly Tech Salary",
          date: "2026-10-05T10:00:00.000Z",
        },
      }, userToken);
      assert.strictEqual(tx1.status, 201);
      createdTransactions.push(tx1.data._id);

      const tx2 = await request("/transactions", {
        method: "POST",
        body: {
          amount: 8000,
          type: "expense",
          category: catFood._id,
          description: "Supermarket Supplies",
          date: "2026-10-10T14:30:00.000Z",
        },
      }, userToken);
      assert.strictEqual(tx2.status, 201);
      createdTransactions.push(tx2.data._id);

      const tx3 = await request("/transactions", {
        method: "POST",
        body: {
          amount: 15000,
          type: "expense",
          category: catRent._id,
          description: "Apartment Rent",
          date: "2026-10-15T09:00:00.000Z",
        },
      }, userToken);
      assert.strictEqual(tx3.status, 201);
      createdTransactions.push(tx3.data._id);

      // March 2026 transaction (month 3):
      const tx4 = await request("/transactions", {
        method: "POST",
        body: {
          amount: 45000,
          type: "income",
          category: catSalary._id,
          description: "Spring Consulting Fee",
          date: "2026-03-20T12:00:00.000Z",
        },
      }, userToken);
      assert.strictEqual(tx4.status, 201);
      createdTransactions.push(tx4.data._id);
    });

    console.log("\n--- Scenario 3: Monthly Summary Calculations (GET /api/analytics/summary) ---");
    await test("Compute accurate monthly income, expense, and balance for 2026-10", async () => {
      const res = await request("/analytics/summary?month=2026-10", { method: "GET" }, userToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.month, "2026-10");
      assert.strictEqual(res.data.income, 50000);
      assert.strictEqual(res.data.expense, 23000);
      assert.strictEqual(res.data.balance, 27000);
    });

    await test("Return zero values for an empty month with no activity", async () => {
      const res = await request("/analytics/summary?month=2026-01", { method: "GET" }, userToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.income, 0);
      assert.strictEqual(res.data.expense, 0);
      assert.strictEqual(res.data.balance, 0);
    });

    console.log("\n--- Scenario 4: Category-wise Spending Breakdown (GET /api/analytics/by-category) ---");
    await test("Breakdown expenses by category sorted in descending order", async () => {
      const res = await request("/analytics/by-category?month=2026-10&type=expense", { method: "GET" }, userToken);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data));
      assert.strictEqual(res.data.length, 2);

      // Rent (15000) should be first, Groceries (8000) should be second
      assert.strictEqual(res.data[0].name, "Analytics Housing");
      assert.strictEqual(res.data[0].total, 15000);
      assert.strictEqual(res.data[0].color, "#C98A2C");

      assert.strictEqual(res.data[1].name, "Analytics Groceries");
      assert.strictEqual(res.data[1].total, 8000);
      assert.strictEqual(res.data[1].color, "#C1533E");
    });

    await test("Breakdown income by category", async () => {
      const res = await request("/analytics/by-category?month=2026-10&type=income", { method: "GET" }, userToken);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data));
      assert.strictEqual(res.data.length, 1);
      assert.strictEqual(res.data[0].name, "Analytics Salary");
      assert.strictEqual(res.data[0].total, 50000);
    });

    console.log("\n--- Scenario 5: Annual 12-Month Trends (GET /api/analytics/trend) ---");
    await test("Generate 12-month trend matrix for 2026", async () => {
      const res = await request("/analytics/trend?year=2026", { method: "GET" }, userToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.year, 2026);
      assert.strictEqual(res.data.trend.length, 12);

      // Month 3 (March, index 2)
      assert.strictEqual(res.data.trend[2].month, 3);
      assert.strictEqual(res.data.trend[2].income, 45000);
      assert.strictEqual(res.data.trend[2].expense, 0);

      // Month 10 (October, index 9)
      assert.strictEqual(res.data.trend[9].month, 10);
      assert.strictEqual(res.data.trend[9].income, 50000);
      assert.strictEqual(res.data.trend[9].expense, 23000);

      // Month 1 (January, index 0)
      assert.strictEqual(res.data.trend[0].income, 0);
      assert.strictEqual(res.data.trend[0].expense, 0);
    });

    console.log("\n--- Scenario 6: Security & Authorization Protection ---");
    await test("Reject analytics access without valid JWT Bearer token", async () => {
      const res = await request("/analytics/summary?month=2026-10", { method: "GET" });
      assert.strictEqual(res.status, 401);
    });

    // Cleanup
    console.log("\n--- Cleanup: Removing test records ---");
    await safeDb(() => Transaction.deleteMany({ _id: { $in: createdTransactions } }));
    await safeDb(() => Category.deleteMany({ _id: { $in: [catSalary._id, catFood._id, catRent._id] } }));
    await safeDb(() => User.deleteOne({ _id: testUser._id }));
    console.log("Analytics test records cleaned up successfully.");

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

runAnalyticsDashboardTests();
