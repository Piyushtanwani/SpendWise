/**
 * Automated Test Suite for Transactions & Category Management
 * Tests validation, filtering, pagination, custom categories, authorization, and referential integrity
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

async function runTransactionCategoryTests() {
  console.log("==================================================");
  console.log("   Transaction & Category Management Test Suite   ");
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
  let customCatA;
  let defaultCat;
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

    const emailA = `afif_test_a_${Date.now()}@example.com`;
    const emailB = `afif_test_b_${Date.now()}@example.com`;

    console.log("--- Scenario 1: User Onboarding ---");
    await test("Register primary user (User A)", async () => {
      const res = await request("/auth/register", {
        method: "POST",
        body: { name: "Afif Primary", email: emailA, password: "Password123!" },
      });
      assert.strictEqual(res.status, 201);
      userA = res.data;
      tokenA = res.data.token;
    });

    await test("Register secondary user (User B)", async () => {
      const res = await request("/auth/register", {
        method: "POST",
        body: { name: "Afif Secondary", email: emailB, password: "Password123!" },
      });
      assert.strictEqual(res.status, 201);
      userB = res.data;
      tokenB = res.data.token;
    });

    console.log("\n--- Scenario 2: Category Validation & Creation ---");
    await test("Reject category creation when name or type is missing", async () => {
      const res = await request("/categories", {
        method: "POST",
        body: { color: "#3F7259" },
      }, tokenA);
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /Name and type are required/i);
    });

    await test("Create custom expense category for User A", async () => {
      const res = await request("/categories", {
        method: "POST",
        body: { name: "Electronics & Gadgets", type: "expense", color: "#6366F1" },
      }, tokenA);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.name, "Electronics & Gadgets");
      assert.strictEqual(res.data.userId, userA._id);
      customCatA = res.data;
    });

    await test("Retrieve category list including default and custom categories", async () => {
      const res = await request("/categories", { method: "GET" }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data));
      const hasCustom = res.data.some((c) => c._id === customCatA._id);
      assert.strictEqual(hasCustom, true);
      defaultCat = res.data.find((c) => c.userId === null || c.userId === undefined) || res.data[0];
    });

    await test("Update custom category details", async () => {
      const res = await request(`/categories/${customCatA._id}`, {
        method: "PUT",
        body: { name: "Electronics & Gaming", color: "#4F46E5" },
      }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.name, "Electronics & Gaming");
      assert.strictEqual(res.data.color, "#4F46E5");
    });

    await test("Prevent User B from updating User A's custom category", async () => {
      const res = await request(`/categories/${customCatA._id}`, {
        method: "PUT",
        body: { name: "Hijacked Category" },
      }, tokenB);
      assert.strictEqual(res.status, 403);
      assert.match(res.data.message, /You can only edit your own custom categories/i);
    });

    console.log("\n--- Scenario 3: Transaction Validation & Creation ---");
    await test("Reject transaction creation when required fields are missing", async () => {
      const res = await request("/transactions", {
        method: "POST",
        body: { amount: 500 },
      }, tokenA);
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /Amount, type, and category are required/i);
    });

    await test("Reject transaction creation with non-existent category ID", async () => {
      const fakeCatId = new mongoose.Types.ObjectId();
      const res = await request("/transactions", {
        method: "POST",
        body: { amount: 500, type: "expense", category: fakeCatId },
      }, tokenA);
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /Selected category does not exist/i);
    });

    let txA1, txA2;
    await test("Create valid expense transaction with populated category", async () => {
      const res = await request("/transactions", {
        method: "POST",
        body: {
          amount: 2499,
          type: "expense",
          category: customCatA._id,
          description: "Mechanical Keyboard",
          date: "2026-10-12T10:00:00.000Z",
        },
      }, tokenA);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.amount, 2499);
      assert.strictEqual(res.data.category.name, "Electronics & Gaming");
      txA1 = res.data;
      createdTxIds.push(txA1._id);
    });

    await test("Create second transaction for filtering and pagination tests", async () => {
      const res = await request("/transactions", {
        method: "POST",
        body: {
          amount: 1500,
          type: "expense",
          category: customCatA._id,
          description: "Wireless Mouse",
          date: "2026-10-18T16:00:00.000Z",
        },
      }, tokenA);
      assert.strictEqual(res.status, 201);
      txA2 = res.data;
      createdTxIds.push(txA2._id);
    });

    console.log("\n--- Scenario 4: Query Filtering & Search ---");
    await test("Filter transactions by description search text (case-insensitive)", async () => {
      const res = await request("/transactions?search=keyboard", { method: "GET" }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.transactions.length, 1);
      assert.strictEqual(res.data.transactions[0].description, "Mechanical Keyboard");
    });

    await test("Filter transactions by month (YYYY-MM)", async () => {
      const res = await request("/transactions?month=2026-10", { method: "GET" }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.transactions.length, 2);
    });

    await test("Filter transactions by category ID", async () => {
      const res = await request(`/transactions?category=${customCatA._id}`, { method: "GET" }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.transactions.length, 2);
    });

    await test("Verify pagination limits and metadata", async () => {
      const res = await request("/transactions?page=1&limit=1", { method: "GET" }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.transactions.length, 1);
      assert.strictEqual(res.data.page, 1);
      assert.strictEqual(res.data.totalPages, 2);
      assert.strictEqual(res.data.total, 2);
    });

    console.log("\n--- Scenario 5: Update & Delete Authorization ---");
    await test("Update transaction amount and description", async () => {
      const res = await request(`/transactions/${txA1._id}`, {
        method: "PUT",
        body: { amount: 2299, description: "Mechanical Keyboard (Sale)" },
      }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.amount, 2299);
      assert.strictEqual(res.data.description, "Mechanical Keyboard (Sale)");
    });

    await test("Prevent User B from updating User A's transaction", async () => {
      const res = await request(`/transactions/${txA1._id}`, {
        method: "PUT",
        body: { amount: 1 },
      }, tokenB);
      assert.strictEqual(res.status, 403);
      assert.match(res.data.message, /Not authorized to edit this transaction/i);
    });

    await test("Prevent User B from deleting User A's transaction", async () => {
      const res = await request(`/transactions/${txA1._id}`, {
        method: "DELETE",
      }, tokenB);
      assert.strictEqual(res.status, 403);
      assert.match(res.data.message, /Not authorized to delete this transaction/i);
    });

    console.log("\n--- Scenario 6: Referential Integrity Protection ---");
    await test("Reject deletion of category that has existing transactions", async () => {
      const res = await request(`/categories/${customCatA._id}`, {
        method: "DELETE",
      }, tokenA);
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /Cannot delete a category that has transactions/i);
    });

    await test("Delete transactions, then successfully delete category", async () => {
      const del1 = await request(`/transactions/${txA1._id}`, { method: "DELETE" }, tokenA);
      assert.strictEqual(del1.status, 200);

      const del2 = await request(`/transactions/${txA2._id}`, { method: "DELETE" }, tokenA);
      assert.strictEqual(del2.status, 200);

      const delCat = await request(`/categories/${customCatA._id}`, { method: "DELETE" }, tokenA);
      assert.strictEqual(delCat.status, 200);
      assert.strictEqual(delCat.data.message, "Category deleted");
    });

    // Cleanup
    console.log("\n--- Cleanup: Removing test records ---");
    await safeDb(() => Transaction.deleteMany({ _id: { $in: createdTxIds } }));
    await safeDb(() => Category.deleteOne({ _id: customCatA._id }));
    await safeDb(() => User.deleteMany({ _id: { $in: [userA._id, userB._id] } }));
    console.log("Transaction test records cleaned up successfully.");

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

runTransactionCategoryTests();
