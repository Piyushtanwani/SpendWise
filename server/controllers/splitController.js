const SharedExpense = require("../models/SharedExpense");
const Settlement = require("../models/Settlement");
const Friendship = require("../models/Friendship");
const User = require("../models/User");
const Category = require("../models/Category");
const asyncHandler = require("../middleware/asyncHandler");

// Helper: 2-decimal currency rounding
const round2 = (val) => Math.round((Number(val) || 0) * 100) / 100;

// Helper: check if two users are accepted friends
const checkAcceptedFriendship = async (userId1, userId2) => {
  return await Friendship.findOne({
    status: "accepted",
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 },
    ],
  });
};

// Helper: calculate balances between a user and their friends
const computeUserBalances = async (userId) => {
  // 1. Get all accepted friends
  const friendships = await Friendship.find({
    status: "accepted",
    $or: [{ requester: userId }, { recipient: userId }],
  })
    .populate("requester", "_id name email currency")
    .populate("recipient", "_id name email currency");

  const friendsMap = {};
  const friendIds = [];

  friendships.forEach((f) => {
    const isRequester = f.requester._id.toString() === userId.toString();
    const friend = isRequester ? f.recipient : f.requester;
    const fId = friend._id.toString();

    friendsMap[fId] = {
      friend: {
        _id: friend._id,
        name: friend.name,
        email: friend.email,
        currency: friend.currency,
      },
      owedToUser: 0, // Friend owes current user
      userOwes: 0,   // Current user owes friend
    };
    friendIds.push(friend._id);
  });

  // 2. Fetch shared expenses where user is payer or participant
  const expenses = await SharedExpense.find({
    $or: [{ payer: userId }, { "splits.user": userId }],
  });

  expenses.forEach((expense) => {
    const payerId = expense.payer.toString();
    const isPayer = payerId === userId.toString();

    if (isPayer) {
      // Current user paid: friends in splits owe user their split amounts
      expense.splits.forEach((split) => {
        const participantId = split.user.toString();
        // Prevent counting user's own share as money owed
        if (participantId !== userId.toString() && friendsMap[participantId]) {
          friendsMap[participantId].owedToUser = round2(
            friendsMap[participantId].owedToUser + split.amount
          );
        }
      });
    } else {
      // Someone else paid: if payer is a friend, check how much current user owes
      if (friendsMap[payerId]) {
        const userSplit = expense.splits.find(
          (s) => s.user.toString() === userId.toString()
        );
        if (userSplit) {
          friendsMap[payerId].userOwes = round2(
            friendsMap[payerId].userOwes + userSplit.amount
          );
        }
      }
    }
  });

  // 3. Fetch confirmed settlements involving current user and friends
  const settlements = await Settlement.find({
    status: "confirmed",
    $or: [
      { sender: userId, recipient: { $in: friendIds } },
      { recipient: userId, sender: { $in: friendIds } },
    ],
  });

  settlements.forEach((settlement) => {
    const senderId = settlement.sender.toString();
    const recipientId = settlement.recipient.toString();

    if (senderId === userId.toString() && friendsMap[recipientId]) {
      // User repaid friend -> reduces what user owes friend
      friendsMap[recipientId].userOwes = round2(
        friendsMap[recipientId].userOwes - settlement.amount
      );
    } else if (recipientId === userId.toString() && friendsMap[senderId]) {
      // Friend repaid user -> reduces what friend owes user
      friendsMap[senderId].owedToUser = round2(
        friendsMap[senderId].owedToUser - settlement.amount
      );
    }
  });

  // 4. Compute net balances
  let totalOwedToUser = 0;
  let totalUserOwes = 0;

  const friendBalances = Object.values(friendsMap).map((item) => {
    // Net: positive = friend owes user; negative = user owes friend
    const net = round2(item.owedToUser - item.userOwes);

    if (net > 0) {
      totalOwedToUser = round2(totalOwedToUser + net);
    } else if (net < 0) {
      totalUserOwes = round2(totalUserOwes + Math.abs(net));
    }

    return {
      friend: item.friend,
      net,
      owedToUser: item.owedToUser > 0 ? item.owedToUser : 0,
      userOwes: item.userOwes > 0 ? item.userOwes : 0,
      status: net > 0 ? "owes_you" : net < 0 ? "you_owe" : "settled",
    };
  });

  return {
    totalOwedToUser: round2(totalOwedToUser),
    totalUserOwes: round2(totalUserOwes),
    netBalance: round2(totalOwedToUser - totalUserOwes),
    friends: friendBalances,
  };
};

