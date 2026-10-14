import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "../utils/format";

const TransactionList = ({ transactions, currency, onEdit, onDelete }) => {
  if (!transactions?.length) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-ink/15 text-sm text-slate">
        No transactions match these filters yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-ink/8 rounded-lg border border-ink/10 bg-white shadow-xs">
      {transactions.map((t) => (
        <div
          key={t._id}
          className="group flex items-center gap-2.5 sm:gap-4 px-3 sm:px-5 py-3 sm:py-3.5 transition hover:bg-paper-dim/60"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: t.category?.color || "#6B7785" }}
          />

          <div className="ledger-row flex-1 min-w-0">
            <div className="min-w-0 pr-1">
              <p className="truncate text-sm font-medium text-ink" title={t.description || t.category?.name}>
                {t.description || t.category?.name || "Untitled"}
              </p>
              <p className="truncate text-xs text-slate">
                {t.category?.name} · {new Date(t.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </p>
            </div>
            <span className="leader hidden sm:block" />
          </div>

          <span
            className={`shrink-0 font-mono text-xs sm:text-sm font-semibold whitespace-nowrap ${
              t.type === "income" ? "text-ledger" : "text-rust"
            }`}
          >
            {t.type === "income" ? "+" : "−"}
            {formatCurrency(t.amount, currency)}
          </span>

          {/* Action buttons: always visible on touch screens, hover-reveal on desktop */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(t)}
              className="flex h-8 w-8 items-center justify-center rounded text-slate hover:bg-ink/5 hover:text-ink transition"
              aria-label="Edit transaction"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => onDelete(t._id)}
              className="flex h-8 w-8 items-center justify-center rounded text-slate hover:bg-rust/10 hover:text-rust transition"
              aria-label="Delete transaction"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TransactionList;
