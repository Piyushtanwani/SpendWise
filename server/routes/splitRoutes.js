const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getBalances,
  getFriendBalance,
  createSharedExpense,
  getSharedExpenses,
  getSharedExpenseById,
  updateSharedExpense,
  deleteSharedExpense,
  createSettlement,
  getSettlements,
  confirmSettlement,
  rejectSettlement,
  deleteSettlement,
} = require("../controllers/splitController");

router.use(protect);

// Balances
router.get("/balances", getBalances);
router.get("/balances/:friendId", getFriendBalance);

// Shared expenses
router.post("/expenses", createSharedExpense);
router.get("/expenses", getSharedExpenses);
router.get("/expenses/:id", getSharedExpenseById);
router.put("/expenses/:id", updateSharedExpense);
router.delete("/expenses/:id", deleteSharedExpense);

// Settlements
router.post("/settlements", createSettlement);
router.get("/settlements", getSettlements);
router.put("/settlements/:id/confirm", confirmSettlement);
router.put("/settlements/:id/reject", rejectSettlement);
router.delete("/settlements/:id", deleteSettlement);

module.exports = router;