// @desc    Get user's friend balances summary
// @route   GET /api/split/balances
// @access  Private
const getBalances = asyncHandler(async (req, res) => {
  const balances = await computeUserBalances(req.user._id);
  res.json(balances);
});

// @desc    Get balance breakdown with a specific friend
// @route   GET /api/split/balances/:friendId
// @access  Private
const getFriendBalance = asyncHandler(async (req, res) => {
  const { friendId } = req.params;

  const friend = await User.findById(friendId).select("_id name email currency");
  if (!friend) {
    res.status(404);
    throw new Error("Friend not found");
  }

  const balances = await computeUserBalances(req.user._id);
  const friendBalance = balances.friends.find(
    (f) => f.friend._id.toString() === friendId.toString()
  ) || {
    friend,
    net: 0,
    owedToUser: 0,
    userOwes: 0,
    status: "settled",
  };

  // Also fetch shared expenses between these two users
  const sharedExpenses = await SharedExpense.find({
    $and: [
      {
        $or: [
          { payer: req.user._id },
          { "splits.user": req.user._id },
        ],
      },
      {
        $or: [
          { payer: friendId },
          { "splits.user": friendId },
        ],
      },
    ],
  })
    .populate("payer", "_id name email")
    .populate("category", "name color")
    .sort({ date: -1, createdAt: -1 });

  // Fetch settlements between these two users
  const settlements = await Settlement.find({
    $or: [
      { sender: req.user._id, recipient: friendId },
      { sender: friendId, recipient: req.user._id },
    ],
  })
    .populate("sender", "_id name email")
    .populate("recipient", "_id name email")
    .sort({ date: -1, createdAt: -1 });

  res.json({
    balance: friendBalance,
    sharedExpenses,
    settlements,
  });
});

