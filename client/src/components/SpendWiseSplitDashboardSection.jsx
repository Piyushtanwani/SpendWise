import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { formatCurrency } from "../utils/format";
import {
  Users,
  PlusCircle,
  Scale,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Receipt,
  ChevronRight,
} from "lucide-react";

const SpendWiseSplitDashboardSection = ({ currency }) => {
  const navigate = useNavigate();
  const [balances, setBalances] = useState({
    totalOwedToUser: 0,
    totalUserOwes: 0,
    netBalance: 0,
    friends: [],
  });
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [pendingSettlements, setPendingSettlements] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [balRes, expRes, settRes, reqRes] = await Promise.all([
        api.get("/split/balances"),
        api.get("/split/expenses?limit=4"),
        api.get("/split/settlements"),
        api.get("/friends/requests"),
      ]);

      setBalances(balRes.data);
      setRecentExpenses(expRes.data.expenses || []);
      setIncomingRequests(reqRes.data.incoming || []);

      // Filter pending settlements where user is recipient
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const incoming = (settRes.data || []).filter(
        (s) => s.recipient._id === user._id && s.status === "pending"
      );
      setPendingSettlements(incoming);
    } catch (err) {
      console.error("Error loading dashboard split section:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConfirm = async (id) => {
    try {
      await api.put(`/split/settlements/${id}/confirm`);
      setActionMessage("Settlement confirmed! Balances updated.");
      setTimeout(() => setActionMessage(""), 3000);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.put(`/split/settlements/${id}/reject`);
      setActionMessage("Settlement rejected.");
      setTimeout(() => setActionMessage(""), 3000);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptFriendRequest = async (id) => {
    try {
      await api.put(`/friends/requests/${id}`, { action: "accept" });
      setActionMessage("Friend request accepted! You are now friends.");
      setTimeout(() => setActionMessage(""), 3000);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-ink/10 bg-white p-4 sm:p-6 shadow-xs">
        <div className="flex h-24 items-center justify-center text-xs text-slate">
          Loading SpendWise Split...
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4 sm:p-6 shadow-xs">
      {/* Section Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-ink/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ledger/10 text-ledger">
              <Users size={16} />
            </span>
            <h2 className="font-display text-lg font-semibold text-ink">
              SpendWise Split
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate">
            Shared balances and friend-to-friend expense splits
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate("/split")}
            className="flex items-center gap-1.5 rounded-md border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-paper"
          >
            <Scale size={14} />
            Settle Up
          </button>
          <button
            onClick={() => navigate("/split")}
            className="flex items-center gap-1.5 rounded-md bg-ledger px-3 py-1.5 text-xs font-medium text-white shadow-xs transition hover:bg-ledger-dark"
          >
            <PlusCircle size={14} />
            Split Expense
          </button>
          <Link
            to="/split"
            className="flex items-center gap-1 text-xs font-semibold text-ledger hover:underline pl-1"
          >
            Split Hub
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {actionMessage && (
        <div className="mt-3 rounded bg-ledger/10 px-3 py-1.5 text-xs font-medium text-ledger">
          {actionMessage}
        </div>
      )}

      {/* Pending Friend Requests Alert */}
      {incomingRequests.length > 0 && (
        <div className="mt-4 rounded-md border border-ledger/30 bg-ledger/10 p-3 sm:p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-ledger" />
              <span className="text-xs font-semibold text-ledger">
                Pending Friend Requests ({incomingRequests.length})
              </span>
            </div>
            <Link to="/split" className="text-xs text-ledger hover:underline font-medium">
              Manage
            </Link>
          </div>
          <div className="mt-2 space-y-2">
            {incomingRequests.map((req) => (
              <div
                key={req._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded bg-white p-2.5 text-xs border border-ink/10"
              >
                <div className="min-w-0 truncate">
                  <span className="font-semibold text-ink">{req.requester.name}</span>
                  <span className="text-slate"> ({req.requester.email})</span>
                </div>
                <button
                  onClick={() => handleAcceptFriendRequest(req._id)}
                  className="self-start sm:self-auto flex items-center gap-1 rounded bg-ledger px-3 py-1.5 text-xs font-semibold text-white hover:bg-ledger-dark transition shrink-0"
                >
                  <CheckCircle2 size={12} /> Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Settlement Alert */}
      {pendingSettlements.length > 0 && (
        <div className="mt-4 rounded-md border border-amber/30 bg-amber-50/60 p-3 sm:p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-amber" />
              <span className="text-xs font-semibold text-ink">
                Pending Settlement Confirmation ({pendingSettlements.length})
              </span>
            </div>
            <Link to="/split" className="text-xs text-ledger hover:underline">
              Manage
            </Link>
          </div>
          <div className="mt-2 space-y-2">
            {pendingSettlements.map((s) => (
              <div
                key={s._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded bg-white p-2.5 text-xs border border-ink/10"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-ink">{s.sender.name}</span>
                  <span className="text-slate"> repaid you </span>
                  <span className="font-bold text-ledger">
                    {formatCurrency(s.amount, currency)}
                  </span>
                  {s.note && <span className="italic text-slate"> ({s.note})</span>}
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                  <button
                    onClick={() => handleConfirm(s._id)}
                    className="flex items-center gap-1 rounded bg-ledger px-2.5 py-1 text-[11px] font-medium text-white hover:bg-ledger-dark"
                  >
                    <CheckCircle2 size={11} /> Confirm
                  </button>
                  <button
                    onClick={() => handleReject(s._id)}
                    className="flex items-center gap-1 rounded border border-ink/10 bg-white px-2.5 py-1 text-[11px] font-medium text-rust hover:bg-rust/10"
                  >
                    <XCircle size={11} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards: Total Owed vs Total You Owe */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-ledger/20 bg-paper/30 p-3.5">
          <div className="flex items-center justify-between text-slate">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              You are owed
            </span>
            <ArrowDownLeft size={15} className="text-ledger" />
          </div>
          <p className="mt-1 font-display text-xl font-bold text-ledger">
            {formatCurrency(balances.totalOwedToUser, currency)}
          </p>
        </div>

        <div className="rounded-lg border border-rust/20 bg-paper/30 p-3.5">
          <div className="flex items-center justify-between text-slate">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              You owe
            </span>
            <ArrowUpRight size={15} className="text-rust" />
          </div>
          <p className="mt-1 font-display text-xl font-bold text-rust">
            {formatCurrency(balances.totalUserOwes, currency)}
          </p>
        </div>

        <div className="rounded-lg border border-ink/10 bg-paper/30 p-3.5">
          <div className="flex items-center justify-between text-slate">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Net balance
            </span>
            <span className="text-xs font-medium text-slate">Overall</span>
          </div>
          <p
            className={`mt-1 font-display text-xl font-bold ${
              balances.netBalance > 0
                ? "text-ledger"
                : balances.netBalance < 0
                ? "text-rust"
                : "text-ink"
            }`}
          >
            {balances.netBalance > 0 ? "+" : ""}
            {formatCurrency(balances.netBalance, currency)}
          </p>
        </div>
      </div>

      {/* Dual Columns: Individual Friend Balances & Recent Shared Expenses */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Friend Balances */}
        <div className="rounded-lg border border-ink/10 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate">
              Friend Balances
            </h3>
            <Link to="/split" className="text-xs text-ledger hover:underline">
              View all
            </Link>
          </div>

          {balances.friends.length === 0 ? (
            <div className="mt-3 rounded border border-dashed border-ink/10 p-5 text-center text-xs text-slate">
              No friend balances yet. Connect with friends in SpendWise Split.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {balances.friends.slice(0, 4).map((f) => (
                <div
                  key={f.friend._id}
                  className="flex items-center justify-between rounded-md border border-ink/5 bg-paper/40 px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-ink">{f.friend.name}</span>
                  {f.net > 0 ? (
                    <span className="font-semibold text-ledger">
                      owes you {formatCurrency(f.net, currency)}
                    </span>
                  ) : f.net < 0 ? (
                    <span className="font-semibold text-rust">
                      you owe {formatCurrency(Math.abs(f.net), currency)}
                    </span>
                  ) : (
                    <span className="text-slate">settled</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Shared Expenses */}
        <div className="rounded-lg border border-ink/10 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate">
              Recent Shared Expenses
            </h3>
            <Link to="/split" className="text-xs text-ledger hover:underline">
              View all
            </Link>
          </div>

          {recentExpenses.length === 0 ? (
            <div className="mt-3 rounded border border-dashed border-ink/10 p-5 text-center text-xs text-slate">
              No shared expenses recorded.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {recentExpenses.map((exp) => (
                <div
                  key={exp._id}
                  className="flex items-center justify-between rounded-md border border-ink/5 bg-paper/40 px-3 py-2 text-xs"
                >
                  <div className="truncate pr-2">
                    <p className="truncate font-semibold text-ink">
                      {exp.description}
                    </p>
                    <p className="text-[11px] text-slate">
                      Paid by {exp.payer.name} •{" "}
                      {new Date(exp.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="font-display font-bold text-ink shrink-0">
                    {formatCurrency(exp.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpendWiseSplitDashboardSection;
