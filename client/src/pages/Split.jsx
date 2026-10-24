import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import Layout from "../components/Layout";
import { formatCurrency } from "../utils/format";
import {
  Users,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Search,
  UserPlus,
  Trash2,
  Info,
  ChevronRight,
  Receipt,
  Scale,
  RefreshCw,
} from "lucide-react";

const Split = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("expenses"); // expenses | friends | settlements | requests

  // Data states
  const [balances, setBalances] = useState({
    totalOwedToUser: 0,
    totalUserOwes: 0,
    netBalance: 0,
    friends: [],
  });
  const [expenses, setExpenses] = useState([]);
  const [friends, setFriends] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search user state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    category: "",
    payer: "",
    splitType: "equal", // equal | exact
    selectedParticipants: [], // array of userIds
    customShares: {}, // userId -> amount
  });
  const [expenseError, setExpenseError] = useState("");
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Settle form state
  const [settleForm, setSettleForm] = useState({
    recipientId: "",
    payerDirection: "you_paid", // "you_paid" | "friend_paid"
    amount: "",
    date: new Date().toISOString().split("T")[0],
    note: "",
  });
  const [settleError, setSettleError] = useState("");
  const [submittingSettle, setSubmittingSettle] = useState(false);

  // Action message feedback
  const [feedback, setFeedback] = useState(null);

  const showFeedback = (msg, type = "success") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Load all data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [balRes, expRes, friendsRes, settRes, catRes, reqRes] =
        await Promise.all([
          api.get("/split/balances"),
          api.get("/split/expenses"),
          api.get("/friends"),
          api.get("/split/settlements"),
          api.get("/categories"),
          api.get("/friends/requests"),
        ]);

      setBalances(balRes.data);
      setExpenses(expRes.data.expenses || []);
      setFriends(friendsRes.data || []);
      setSettlements(settRes.data || []);
      setCategories(catRes.data || []);
      setIncomingRequests(reqRes.data.incoming || []);
      setOutgoingRequests(reqRes.data.outgoing || []);
    } catch (err) {
      console.error("Error loading Split data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle User Search (auto-loads registered users when modal opens, filters as user types)
  useEffect(() => {
    if (!isAddFriendModalOpen) return;

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const q = searchQuery.trim();
        const url = q
          ? `/friends/search?query=${encodeURIComponent(q)}`
          : "/friends/search";
        const { data } = await api.get(url);
        setSearchResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, searchQuery ? 300 : 0);

    return () => clearTimeout(timer);
  }, [searchQuery, isAddFriendModalOpen]);

  // Handle Send Friend Request
  const handleSendFriendRequest = async (recipientId) => {
    try {
      await api.post("/friends/request", { recipientId });
      showFeedback("Friend request sent successfully!");
      // Refresh search results
      if (searchQuery) {
        const { data } = await api.get(`/friends/search?query=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data);
      }
      fetchData();
    } catch (err) {
      showFeedback(err.response?.data?.message || "Failed to send request", "error");
    }
  };

  // Handle Accept/Reject Friend Request
  const handleRespondRequest = async (id, action) => {
    try {
      await api.put(`/friends/requests/${id}`, { action });
      showFeedback(`Friend request ${action}ed`);
      fetchData();
    } catch (err) {
      showFeedback(err.response?.data?.message || `Failed to ${action} request`, "error");
    }
  };

  // Open Expense Modal
  const openCreateExpenseModal = (expenseToEdit = null) => {
    setExpenseError("");
    if (expenseToEdit) {
      setEditingExpense(expenseToEdit);
      const participantIds = expenseToEdit.splits.map((s) => s.user._id || s.user);
      const customShares = {};
      expenseToEdit.splits.forEach((s) => {
        customShares[s.user._id || s.user] = s.amount;
      });

      setExpenseForm({
        description: expenseToEdit.description,
        amount: expenseToEdit.amount,
        date: new Date(expenseToEdit.date).toISOString().split("T")[0],
        category: expenseToEdit.category?._id || expenseToEdit.category || "",
        payer: expenseToEdit.payer?._id || expenseToEdit.payer,
        splitType: expenseToEdit.splitType || "equal",
        selectedParticipants: participantIds,
        customShares,
      });
    } else {
      setEditingExpense(null);
      // Default participants: current user + first friend if available
      const defaultParticipants = [user?._id];
      if (friends.length > 0) {
        defaultParticipants.push(friends[0].friend._id);
      }
      setExpenseForm({
        description: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        category: "",
        payer: user?._id || "",
        splitType: "equal",
        selectedParticipants: defaultParticipants,
        customShares: {},
      });
    }
    setIsExpenseModalOpen(true);
  };

  // Handle Participant Toggle in Expense Form
  const toggleParticipant = (userId) => {
    setExpenseForm((prev) => {
      const exists = prev.selectedParticipants.includes(userId);
      let updated;
      if (exists) {
        // Can't remove if only 2 remain
        if (prev.selectedParticipants.length <= 2) return prev;
        updated = prev.selectedParticipants.filter((id) => id !== userId);
      } else {
        updated = [...prev.selectedParticipants, userId];
      }
      // If payer was removed, reset payer to current user
      let nextPayer = prev.payer;
      if (!updated.includes(nextPayer)) {
        nextPayer = user?._id;
      }
      return { ...prev, selectedParticipants: updated, payer: nextPayer };
    });
  };

  // Expense form calculated splits
  const calculatedSplits = useMemo(() => {
    const total = parseFloat(expenseForm.amount) || 0;
    const count = expenseForm.selectedParticipants.length;
    if (total <= 0 || count < 2) return [];

    if (expenseForm.splitType === "equal") {
      const baseShare = Math.floor((total * 100) / count) / 100;
      let remainder = Math.round((total - baseShare * count) * 100) / 100;
      return expenseForm.selectedParticipants.map((pId) => {
        let share = baseShare;
        if (remainder > 0.005) {
          share = Math.round((share + 0.01) * 100) / 100;
          remainder = Math.round((remainder - 0.01) * 100) / 100;
        }
        return { userId: pId, amount: share };
      });
    } else {
      return expenseForm.selectedParticipants.map((pId) => ({
        userId: pId,
        amount: parseFloat(expenseForm.customShares[pId]) || 0,
      }));
    }
  }, [
    expenseForm.amount,
    expenseForm.selectedParticipants,
    expenseForm.splitType,
    expenseForm.customShares,
  ]);

  const customTotal = useMemo(() => {
    if (expenseForm.splitType !== "exact") return 0;
    return Object.values(expenseForm.customShares).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
  }, [expenseForm.splitType, expenseForm.customShares]);

  // Submit Expense
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    setExpenseError("");

    const totalAmt = parseFloat(expenseForm.amount);
    if (!totalAmt || totalAmt <= 0) {
      setExpenseError("Please enter a valid positive amount.");
      return;
    }
    if (expenseForm.selectedParticipants.length < 2) {
      setExpenseError("Please select at least 2 participants.");
      return;
    }

    if (expenseForm.splitType === "exact") {
      const diff = Math.abs(customTotal - totalAmt);
      if (diff > 0.01) {
        setExpenseError(
          `Custom shares sum (${formatCurrency(customTotal, user?.currency)}) must match total amount (${formatCurrency(totalAmt, user?.currency)}).`
        );
        return;
      }
    }

    setSubmittingExpense(true);
    try {
      const payload = {
        description: expenseForm.description,
        amount: totalAmt,
        date: expenseForm.date,
        category: expenseForm.category || undefined,
        payer: expenseForm.payer || user?._id,
        splitType: expenseForm.splitType,
        participants: expenseForm.selectedParticipants,
      };

      if (expenseForm.splitType === "exact") {
        payload.splits = expenseForm.selectedParticipants.map((pId) => ({
          user: pId,
          amount: parseFloat(expenseForm.customShares[pId]) || 0,
        }));
      }

      if (editingExpense) {
        await api.put(`/split/expenses/${editingExpense._id}`, payload);
        showFeedback("Shared expense updated successfully!");
      } else {
        await api.post("/split/expenses", payload);
        showFeedback("Shared expense created successfully!");
      }

      setIsExpenseModalOpen(false);
      fetchData();
    } catch (err) {
      setExpenseError(
        err.response?.data?.message || "Failed to save shared expense."
      );
    } finally {
      setSubmittingExpense(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this shared expense?"))
      return;
    try {
      await api.delete(`/split/expenses/${id}`);
      showFeedback("Shared expense deleted.");
      fetchData();
    } catch (err) {
      showFeedback(
        err.response?.data?.message || "Failed to delete expense.",
        "error"
      );
    }
  };

  // Open Settle Modal
  const openSettleModal = (friend = null) => {
    setSettleError("");
    // Find target friend: prefer friend with active debt (you owe or they owe), or first friend
    const targetFriend =
      friend ||
      balances.friends.find((f) => f.net < 0) ||
      balances.friends.find((f) => f.net > 0) ||
      balances.friends[0];

    const isFriendOwing = targetFriend && targetFriend.net > 0;
    const isUserOwing = targetFriend && targetFriend.net < 0;
    const defaultDirection = isFriendOwing ? "friend_paid" : "you_paid";
    const defaultAmount = isFriendOwing
      ? targetFriend.net.toString()
      : isUserOwing
      ? Math.abs(targetFriend.net).toString()
      : "";

    setSettleForm({
      recipientId: targetFriend ? targetFriend.friend._id : "",
      payerDirection: defaultDirection,
      amount: defaultAmount,
      date: new Date().toISOString().split("T")[0],
      note: "",
    });
    setIsSettleModalOpen(true);
  };

  // Submit Settle Up
  const handleSaveSettlement = async (e) => {
    e.preventDefault();
    setSettleError("");

    const amt = parseFloat(settleForm.amount);
    if (!amt || amt <= 0) {
      setSettleError("Please enter a valid repayment amount.");
      return;
    }
    if (!settleForm.recipientId) {
      setSettleError("Please select the friend you are settling with.");
      return;
    }

    setSubmittingSettle(true);
    try {
      const res = await api.post("/split/settlements", {
        recipientId: settleForm.recipientId,
        payerDirection: settleForm.payerDirection,
        amount: amt,
        date: settleForm.date,
        note: settleForm.note,
      });

      showFeedback(
        res.data?.message ||
          (settleForm.payerDirection === "friend_paid"
            ? "Payment received recorded! Balances updated."
            : "Repayment recorded! Waiting for recipient friend to confirm receipt.")
      );
      setIsSettleModalOpen(false);
      fetchData();
    } catch (err) {
      setSettleError(
        err.response?.data?.message || "Failed to record settlement."
      );
    } finally {
      setSubmittingSettle(false);
    }
  };

  // Confirm / Reject Settlement
  const handleConfirmSettlement = async (id) => {
    try {
      await api.put(`/split/settlements/${id}/confirm`);
      showFeedback("Settlement confirmed! Balances updated.");
      fetchData();
    } catch (err) {
      showFeedback(
        err.response?.data?.message || "Failed to confirm settlement.",
        "error"
      );
    }
  };

  const handleRejectSettlement = async (id) => {
    try {
      await api.put(`/split/settlements/${id}/reject`);
      showFeedback("Settlement rejected.");
      fetchData();
    } catch (err) {
      showFeedback(
        err.response?.data?.message || "Failed to reject settlement.",
        "error"
      );
    }
  };

  // Helper: find user name by ID
  const getUserName = (id) => {
    if (id === user?._id) return "You";
    const found = friends.find((f) => f.friend._id === id);
    if (found) return found.friend.name;
    return "Friend";
  };

  // Pending settlements where current user is recipient (waiting for confirmation)
  const incomingSettlements = settlements.filter(
    (s) => s.recipient._id === user?._id && s.status === "pending"
  );

  return (
    <Layout>
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 shadow-lg transition-all ${
            feedback.type === "error"
              ? "bg-rust text-white"
              : "bg-ledger text-white"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {feedback.type === "error" ? (
              <XCircle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
            {feedback.msg}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-ink">
              SpendWise Split
            </h1>
            <span className="rounded-full bg-ledger/10 px-2.5 py-0.5 text-xs font-semibold text-ledger">
              Friend-to-Friend
            </span>
          </div>
          <p className="mt-1 text-sm text-slate">
            Split expenses with friends, track exact shares, and record repayments effortlessly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            title="Refresh latest data"
            className="flex items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-white px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium text-ink shadow-xs transition-colors hover:bg-paper disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-ledger" : "text-slate"} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsAddFriendModalOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-white px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium text-ink shadow-xs transition-colors hover:bg-paper"
          >
            <UserPlus size={15} />
            <span>Add Friend</span>
          </button>
          <button
            onClick={() => openSettleModal()}
            className="flex items-center justify-center gap-1.5 rounded-md border border-rust/30 bg-rust/10 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium text-rust transition-colors hover:bg-rust/20"
          >
            <Scale size={15} />
            <span>Settle Up</span>
          </button>
          <button
            onClick={() => openCreateExpenseModal()}
            className="flex items-center justify-center gap-1.5 rounded-md bg-ledger px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-medium text-white shadow-xs transition-colors hover:bg-ledger-dark"
          >
            <PlusCircle size={15} />
            <span>Split Expense</span>
          </button>
        </div>
      </div>

      {/* Incoming Friend Requests Alert Banner */}
      {incomingRequests.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-ledger/30 bg-ledger/10 px-4 py-3 text-sm text-ledger shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <Users size={18} className="shrink-0 text-ledger mt-0.5 sm:mt-0" />
            <div>
              <p className="font-semibold text-ledger">
                You have {incomingRequests.length} pending friend request{incomingRequests.length > 1 ? "s" : ""}!
              </p>
              <p className="text-xs text-slate">
                Waiting for your approval: {incomingRequests.map((r) => r.requester.name).join(", ")}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab("requests");
              fetchData();
            }}
            className="self-start sm:self-auto rounded-md bg-ledger px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-ledger-dark transition shrink-0"
          >
            View &amp; Accept ({incomingRequests.length})
          </button>
        </div>
      )}

      {/* Informational Repayment Notice */}
      <div className="mt-4 flex items-start gap-2.5 rounded-md border border-ink/10 bg-amber-50/70 p-3 sm:px-3.5 sm:py-2.5 text-xs text-amber-900">
        <Info size={15} className="shrink-0 text-amber mt-0.5" />
        <span className="leading-relaxed">
          <strong>Notice:</strong> SpendWise Split records friend-to-friend expense shares and repayments to track who owes what. It does not transfer real funds or execute bank transactions.
        </span>
      </div>

      {/* Balance Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {/* Total Owed To You */}
        <div className="min-w-0 rounded-lg border border-ledger/20 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate">
            <span className="text-xs font-medium uppercase tracking-wider">
              You are owed
            </span>
            <span className="rounded-full bg-ledger/10 p-1.5 text-ledger">
              <ArrowDownLeft size={16} />
            </span>
          </div>
          <p className="mt-2 truncate font-display text-xl sm:text-2xl font-bold text-ledger" title={formatCurrency(balances.totalOwedToUser, user?.currency)}>
            {formatCurrency(balances.totalOwedToUser, user?.currency)}
          </p>
          <p className="mt-1 text-xs text-slate truncate">
            From {balances.friends.filter((f) => f.net > 0).length} friend(s)
          </p>
        </div>

        {/* Total You Owe */}
        <div className="min-w-0 rounded-lg border border-rust/20 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate">
            <span className="text-xs font-medium uppercase tracking-wider">
              You owe
            </span>
            <span className="rounded-full bg-rust/10 p-1.5 text-rust">
              <ArrowUpRight size={16} />
            </span>
          </div>
          <p className="mt-2 truncate font-display text-xl sm:text-2xl font-bold text-rust" title={formatCurrency(balances.totalUserOwes, user?.currency)}>
            {formatCurrency(balances.totalUserOwes, user?.currency)}
          </p>
          <p className="mt-1 text-xs text-slate truncate">
            To {balances.friends.filter((f) => f.net < 0).length} friend(s)
          </p>
        </div>

        {/* Overall Net Balance */}
        <div className="min-w-0 rounded-lg border border-ink/10 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate">
            <span className="text-xs font-medium uppercase tracking-wider">
              Net Balance
            </span>
            <span className="rounded-full bg-ink/5 p-1.5 text-ink">
              <DollarSign size={16} />
            </span>
          </div>
          <p
            className={`mt-2 truncate font-display text-xl sm:text-2xl font-bold ${
              balances.netBalance > 0
                ? "text-ledger"
                : balances.netBalance < 0
                ? "text-rust"
                : "text-ink"
            }`}
            title={formatCurrency(balances.netBalance, user?.currency)}
          >
            {balances.netBalance > 0 ? "+" : ""}
            {formatCurrency(balances.netBalance, user?.currency)}
          </p>
          <p className="mt-1 text-xs text-slate truncate">
            {balances.netBalance > 0
              ? "Overall in credit"
              : balances.netBalance < 0
              ? "Overall in debt"
              : "All settled up!"}
          </p>
        </div>
      </div>

      {/* Pending Settlement Alert Banner (if any incoming repayments need confirmation) */}
      {incomingSettlements.length > 0 && (
        <div className="mt-5 rounded-lg border border-ledger/30 bg-ledger/5 p-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-ledger" />
            <h3 className="text-sm font-semibold text-ink">
              Pending Repayment Confirmations ({incomingSettlements.length})
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate">
            Your friends have recorded repayments to you. Please confirm once you've received payment to adjust balances.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {incomingSettlements.map((s) => (
              <div
                key={s._id}
                className="flex flex-col gap-2 rounded-md border border-ink/10 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <span className="font-semibold text-ink">{s.sender.name}</span>
                  <span className="text-xs text-slate"> ({s.sender.email}) repaid </span>
                  <span className="font-bold text-ledger">
                    {formatCurrency(s.amount, user?.currency)}
                  </span>
                  {s.note && <span className="text-xs italic text-slate"> — "{s.note}"</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConfirmSettlement(s._id)}
                    className="flex items-center gap-1 rounded bg-ledger px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-ledger-dark"
                  >
                    <CheckCircle2 size={13} />
                    Confirm Receipt
                  </button>
                  <button
                    onClick={() => handleRejectSettlement(s._id)}
                    className="flex items-center gap-1 rounded border border-ink/10 bg-white px-2.5 py-1 text-xs font-medium text-rust hover:bg-rust/10"
                  >
                    <XCircle size={13} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 border-b border-ink/10 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-3 sm:space-x-6 min-w-max pb-px">
          {[
            { id: "expenses", label: "Shared Expenses", count: expenses.length },
            { id: "friends", label: "Friends & Balances", count: friends.length },
            { id: "settlements", label: "Settlements", count: settlements.length },
            {
              id: "requests",
              label: "Friend Requests",
              count: incomingRequests.length,
              badge: incomingRequests.length > 0,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                fetchData();
              }}
              className={`shrink-0 flex items-center gap-2 border-b-2 py-3 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-ledger text-ink"
                  : "border-transparent text-slate hover:text-ink"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] sm:text-xs ${
                    tab.badge
                      ? "bg-rust text-white"
                      : activeTab === tab.id
                      ? "bg-ink/10 text-ink"
                      : "bg-paper text-slate"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* TAB 1: SHARED EXPENSES */}
        {activeTab === "expenses" && (
          <div>
            {loading ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate">
                Loading shared expenses...
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink/20 bg-white p-10 text-center">
                <Receipt size={36} className="text-slate/50" />
                <h3 className="mt-2 text-base font-semibold text-ink">
                  No shared expenses yet
                </h3>
                <p className="mt-1 text-xs text-slate">
                  Split a dinner, groceries, trip, or rent with your accepted friends.
                </p>
                <button
                  onClick={() => openCreateExpenseModal()}
                  className="mt-4 flex items-center gap-1.5 rounded-md bg-ledger px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-ledger-dark"
                >
                  <PlusCircle size={16} />
                  Add First Shared Expense
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {expenses.map((expense) => {
                  const isPayer = expense.payer._id === user?._id;
                  const mySplit = expense.splits.find(
                    (s) => s.user._id === user?._id
                  );
                  const myShare = mySplit ? mySplit.amount : 0;

                  return (
                    <div
                      key={expense._id}
                      className="group flex flex-col justify-between rounded-lg border border-ink/10 bg-white p-4 shadow-sm transition hover:border-ink/20 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-display font-bold text-white"
                          style={{
                            backgroundColor:
                              expense.category?.color || "#3F7259",
                          }}
                        >
                          {expense.description.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-ink">
                              {expense.description}
                            </h4>
                            {expense.category && (
                              <span className="rounded bg-paper px-2 py-0.5 text-xs text-slate">
                                {expense.category.name}
                              </span>
                            )}
                            <span className="text-xs text-slate">
                              {expense.splitType === "equal"
                                ? "Equal Split"
                                : "Custom Split"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate">
                            Paid by{" "}
                            <span className="font-medium text-ink">
                              {isPayer ? "You" : expense.payer.name}
                            </span>{" "}
                            on{" "}
                            {new Date(expense.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {expense.splits.map((s) => (
                              <span
                                key={s.user._id}
                                className={`rounded px-2 py-0.5 text-xs ${
                                  s.user._id === user?._id
                                    ? "bg-ledger/10 font-medium text-ledger"
                                    : "bg-paper text-slate"
                                }`}
                              >
                                {s.user._id === user?._id
                                  ? "You"
                                  : s.user.name.split(" ")[0]}
                                : {formatCurrency(s.amount, user?.currency)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-ink/5 pt-3 sm:mt-0 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                        <div>
                          <p className="text-xs text-slate sm:text-right">Total</p>
                          <p className="font-display text-lg font-bold text-ink">
                            {formatCurrency(expense.amount, user?.currency)}
                          </p>
                          {isPayer ? (
                            <p className="text-xs font-medium text-ledger sm:text-right">
                              You lent{" "}
                              {formatCurrency(
                                expense.amount - myShare,
                                user?.currency
                              )}
                            </p>
                          ) : (
                            <p className="text-xs font-medium text-rust sm:text-right">
                              You borrowed{" "}
                              {formatCurrency(myShare, user?.currency)}
                            </p>
                          )}
                        </div>

                        {/* Actions for Creator or Payer */}
                        {(expense.creator._id === user?._id || isPayer) && (
                          <div className="flex items-center gap-2 sm:mt-2">
                            <button
                              onClick={() => openCreateExpenseModal(expense)}
                              className="text-xs font-medium text-slate hover:text-ink"
                            >
                              Edit
                            </button>
                            <span className="text-slate/30">•</span>
                            <button
                              onClick={() => handleDeleteExpense(expense._id)}
                              className="text-xs font-medium text-rust hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FRIENDS & BALANCES */}
        {activeTab === "friends" && (
          <div>
            {incomingRequests.length > 0 && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-ledger/30 bg-ledger/10 p-3.5 text-xs text-ledger shadow-sm">
                <div className="flex items-center gap-2">
                  <Users size={16} />
                  <span>
                    You have <strong>{incomingRequests.length}</strong> incoming friend request{incomingRequests.length > 1 ? "s" : ""}!
                  </span>
                </div>
                <button
                  onClick={() => {
                    setActiveTab("requests");
                    fetchData();
                  }}
                  className="rounded bg-ledger px-3 py-1 font-semibold text-white shadow-sm hover:bg-ledger-dark transition"
                >
                  Review Requests →
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-semibold text-ink">
                Your Friends ({friends.length})
              </h3>
              <button
                onClick={() => setIsAddFriendModalOpen(true)}
                className="flex items-center gap-1 text-sm font-medium text-ledger hover:underline"
              >
                <UserPlus size={15} />
                Find New Friend
              </button>
            </div>

            {friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink/20 bg-white p-10 text-center">
                <Users size={36} className="text-slate/50" />
                <h4 className="mt-2 text-base font-semibold text-ink">
                  No friends added yet
                </h4>
                <p className="mt-1 text-xs text-slate">
                  Connect with friends by searching their email or name to start splitting.
                </p>
                <button
                  onClick={() => setIsAddFriendModalOpen(true)}
                  className="mt-4 flex items-center gap-1.5 rounded-md bg-ledger px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-ledger-dark"
                >
                  <UserPlus size={16} />
                  Add Friend
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {friends.map((item) => {
                  const friend = item.friend;
                  const bal = balances.friends.find(
                    (b) => b.friend._id === friend._id
                  ) || { net: 0, status: "settled" };

                  return (
                    <div
                      key={item.friendshipId}
                      className="flex flex-col justify-between rounded-lg border border-ink/10 bg-white p-5 shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                              {friend.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-semibold text-ink">{friend.name}</h4>
                              <p className="text-xs text-slate">{friend.email}</p>
                            </div>
                          </div>
                        </div>

                        {/* Balance with this friend */}
                        <div className="mt-4 rounded-md border border-ink/5 bg-paper/50 p-3">
                          <p className="text-xs text-slate">Balance Status</p>
                          {bal.net > 0 ? (
                            <p className="mt-1 font-display text-lg font-bold text-ledger">
                              Owes you {formatCurrency(bal.net, user?.currency)}
                            </p>
                          ) : bal.net < 0 ? (
                            <p className="mt-1 font-display text-lg font-bold text-rust">
                              You owe {formatCurrency(Math.abs(bal.net), user?.currency)}
                            </p>
                          ) : (
                            <p className="mt-1 text-sm font-medium text-slate">
                              Settled up ($0.00)
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2 border-t border-ink/5 pt-3">
                        {bal.net !== 0 && (
                          <button
                            onClick={() => openSettleModal(bal)}
                            className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-white transition-colors ${
                              bal.net < 0
                                ? "bg-rust hover:bg-rust-light"
                                : "bg-ledger hover:bg-ledger-dark"
                            }`}
                          >
                            <Scale size={13} />
                            {bal.net < 0 ? "Settle Up (Pay)" : "Record Payment Received"}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            openCreateExpenseModal();
                            setExpenseForm((prev) => ({
                              ...prev,
                              selectedParticipants: [user?._id, friend._id],
                            }));
                          }}
                          className="flex items-center gap-1 rounded border border-ink/15 bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-paper"
                        >
                          <PlusCircle size={13} />
                          Split
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SETTLEMENTS */}
        {activeTab === "settlements" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">
                  Recorded Settlements
                </h3>
                <p className="text-xs text-slate">
                  Friend repayment history and confirmation status
                </p>
              </div>
              <button
                onClick={() => openSettleModal()}
                className="flex items-center gap-1.5 rounded-md bg-rust px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-rust-light"
              >
                <Scale size={14} />
                Record Repayment
              </button>
            </div>

            {settlements.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink/20 bg-white p-10 text-center">
                <Scale size={36} className="text-slate/50" />
                <h4 className="mt-2 text-base font-semibold text-ink">
                  No settlements recorded yet
                </h4>
                <p className="mt-1 text-xs text-slate">
                  When you or a friend record repayments, they will appear here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {settlements.map((s) => {
                  const isSender = s.sender._id === user?._id;
                  const isRecipient = s.recipient._id === user?._id;

                  return (
                    <div
                      key={s._id}
                      className="flex flex-col justify-between rounded-lg border border-ink/10 bg-white p-4 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            s.status === "confirmed"
                              ? "bg-ledger/10 text-ledger"
                              : s.status === "rejected"
                              ? "bg-rust/10 text-rust"
                              : "bg-amber/10 text-amber"
                          }`}
                        >
                          {s.status === "confirmed" ? (
                            <CheckCircle2 size={18} />
                          ) : s.status === "rejected" ? (
                            <XCircle size={18} />
                          ) : (
                            <Clock size={18} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink">
                              {isSender ? "You" : s.sender.name}
                            </span>
                            <span className="text-xs text-slate">repaid</span>
                            <span className="font-semibold text-ink">
                              {isRecipient ? "You" : s.recipient.name}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                                s.status === "confirmed"
                                  ? "bg-ledger/10 text-ledger"
                                  : s.status === "rejected"
                                  ? "bg-rust/10 text-rust"
                                  : "bg-amber/10 text-amber"
                              }`}
                            >
                              {s.status}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate">
                            Date:{" "}
                            {new Date(s.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            {s.note && ` • "${s.note}"`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-ink/5 pt-2 sm:mt-0 sm:border-0 sm:pt-0">
                        <span className="font-display text-lg font-bold text-ink sm:mr-4">
                          {formatCurrency(s.amount, user?.currency)}
                        </span>

                        {/* Recipient confirmation actions for pending settlements */}
                        {isRecipient && s.status === "pending" && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleConfirmSettlement(s._id)}
                              className="rounded bg-ledger px-2.5 py-1 text-xs font-medium text-white hover:bg-ledger-dark"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleRejectSettlement(s._id)}
                              className="rounded border border-ink/10 bg-white px-2.5 py-1 text-xs font-medium text-rust hover:bg-rust/10"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: FRIEND REQUESTS */}
        {activeTab === "requests" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Incoming Requests */}
            <div className="rounded-lg border border-ink/10 bg-white p-5">
              <h3 className="font-display text-base font-semibold text-ink">
                Incoming Requests ({incomingRequests.length})
              </h3>
              <p className="text-xs text-slate">
                People who want to be your friend on SpendWise
              </p>

              {incomingRequests.length === 0 ? (
                <div className="mt-4 rounded-md border border-dashed border-ink/10 p-6 text-center text-xs text-slate">
                  No pending incoming requests.
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-2.5">
                  {incomingRequests.map((req) => (
                    <div
                      key={req._id}
                      className="flex items-center justify-between rounded-md border border-ink/10 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {req.requester.name}
                        </p>
                        <p className="text-xs text-slate">{req.requester.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRespondRequest(req._id, "accept")}
                          className="rounded bg-ledger px-2.5 py-1 text-xs font-medium text-white hover:bg-ledger-dark"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRespondRequest(req._id, "reject")}
                          className="rounded border border-ink/10 bg-white px-2.5 py-1 text-xs font-medium text-rust hover:bg-rust/10"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Requests */}
            <div className="rounded-lg border border-ink/10 bg-white p-5">
              <h3 className="font-display text-base font-semibold text-ink">
                Outgoing Requests ({outgoingRequests.length})
              </h3>
              <p className="text-xs text-slate">
                Friend requests you have sent that are waiting for response
              </p>

              {outgoingRequests.length === 0 ? (
                <div className="mt-4 rounded-md border border-dashed border-ink/10 p-6 text-center text-xs text-slate">
                  No pending outgoing requests.
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-2.5">
                  {outgoingRequests.map((req) => (
                    <div
                      key={req._id}
                      className="flex items-center justify-between rounded-md border border-ink/10 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {req.recipient.name}
                        </p>
                        <p className="text-xs text-slate">{req.recipient.email}</p>
                      </div>
                      <span className="rounded bg-paper px-2 py-0.5 text-xs text-slate">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: CREATE / EDIT SHARED EXPENSE                     */}
      {/* ========================================================= */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3 sm:p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-ink/10 pb-3 sm:pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  {editingExpense ? "Edit Shared Expense" : "Split an Expense"}
                </h3>
                <p className="text-xs text-slate">
                  Calculate and track per-person shares accurately
                </p>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded p-1 text-slate hover:bg-paper hover:text-ink transition"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {expenseError && (
              <div className="mt-4 rounded bg-rust/10 p-3 text-xs font-medium text-rust">
                {expenseError}
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dinner, Groceries, Movie tickets"
                  value={expenseForm.description}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, description: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ledger focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate">
                    Total Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, amount: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ledger focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate">
                    Date
                  </label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, date: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ledger focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate">
                    Category (optional)
                  </label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, category: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ledger focus:outline-none"
                  >
                    <option value="">No Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate">
                    Paid By *
                  </label>
                  <select
                    value={expenseForm.payer}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, payer: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ledger focus:outline-none"
                  >
                    <option value={user?._id}>You ({user?.name})</option>
                    {friends.map((f) => (
                      <option key={f.friend._id} value={f.friend._id}>
                        {f.friend.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Participants selection */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate">
                    Select Participants (Min 2) *
                  </label>
                  {friends.length > 0 && (
                    <span className="text-[11px] text-slate">
                      Click a friend to add/remove
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {/* Current User */}
                  <button
                    type="button"
                    onClick={() => toggleParticipant(user?._id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      expenseForm.selectedParticipants.includes(user?._id)
                        ? "bg-ledger text-white"
                        : "bg-paper text-slate hover:bg-ink/10"
                    }`}
                  >
                    You {expenseForm.selectedParticipants.includes(user?._id) ? "✓" : "+"}
                  </button>

                  {/* Friends */}
                  {friends.map((f) => {
                    const isSelected = expenseForm.selectedParticipants.includes(
                      f.friend._id
                    );
                    return (
                      <button
                        key={f.friend._id}
                        type="button"
                        onClick={() => toggleParticipant(f.friend._id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-ledger text-white"
                            : "bg-paper text-slate hover:bg-ink/10"
                        }`}
                      >
                        {f.friend.name} {isSelected ? "✓" : "+"}
                      </button>
                    );
                  })}
                </div>

                {/* Empty State when user has no friends yet */}
                {friends.length === 0 && (
                  <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-900">
                    <p className="font-semibold">No friends added yet</p>
                    <p className="mt-0.5 text-slate leading-relaxed">
                      To split an expense, you must add at least one friend first. Search existing users by username or email on the Friends tab.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsExpenseModalOpen(false);
                        setActiveTab("friends");
                        setIsAddFriendModalOpen(true);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-ledger px-3 py-1.5 text-xs font-medium text-white transition hover:bg-ledger-dark"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Add a Friend</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Split Type Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate">
                  Split Method
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpenseForm({ ...expenseForm, splitType: "equal" })
                    }
                    className={`rounded-md border py-2 text-xs font-medium transition-colors ${
                      expenseForm.splitType === "equal"
                        ? "border-ledger bg-ledger/10 text-ledger"
                        : "border-ink/15 bg-white text-slate hover:bg-paper"
                    }`}
                  >
                    Split Equally (1/{expenseForm.selectedParticipants.length})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExpenseForm({ ...expenseForm, splitType: "exact" })
                    }
                    className={`rounded-md border py-2 text-xs font-medium transition-colors ${
                      expenseForm.splitType === "exact"
                        ? "border-ledger bg-ledger/10 text-ledger"
                        : "border-ink/15 bg-white text-slate hover:bg-paper"
                    }`}
                  >
                    Custom Exact Shares
                  </button>
                </div>
              </div>

              {/* Split breakdown preview / Custom share inputs */}
              <div className="rounded-md border border-ink/10 bg-paper/50 p-3">
                <p className="text-xs font-semibold text-ink">
                  {expenseForm.splitType === "equal"
                    ? "Calculated Equal Shares"
                    : "Enter Exact Shares"}
                </p>

                <div className="mt-2 space-y-2">
                  {calculatedSplits.map((item) => (
                    <div
                      key={item.userId}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-ink">
                        {getUserName(item.userId)}
                      </span>
                      {expenseForm.splitType === "equal" ? (
                        <span className="font-mono text-ledger">
                          {formatCurrency(item.amount, user?.currency)}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={expenseForm.customShares[item.userId] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExpenseForm((prev) => ({
                                ...prev,
                                customShares: {
                                  ...prev.customShares,
                                  [item.userId]: val,
                                },
                              }));
                            }}
                            className="w-24 rounded border border-ink/20 px-2 py-1 text-right text-xs focus:border-ledger focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {expenseForm.splitType === "exact" && (
                  <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-2 text-xs">
                    <span className="text-slate">
                      Sum: {formatCurrency(customTotal, user?.currency)} of{" "}
                      {formatCurrency(
                        parseFloat(expenseForm.amount) || 0,
                        user?.currency
                      )}
                    </span>
                    <span
                      className={`font-semibold ${
                        Math.abs(
                          customTotal - (parseFloat(expenseForm.amount) || 0)
                        ) < 0.01
                          ? "text-ledger"
                          : "text-rust"
                      }`}
                    >
                      {Math.abs(
                        customTotal - (parseFloat(expenseForm.amount) || 0)
                      ) < 0.01
                        ? "✓ Matches Total"
                        : `Diff: ${formatCurrency(
                            (parseFloat(expenseForm.amount) || 0) - customTotal,
                            user?.currency
                          )}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="rounded-md px-3 py-2 text-xs font-medium text-slate hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="rounded-md bg-ledger px-4 py-2 text-xs font-medium text-white hover:bg-ledger-dark disabled:opacity-50"
                >
                  {submittingExpense
                    ? "Saving..."
                    : editingExpense
                    ? "Update Expense"
                    : "Save Shared Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: SETTLE UP (RECORD REPAYMENT)                      */}
      {/* ========================================================= */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3 sm:p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-ink/10 pb-3 sm:pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  Settle Up Repayment
                </h3>
                <p className="text-xs text-slate">
                  Record money sent or received to clear shared balances
                </p>
              </div>
              <button
                onClick={() => setIsSettleModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded p-1 text-slate hover:bg-paper hover:text-ink transition"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {settleError && (
              <div className="mt-4 rounded bg-rust/10 p-3 text-xs font-medium text-rust">
                {settleError}
              </div>
            )}

            <form onSubmit={handleSaveSettlement} className="mt-4 space-y-4">
              {/* Select Friend */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate">
                  Select Friend *
                </label>
                <select
                  required
                  value={settleForm.recipientId}
                  onChange={(e) => {
                    const rId = e.target.value;
                    const b = balances.friends.find((f) => f.friend._id === rId);
                    const isOwing = b && b.net < 0;
                    const isOwed = b && b.net > 0;
                    const newDirection = isOwed ? "friend_paid" : "you_paid";
                    const newAmt = isOwing
                      ? Math.abs(b.net).toString()
                      : isOwed
                      ? b.net.toString()
                      : "";
                    setSettleForm({
                      ...settleForm,
                      recipientId: rId,
                      payerDirection: newDirection,
                      amount: newAmt || settleForm.amount,
                    });
                  }}
                  className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ledger focus:outline-none"
                >
                  <option value="">Select Friend...</option>
                  {balances.friends.map((f) => (
                    <option key={f.friend._id} value={f.friend._id}>
                      {f.friend.name}{" "}
                      {f.net < 0
                        ? `(You owe ${formatCurrency(Math.abs(f.net), user?.currency)})`
                        : f.net > 0
                        ? `(Owes you ${formatCurrency(f.net, user?.currency)})`
                        : `(Settled up $0.00)`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Direction Toggle */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate mb-1">
                  Payment Direction *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const b = balances.friends.find((f) => f.friend._id === settleForm.recipientId);
                      const amt = b && b.net < 0 ? Math.abs(b.net).toString() : settleForm.amount;
                      setSettleForm({ ...settleForm, payerDirection: "you_paid", amount: amt });
                    }}
                    className={`flex flex-col items-center justify-center rounded-lg border p-2.5 text-xs font-medium transition ${
                      settleForm.payerDirection === "you_paid"
                        ? "border-rust bg-rust/10 text-rust font-semibold"
                        : "border-ink/15 text-slate hover:bg-paper"
                    }`}
                  >
                    <span>💸 You paid friend</span>
                    <span className="text-[10px] text-slate mt-0.5">Pay off your debt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const b = balances.friends.find((f) => f.friend._id === settleForm.recipientId);
                      const amt = b && b.net > 0 ? b.net.toString() : settleForm.amount;
                      setSettleForm({ ...settleForm, payerDirection: "friend_paid", amount: amt });
                    }}
                    className={`flex flex-col items-center justify-center rounded-lg border p-2.5 text-xs font-medium transition ${
                      settleForm.payerDirection === "friend_paid"
                        ? "border-ledger bg-ledger/10 text-ledger font-semibold"
                        : "border-ink/15 text-slate hover:bg-paper"
                    }`}
                  >
                    <span>💰 Friend paid you</span>
                    <span className="text-[10px] text-slate mt-0.5">Record received cash</span>
                  </button>
                </div>
              </div>

              {/* Repayment Amount */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate">
                  Repayment Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={settleForm.amount}
                  onChange={(e) =>
                    setSettleForm({ ...settleForm, amount: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ledger focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate">
                  Supports full settlement or partial repayments.
                </p>
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={settleForm.date}
                  onChange={(e) =>
                    setSettleForm({ ...settleForm, date: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ledger focus:outline-none"
                />
              </div>

              {/* Note / Reference */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate">
                  Note / Reference (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via UPI / Cash / Bank"
                  value={settleForm.note}
                  onChange={(e) =>
                    setSettleForm({ ...settleForm, note: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ledger focus:outline-none"
                />
              </div>

              {/* Contextual Banner */}
              <div
                className={`rounded-md border p-3 text-xs ${
                  settleForm.payerDirection === "friend_paid"
                    ? "border-ledger/20 bg-ledger/5 text-slate"
                    : "border-ink/10 bg-paper/60 text-slate"
                }`}
              >
                {settleForm.payerDirection === "friend_paid" ? (
                  <>
                    <span className="font-semibold text-ledger">Instant Update:</span>{" "}
                    Recording that you received repayment from this friend will immediately reduce what they owe you and update balances.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-ink">Confirmation Workflow:</span>{" "}
                    The payment will be saved as <em>pending</em>. Once your friend confirms receipt, your outstanding balance will be reduced.
                  </>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="rounded-md px-3 py-2 text-xs font-medium text-slate hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSettle}
                  className={`rounded-md px-4 py-2 text-xs font-medium text-white disabled:opacity-50 transition ${
                    settleForm.payerDirection === "friend_paid"
                      ? "bg-ledger hover:bg-ledger-dark"
                      : "bg-rust hover:bg-rust-light"
                  }`}
                >
                  {submittingSettle
                    ? "Recording..."
                    : settleForm.payerDirection === "friend_paid"
                    ? "Record Payment Received"
                    : "Record Repayment Sent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: FIND & ADD FRIENDS                               */}
      {/* ========================================================= */}
      {isAddFriendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3 sm:p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-ink/10 pb-3 sm:pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  Add Friends
                </h3>
                <p className="text-xs text-slate">
                  Search SpendWise users by name or email
                </p>
              </div>
              <button
                onClick={() => setIsAddFriendModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded p-1 text-slate hover:bg-paper hover:text-ink transition"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-2.5 text-slate"
                />
                <input
                  type="text"
                  placeholder="Type name or email address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-ink/20 pl-9 pr-3 py-2 text-sm text-ink focus:border-ledger focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="mt-4 max-h-60 overflow-y-auto">
              {searching ? (
                <p className="py-4 text-center text-xs text-slate">
                  Loading users...
                </p>
              ) : searchResults.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate">
                  {searchQuery
                    ? `No users found matching "${searchQuery}"`
                    : "No other registered users found on SpendWise yet."}
                </p>
              ) : (
                <div className="space-y-2">
                  {!searchQuery && (
                    <p className="text-[11px] font-medium text-slate uppercase tracking-wider mb-1.5">
                      Registered Users ({searchResults.length})
                    </p>
                  )}
                  {searchResults.map((resUser) => (
                    <div
                      key={resUser._id}
                      className="flex items-center justify-between rounded-md border border-ink/10 p-2.5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {resUser.name}
                        </p>
                        <p className="text-xs text-slate">{resUser.email}</p>
                      </div>

                      {resUser.relationship === "accepted" ? (
                        <span className="rounded bg-ledger/10 px-2 py-0.5 text-xs font-medium text-ledger">
                          Friends
                        </span>
                      ) : resUser.relationship === "pending_outgoing" ? (
                        <span className="rounded bg-paper px-2 py-0.5 text-xs text-slate">
                          Request Sent
                        </span>
                      ) : resUser.relationship === "pending_incoming" ? (
                        <button
                          onClick={async () => {
                            await handleRespondRequest(resUser.friendshipId, "accept");
                            setIsAddFriendModalOpen(false);
                          }}
                          className="rounded bg-ledger px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-ledger-dark transition"
                        >
                          Accept Request
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSendFriendRequest(resUser._id)}
                          className="flex items-center gap-1 rounded bg-ledger px-2.5 py-1 text-xs font-medium text-white hover:bg-ledger-dark"
                        >
                          <UserPlus size={13} />
                          Add
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-ink/10 pt-3 text-right">
              <button
                onClick={() => setIsAddFriendModalOpen(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate hover:bg-paper"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Split;