// @desc    Create a new shared expense
// @route   POST /api/split/expenses
// @access  Private
const createSharedExpense = asyncHandler(async (req, res) => {
  const {
    description,
    amount,
    date,
    category,
    payer,
    splitType = "equal",
    participants,
    splits: customSplits,
  } = req.body;

  if (!description || !amount) {
    res.status(400);
    throw new Error("Description and total amount are required");
  }

  const numAmount = round2(amount);
  if (numAmount <= 0) {
    res.status(400);
    throw new Error("Total amount must be greater than 0");
  }

  const payerId = payer || req.user._id.toString();

  // Validate category if provided
  if (category) {
    const cat = await Category.findById(category);
    if (!cat) {
      res.status(400);
      throw new Error("Specified category does not exist");
    }
  }

  let finalSplits = [];

  if (splitType === "equal") {
    if (!Array.isArray(participants) || participants.length < 2) {
      res.status(400);
      throw new Error("An equal split requires at least 2 participants");
    }

    // Ensure participants are unique
    const uniqueParticipants = [...new Set(participants.map((p) => p.toString()))];
    if (uniqueParticipants.length < 2) {
      res.status(400);
      throw new Error("Participants must be distinct users");
    }

    // Verify friendship with creator for each other participant
    for (const pId of uniqueParticipants) {
      if (pId !== req.user._id.toString()) {
        const isFriend = await checkAcceptedFriendship(req.user._id, pId);
        if (!isFriend) {
          res.status(400);
          throw new Error(
            `Participant ${pId} is not an accepted friend of the creator`
          );
        }
      }
    }

    // Ensure payer is among participants
    if (!uniqueParticipants.includes(payerId.toString())) {
      res.status(400);
      throw new Error("The payer must be one of the participants in the split");
    }

    // Calculate equal split with penny-exact precision
    const count = uniqueParticipants.length;
    const baseShare = Math.floor((numAmount * 100) / count) / 100;
    let remainder = round2(numAmount - baseShare * count);

    finalSplits = uniqueParticipants.map((pId) => {
      let share = baseShare;
      if (remainder > 0.005) {
        share = round2(share + 0.01);
        remainder = round2(remainder - 0.01);
      }
      return {
        user: pId,
        amount: share,
      };
    });
  } else if (splitType === "exact") {
    if (!Array.isArray(customSplits) || customSplits.length < 2) {
      res.status(400);
      throw new Error("Custom split requires at least 2 participant split shares");
    }

    const uniqueParticipants = [
      ...new Set(customSplits.map((s) => s.user.toString())),
    ];
    if (uniqueParticipants.length !== customSplits.length) {
      res.status(400);
      throw new Error("Duplicate participants in custom splits are not allowed");
    }

    // Check friendship and amount positivity
    let totalShares = 0;
    finalSplits = [];

    for (const s of customSplits) {
      const shareAmount = round2(s.amount);
      if (shareAmount < 0) {
        res.status(400);
        throw new Error("Participant split amount cannot be negative");
      }

      const pId = s.user.toString();
      if (pId !== req.user._id.toString()) {
        const isFriend = await checkAcceptedFriendship(req.user._id, pId);
        if (!isFriend) {
          res.status(400);
          throw new Error(
            `Participant ${pId} is not an accepted friend of the creator`
          );
        }
      }

      totalShares = round2(totalShares + shareAmount);
      finalSplits.push({
        user: pId,
        amount: shareAmount,
      });
    }

    // Ensure shares sum exactly to total amount
    if (Math.abs(totalShares - numAmount) > 0.009) {
      res.status(400);
      throw new Error(
        `Custom shares total (${totalShares}) does not match the expense amount (${numAmount})`
      );
    }

    // Ensure payer is in participants
    if (!uniqueParticipants.includes(payerId.toString())) {
      res.status(400);
      throw new Error("The payer must be one of the participants");
    }
  } else {
    res.status(400);
    throw new Error("Invalid splitType. Must be 'equal' or 'exact'");
  }

  // Prevent duplicate creation from retried network requests within 30 seconds
  const recentDuplicate = await SharedExpense.findOne({
    creator: req.user._id,
    description: description.trim(),
    amount: numAmount,
    createdAt: { $gte: new Date(Date.now() - 30000) },
  }).populate([
    { path: "creator", select: "_id name email" },
    { path: "payer", select: "_id name email" },
    { path: "splits.user", select: "_id name email" },
    { path: "category", select: "_id name color type" },
  ]);

  if (recentDuplicate) {
    return res.status(201).json(recentDuplicate);
  }

  const sharedExpense = await SharedExpense.create({
    creator: req.user._id,
    payer: payerId,
    description: description.trim(),
    amount: numAmount,
    date: date || Date.now(),
    category: category || null,
    splitType,
    splits: finalSplits,
  });

  const populated = await sharedExpense.populate([
    { path: "creator", select: "_id name email" },
    { path: "payer", select: "_id name email" },
    { path: "splits.user", select: "_id name email" },
    { path: "category", select: "_id name color type" },
  ]);

  res.status(201).json(populated);
});

// @desc    Get shared expenses for logged-in user
// @route   GET /api/split/expenses?friendId=&page=&limit=
// @access  Private
const getSharedExpenses = asyncHandler(async (req, res) => {
  const { friendId } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  const filter = {
    $or: [{ payer: req.user._id }, { "splits.user": req.user._id }],
  };

  if (friendId) {
    filter.$and = [
      {
        $or: [{ payer: req.user._id }, { "splits.user": req.user._id }],
      },
      {
        $or: [{ payer: friendId }, { "splits.user": friendId }],
      },
    ];
  }

  const [expenses, total] = await Promise.all([
    SharedExpense.find(filter)
      .populate("creator", "_id name email")
      .populate("payer", "_id name email")
      .populate("splits.user", "_id name email")
      .populate("category", "_id name color type")
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    SharedExpense.countDocuments(filter),
  ]);

  res.json({
    expenses,
    page,
    totalPages: Math.ceil(total / limit),
    total,
  });
});

// @desc    Get single shared expense by ID
// @route   GET /api/split/expenses/:id
// @access  Private
const getSharedExpenseById = asyncHandler(async (req, res) => {
  const expense = await SharedExpense.findById(req.params.id);

  if (!expense) {
    res.status(404);
    throw new Error("Shared expense not found");
  }

  // Authorization check: User must be creator, payer, or participant
  const isParticipant =
    (expense.creator._id || expense.creator).toString() === req.user._id.toString() ||
    (expense.payer._id || expense.payer).toString() === req.user._id.toString() ||
    expense.splits.some(
      (s) => (s.user._id || s.user).toString() === req.user._id.toString()
    );

  if (!isParticipant) {
    res.status(403);
    throw new Error("Not authorized to view this shared expense");
  }

  const populated = await expense.populate([
    { path: "creator", select: "_id name email" },
    { path: "payer", select: "_id name email" },
    { path: "splits.user", select: "_id name email" },
    { path: "category", select: "_id name color type" },
  ]);

  res.json(populated);
});

