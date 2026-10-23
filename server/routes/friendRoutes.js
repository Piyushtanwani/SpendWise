const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  searchUsers,
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
} = require("../controllers/friendController");

router.use(protect);

router.get("/search", searchUsers);
router.get("/", getFriends);
router.get("/requests", getFriendRequests);
router.post("/request", sendFriendRequest);
router.put("/requests/:id", respondToFriendRequest);
router.delete("/:id", removeFriend);

module.exports = router;
