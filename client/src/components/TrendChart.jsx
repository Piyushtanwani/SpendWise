import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatCurrency, MONTH_NAMES_SHORT } from "../utils/format";

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-ink">{MONTH_NAMES_SHORT[label - 1]}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-mono" style={{ color: p.fill }}>
          {p.dataKey === "income" ? "Income" : "Expense"}: {formatCurrency(p.value, currency)}
        </p>
      ))}
    </div>
  );
};

const TrendChart = ({ data, currency }) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        barGap={isMobile ? 2 : 4}
        margin={{ top: 10, right: 10, left: isMobile ? -20 : -5, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1B2430" strokeOpacity={0.08} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(m) => (isMobile ? MONTH_NAMES_SHORT[m - 1]?.slice(0, 1) : MONTH_NAMES_SHORT[m - 1])}
          tick={{ fontSize: isMobile ? 10 : 11, fill: "#6B7785" }}
          axisLine={{ stroke: "#1B2430", strokeOpacity: 0.1 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: isMobile ? 10 : 11, fill: "#6B7785" }}
          axisLine={false}
          tickLine={false}
          width={isMobile ? 32 : 40}
        />
        <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: "#1B2430", opacity: 0.04 }} />
        <Legend
          formatter={(value) => (value === "income" ? "Income" : "Expense")}
          wrapperStyle={{ fontSize: "12px", paddingTop: "6px" }}
        />
        <Bar dataKey="income" fill="#3F7259" radius={[3, 3, 0, 0]} maxBarSize={isMobile ? 14 : 22} />
        <Bar dataKey="expense" fill="#C1533E" radius={[3, 3, 0, 0]} maxBarSize={isMobile ? 14 : 22} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default TrendChart;