// @desc    Update a shared expense
// @route   PUT /api/split/expenses/:id
// @access  Private
const updateSharedExpense = asyncHandler(async (req, res) => {
  const expense = await SharedExpense.findById(req.params.id);

  if (!expense) {
    res.status(404);
    throw new Error("Shared expense not found");
  }

  // Only creator or payer can edit
  const isAuthorized =
    expense.creator.toString() === req.user._id.toString() ||
    expense.payer.toString() === req.user._id.toString();

  if (!isAuthorized) {
    res.status(403);
    throw new Error("Not authorized to update this shared expense");
  }

  const {
    description,
    amount,
    date,
    category,
    payer,
    splitType,
    participants,
    splits: customSplits,
  } = req.body;

  const numAmount = amount !== undefined ? round2(amount) : expense.amount;
  if (numAmount <= 0) {
    res.status(400);
    throw new Error("Total amount must be greater than 0");
  }

  const effectivePayer = payer || expense.payer.toString();
  const effectiveSplitType = splitType || expense.splitType;

  if (category !== undefined) {
    if (category) {
      const cat = await Category.findById(category);
      if (!cat) {
        res.status(400);
        throw new Error("Specified category does not exist");
      }
      expense.category = category;
    } else {
      expense.category = null;
    }
  }

  if (description !== undefined) expense.description = description.trim();
  if (date !== undefined) expense.date = date;
  expense.amount = numAmount;
  expense.payer = effectivePayer;
  expense.splitType = effectiveSplitType;

  if (participants || customSplits) {
    let finalSplits = [];
    if (effectiveSplitType === "equal") {
      const parts = participants || expense.splits.map((s) => s.user.toString());
      const uniqueParticipants = [...new Set(parts.map((p) => p.toString()))];

      if (uniqueParticipants.length < 2) {
        res.status(400);
        throw new Error("An equal split requires at least 2 participants");
      }

      for (const pId of uniqueParticipants) {
        if (pId !== req.user._id.toString()) {
          const isFriend = await checkAcceptedFriendship(req.user._id, pId);
          if (!isFriend) {
            res.status(400);
            throw new Error(`Participant ${pId} is not an accepted friend`);
          }
        }
      }

      if (!uniqueParticipants.includes(effectivePayer.toString())) {
        res.status(400);
        throw new Error("Payer must be one of the participants");
      }

      const count = uniqueParticipants.length;
      const baseShare = Math.floor((numAmount * 100) / count) / 100;
      let remainder = round2(numAmount - baseShare * count);

      finalSplits = uniqueParticipants.map((pId) => {
        let share = baseShare;
        if (remainder > 0.005) {
          share = round2(share + 0.01);
          remainder = round2(remainder - 0.01);
        }
        return { user: pId, amount: share };
      });
    } else if (effectiveSplitType === "exact") {
      const splitsToUse = customSplits || expense.splits;
      if (!Array.isArray(splitsToUse) || splitsToUse.length < 2) {
        res.status(400);
        throw new Error("Custom split requires at least 2 participants");
      }

      let totalShares = 0;
      finalSplits = [];
      const uniqueParticipants = [];

      for (const s of splitsToUse) {
        const shareAmount = round2(s.amount);
        if (shareAmount < 0) {
          res.status(400);
          throw new Error("Participant split amount cannot be negative");
        }

        const pId = (s.user._id || s.user).toString();
        if (uniqueParticipants.includes(pId)) {
          res.status(400);
          throw new Error("Duplicate participants in custom splits are not allowed");
        }
        uniqueParticipants.push(pId);

        if (pId !== req.user._id.toString()) {
          const isFriend = await checkAcceptedFriendship(req.user._id, pId);
          if (!isFriend) {
            res.status(400);
            throw new Error(`Participant ${pId} is not an accepted friend`);
          }
        }

        totalShares = round2(totalShares + shareAmount);
        finalSplits.push({ user: pId, amount: shareAmount });
      }

      if (Math.abs(totalShares - numAmount) > 0.009) {
        res.status(400);
        throw new Error(
          `Custom shares total (${totalShares}) does not match expense amount (${numAmount})`
        );
      }

      if (!uniqueParticipants.includes(effectivePayer.toString())) {
        res.status(400);
        throw new Error("The payer must be one of the participants");
      }
    }
    expense.splits = finalSplits;
  }

  await expense.save();

  const populated = await expense.populate([
    { path: "creator", select: "_id name email" },
    { path: "payer", select: "_id name email" },
    { path: "splits.user", select: "_id name email" },
    { path: "category", select: "_id name color type" },
  ]);

  res.json(populated);
});

