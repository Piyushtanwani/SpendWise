const User = require("../models/User");
const Friendship = require("../models/Friendship");
const asyncHandler = require("../middleware/asyncHandler");

// Helper: check if two users are accepted friends
const areFriends = async (userId1, userId2) => {
  const friendship = await Friendship.findOne({
    status: "accepted",
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 },
    ],
  });
  return !!friendship;
};

// @desc    Search users by name or email (or list suggested users if query is empty)
// @route   GET /api/friends/search?query=...
// @access  Private
const searchUsers = asyncHandler(async (req, res) => {
  const { query } = req.query;

  const filter = {
    _id: { $ne: req.user._id },
  };

  if (query && query.trim().length > 0) {
    const cleanQuery = query.trim();
    filter.$or = [
      { email: { $regex: cleanQuery, $options: "i" } },
      { name: { $regex: cleanQuery, $options: "i" } },
    ];
  }

  // Find matching users, excluding current user
  const users = await User.find(filter)
    .select("_id name email currency")
    .sort({ createdAt: -1 })
    .limit(20);

  // Find all existing friendships between current user and matching users
  const userIds = users.map((u) => u._id);
  const friendships = await Friendship.find({
    $or: [
      { requester: req.user._id, recipient: { $in: userIds } },
      { requester: { $in: userIds }, recipient: req.user._id },
    ],
  });

  const friendshipMap = {};
  friendships.forEach((f) => {
    const otherId =
      f.requester.toString() === req.user._id.toString()
        ? f.recipient.toString()
        : f.requester.toString();

    let relationship = f.status;
    if (f.status === "pending") {
      relationship =
        f.requester.toString() === req.user._id.toString()
          ? "pending_outgoing"
          : "pending_incoming";
    }

    friendshipMap[otherId] = {
      friendshipId: f._id,
      relationship,
    };
  });

  const results = users.map((u) => {
    const fInfo = friendshipMap[u._id.toString()];
    return {
      _id: u._id,
      name: u.name,
      email: u.email,
      currency: u.currency,
      relationship: fInfo ? fInfo.relationship : "none",
      friendshipId: fInfo ? fInfo.friendshipId : null,
    };
  });

  res.json(results);
});

// @desc    Get all accepted friends
// @route   GET /api/friends
// @access  Private
const getFriends = asyncHandler(async (req, res) => {
  const friendships = await Friendship.find({
    status: "accepted",
    $or: [{ requester: req.user._id }, { recipient: req.user._id }],
  })
    .populate("requester", "_id name email currency")
    .populate("recipient", "_id name email currency")
    .sort({ updatedAt: -1 });

  const friends = friendships.map((f) => {
    const isRequester = f.requester._id.toString() === req.user._id.toString();
    const friend = isRequester ? f.recipient : f.requester;
    return {
      friendshipId: f._id,
      friend,
      establishedAt: f.updatedAt,
    };
  });

  res.json(friends);
});

// @desc    Get pending friend requests (incoming & outgoing)
// @route   GET /api/friends/requests
// @access  Private
const getFriendRequests = asyncHandler(async (req, res) => {
  const [incoming, outgoing] = await Promise.all([
    Friendship.find({
      recipient: req.user._id,
      status: "pending",
    })
      .populate("requester", "_id name email currency")
      .sort({ createdAt: -1 }),
    Friendship.find({
      requester: req.user._id,
      status: "pending",
    })
      .populate("recipient", "_id name email currency")
      .sort({ createdAt: -1 }),
  ]);

  res.json({ incoming, outgoing });
});

// @desc    Send a friend request
// @route   POST /api/friends/request
// @access  Private
const sendFriendRequest = asyncHandler(async (req, res) => {
  const { recipientId, email } = req.body;

  let targetUser;
  if (recipientId) {
    targetUser = await User.findById(recipientId).select("_id name email currency");
  } else if (email) {
    targetUser = await User.findOne({ email: email.toLowerCase().trim() }).select("_id name email currency");
  }

  if (!targetUser) {
    res.status(404);
    throw new Error("User not found");
  }

  if (targetUser._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error("You cannot send a friend request to yourself");
  }

  // Check if a friendship record already exists in either direction
  const existing = await Friendship.findOne({
    $or: [
      { requester: req.user._id, recipient: targetUser._id },
      { requester: targetUser._id, recipient: req.user._id },
    ],
  });

  if (existing) {
    if (existing.status === "accepted") {
      res.status(400);
      throw new Error("You are already friends with this user");
    }

    if (existing.status === "pending") {
      if (existing.requester.toString() === req.user._id.toString()) {
        res.status(400);
        throw new Error("Friend request has already been sent to this user");
      } else {
        res.status(400);
        throw new Error("This user has already sent you a friend request. Please check your incoming requests.");
      }
    }

    // If previously rejected, allow re-requesting by updating the existing record
    if (existing.status === "rejected") {
      existing.requester = req.user._id;
      existing.recipient = targetUser._id;
      existing.status = "pending";
      await existing.save();

      const populated = await existing.populate("recipient", "_id name email currency");
      return res.status(200).json({
        message: "Friend request sent",
        friendship: populated,
      });
    }
  }

  const friendship = await Friendship.create({
    requester: req.user._id,
    recipient: targetUser._id,
    status: "pending",
  });

  const populated = await friendship.populate("recipient", "_id name email currency");
  res.status(201).json({
    message: "Friend request sent",
    friendship: populated,
  });
});

// @desc    Respond to friend request (accept or reject)
// @route   PUT /api/friends/requests/:id
// @access  Private
const respondToFriendRequest = asyncHandler(async (req, res) => {
  const { action } = req.body;

  if (!["accept", "reject"].includes(action)) {
    res.status(400);
    throw new Error("Invalid action. Must be 'accept' or 'reject'");
  }

  const friendship = await Friendship.findById(req.params.id);

  if (!friendship) {
    res.status(404);
    throw new Error("Friend request not found");
  }

  // Authorization check: Only the recipient can accept or reject an incoming request
  if (friendship.recipient.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to respond to this friend request");
  }

  if (friendship.status !== "pending") {
    const expectedStatus = action === "accept" ? "accepted" : "rejected";
    if (friendship.status === expectedStatus) {
      const populated = await friendship.populate([
        { path: "requester", select: "_id name email currency" },
        { path: "recipient", select: "_id name email currency" },
      ]);
      return res.json({
        message: `Friend request ${friendship.status}`,
        friendship: populated,
      });
    }
    res.status(400);
    throw new Error(`This request has already been ${friendship.status}`);
  }

  friendship.status = action === "accept" ? "accepted" : "rejected";
  await friendship.save();

  const populated = await friendship.populate([
    { path: "requester", select: "_id name email currency" },
    { path: "recipient", select: "_id name email currency" },
  ]);

  res.json({
    message: `Friend request ${friendship.status}`,
    friendship: populated,
  });
});

// @desc    Remove friend or cancel request
// @route   DELETE /api/friends/:id
// @access  Private
const removeFriend = asyncHandler(async (req, res) => {
  const friendship = await Friendship.findById(req.params.id);

  if (!friendship) {
    res.status(404);
    throw new Error("Friendship record not found");
  }

  // Only participants can remove/cancel
  const isParticipant =
    friendship.requester.toString() === req.user._id.toString() ||
    friendship.recipient.toString() === req.user._id.toString();

  if (!isParticipant) {
    res.status(403);
    throw new Error("Not authorized to remove this friendship");
  }

  await friendship.deleteOne();
  res.json({ message: "Friendship removed successfully" });
});

module.exports = {
  searchUsers,
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  areFriends,
};
