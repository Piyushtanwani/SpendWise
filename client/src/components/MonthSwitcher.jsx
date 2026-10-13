import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, shiftMonth } from "../utils/format";

const MonthSwitcher = ({ month, onChange }) => {
  return (
    <div className="flex items-center gap-1 rounded-md border border-ink/10 bg-white px-1.5 py-1 shadow-xs">
      <button
        onClick={() => onChange(shiftMonth(month, -1))}
        className="flex h-8 w-8 items-center justify-center rounded p-1 text-slate transition hover:bg-paper-dim hover:text-ink focus:outline-none"
        aria-label="Previous month"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="w-28 sm:w-36 text-center font-mono text-xs sm:text-sm font-medium text-ink truncate">
        {monthLabel(month)}
      </span>
      <button
        onClick={() => onChange(shiftMonth(month, 1))}
        className="flex h-8 w-8 items-center justify-center rounded p-1 text-slate transition hover:bg-paper-dim hover:text-ink focus:outline-none"
        aria-label="Next month"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

export default MonthSwitcher;