// @desc    Delete a shared expense
// @route   DELETE /api/split/expenses/:id
// @access  Private
const deleteSharedExpense = asyncHandler(async (req, res) => {
  const expense = await SharedExpense.findById(req.params.id);

  if (!expense) {
    res.status(404);
    throw new Error("Shared expense not found");
  }

  // Authorization check: Only creator or payer can delete
  const isAuthorized =
    expense.creator.toString() === req.user._id.toString() ||
    expense.payer.toString() === req.user._id.toString();

  if (!isAuthorized) {
    res.status(403);
    throw new Error("Not authorized to delete this shared expense");
  }

  await expense.deleteOne();
  res.json({ message: "Shared expense deleted successfully" });
});

// @desc    Record a settlement repayment (bidirectional: you paid friend or friend paid you)
// @route   POST /api/split/settlements
// @access  Private
const createSettlement = asyncHandler(async (req, res) => {
  const { recipientId, friendId: rawFriendId, payerDirection, amount, date, note } = req.body;
  const friendId = rawFriendId || recipientId;

  if (!friendId || !amount) {
    res.status(400);
    throw new Error("Friend and repayment amount are required");
  }

  const numAmount = round2(amount);
  if (numAmount <= 0) {
    res.status(400);
    throw new Error("Settlement amount must be greater than 0");
  }

  if (friendId.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error("You cannot record a settlement with yourself");
  }

  // Validate that friend is an accepted friend
  const isFriend = await checkAcceptedFriendship(req.user._id, friendId);
  if (!isFriend) {
    res.status(400);
    throw new Error("Specified user is not an accepted friend");
  }

  // Check balances between user and this friend
  const balances = await computeUserBalances(req.user._id);
  const friendBalance = balances.friends.find(
    (f) => f.friend._id.toString() === friendId.toString()
  );

  const net = friendBalance ? round2(friendBalance.net) : 0;

  // Determine direction: "you_paid" (user paid friend) or "friend_paid" (friend paid user)
  let direction = payerDirection;
  if (!direction) {
    if (net < 0) {
      direction = "you_paid";
    } else if (net > 0) {
      direction = "friend_paid";
    } else {
      direction = "you_paid"; // Will fail debt check below with clear message
    }
  }

  let senderId;
  let recipientIdFinal;
  let maxAllowedDebt = 0;
  let settlementStatus = "pending";
  let confirmedAt = null;

  if (direction === "friend_paid") {
    // Friend paid current user (repaying what friend owes user)
    maxAllowedDebt = net > 0 ? net : 0;
    if (maxAllowedDebt <= 0) {
      res.status(400);
      throw new Error("This friend does not have an outstanding debt with you to settle");
    }
    if (numAmount > round2(maxAllowedDebt + 0.01)) {
      res.status(400);
      throw new Error(
        `Repayment amount (${numAmount}) exceeds friend's outstanding debt (${maxAllowedDebt})`
      );
    }
    senderId = friendId;
    recipientIdFinal = req.user._id;
    // Creditor is logging receipt of money, so it's immediately confirmed
    settlementStatus = "confirmed";
    confirmedAt = new Date();
  } else {
    // Current user paid friend (repaying what user owes friend)
    maxAllowedDebt = net < 0 ? Math.abs(net) : 0;
    if (maxAllowedDebt <= 0) {
      res.status(400);
      throw new Error("You do not have an outstanding debt with this friend to settle");
    }
    if (numAmount > round2(maxAllowedDebt + 0.01)) {
      res.status(400);
      throw new Error(
        `Repayment amount (${numAmount}) exceeds your outstanding balance (${maxAllowedDebt})`
      );
    }
    senderId = req.user._id;
    recipientIdFinal = friendId;
    // Pending until friend confirms receipt
    settlementStatus = "pending";
    confirmedAt = null;
  }

  // Prevent duplicate settlement from retried network requests within 30 seconds
  const recentDuplicateSettlement = await Settlement.findOne({
    sender: senderId,
    recipient: recipientIdFinal,
    amount: numAmount,
    createdAt: { $gte: new Date(Date.now() - 30000) },
  }).populate([
    { path: "sender", select: "_id name email" },
    { path: "recipient", select: "_id name email" },
  ]);

  if (recentDuplicateSettlement) {
    return res.status(201).json({
      message:
        settlementStatus === "confirmed"
          ? "Repayment recorded and confirmed! Balances updated."
          : "Settlement recorded as pending. It must be confirmed by the recipient to update balances. (This records repayment records and does not transfer real funds.)",
      settlement: recentDuplicateSettlement,
    });
  }

  const settlement = await Settlement.create({
    sender: senderId,
    recipient: recipientIdFinal,
    amount: numAmount,
    date: date || Date.now(),
    note: note ? note.trim() : "",
    status: settlementStatus,
    confirmedAt,
  });

  const populated = await settlement.populate([
    { path: "sender", select: "_id name email" },
    { path: "recipient", select: "_id name email" },
  ]);

  res.status(201).json({
    message:
      settlementStatus === "confirmed"
        ? "Repayment recorded and confirmed! Balances updated."
        : "Settlement recorded as pending. It must be confirmed by the recipient to update balances. (This records repayment records and does not transfer real funds.)",
    settlement: populated,
  });
});

