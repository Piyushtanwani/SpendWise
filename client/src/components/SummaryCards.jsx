import { ArrowDownRight, ArrowUpRight, Scale } from "lucide-react";
import { formatCurrency } from "../utils/format";

const Card = ({ label, value, icon: Icon, tone }) => (
  <div className="min-w-0 rounded-lg border border-ink/10 bg-white p-4 sm:p-5 shadow-xs">
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium uppercase tracking-wide text-slate">{label}</p>
      <Icon size={16} className={tone} strokeWidth={2} />
    </div>
    <p
      className={`mt-2 sm:mt-3 truncate font-mono text-xl sm:text-2xl font-semibold ${tone}`}
      title={value}
    >
      {value}
    </p>
  </div>
);

const SummaryCards = ({ summary, currency }) => {
  const income = summary?.income || 0;
  const expense = summary?.expense || 0;
  const balance = summary?.balance ?? income - expense;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <Card
        label="Income"
        value={formatCurrency(income, currency)}
        icon={ArrowUpRight}
        tone="text-ledger"
      />
      <Card
        label="Expenses"
        value={formatCurrency(expense, currency)}
        icon={ArrowDownRight}
        tone="text-rust"
      />
      <Card
        label="Balance"
        value={formatCurrency(balance, currency)}
        icon={Scale}
        tone={balance >= 0 ? "text-ink" : "text-rust"}
      />
    </div>
  );
};

export default SummaryCards;