// @desc    Get user's settlements (sent & received)
// @route   GET /api/split/settlements
// @access  Private
const getSettlements = asyncHandler(async (req, res) => {
  const settlements = await Settlement.find({
    $or: [{ sender: req.user._id }, { recipient: req.user._id }],
  })
    .populate("sender", "_id name email")
    .populate("recipient", "_id name email")
    .sort({ date: -1, createdAt: -1 });

  res.json(settlements);
});

// @desc    Confirm a settlement repayment (recipient only)
// @route   PUT /api/split/settlements/:id/confirm
// @access  Private
const confirmSettlement = asyncHandler(async (req, res) => {
  const settlement = await Settlement.findById(req.params.id);

  if (!settlement) {
    res.status(404);
    throw new Error("Settlement not found");
  }

  // Authorization check: Only the recipient can confirm receipt of repayment
  if (settlement.recipient.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error(
      "Not authorized. Only the repayment recipient can confirm this settlement"
    );
  }

  if (settlement.status !== "pending") {
    res.status(400);
    throw new Error(`This settlement has already been ${settlement.status}`);
  }

  settlement.status = "confirmed";
  settlement.confirmedAt = new Date();
  await settlement.save();

  const populated = await settlement.populate([
    { path: "sender", select: "_id name email" },
    { path: "recipient", select: "_id name email" },
  ]);

  res.json({
    message: "Settlement confirmed. Balances have been updated.",
    settlement: populated,
  });
});

// @desc    Reject a settlement repayment (recipient only)
// @route   PUT /api/split/settlements/:id/reject
// @access  Private
const rejectSettlement = asyncHandler(async (req, res) => {
  const settlement = await Settlement.findById(req.params.id);

  if (!settlement) {
    res.status(404);
    throw new Error("Settlement not found");
  }

  // Authorization check: Only recipient can reject
  if (settlement.recipient.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error(
      "Not authorized. Only the repayment recipient can reject this settlement"
    );
  }

  if (settlement.status !== "pending") {
    res.status(400);
    throw new Error(`This settlement has already been ${settlement.status}`);
  }

  settlement.status = "rejected";
  await settlement.save();

  const populated = await settlement.populate([
    { path: "sender", select: "_id name email" },
    { path: "recipient", select: "_id name email" },
  ]);

  res.json({
    message: "Settlement rejected.",
    settlement: populated,
  });
});

// @desc    Cancel a pending settlement (sender only)
// @route   DELETE /api/split/settlements/:id
// @access  Private
const deleteSettlement = asyncHandler(async (req, res) => {
  const settlement = await Settlement.findById(req.params.id);

  if (!settlement) {
    res.status(404);
    throw new Error("Settlement not found");
  }

  if (settlement.sender.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to cancel this settlement");
  }

  if (settlement.status !== "pending") {
    res.status(400);
    throw new Error("Cannot cancel a settlement that is not pending");
  }

  await settlement.deleteOne();
  res.json({ message: "Pending settlement cancelled successfully" });
});

module.exports = {
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
  computeUserBalances,
};
