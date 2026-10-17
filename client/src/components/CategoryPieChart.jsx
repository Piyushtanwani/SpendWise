import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "../utils/format";

const CustomTooltip = ({ active, payload, currency }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-ink">{item.name}</p>
      <p className="font-mono text-slate">{formatCurrency(item.total, currency)}</p>
    </div>
  );
};

const CategoryPieChart = ({ data, currency }) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!data?.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate">
        No expenses recorded for this month yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 300 : 280}>
      <PieChart margin={{ top: 0, right: 0, left: 0, bottom: isMobile ? 10 : 0 }}>
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          innerRadius={isMobile ? 45 : 60}
          outerRadius={isMobile ? 75 : 95}
          paddingAngle={2}
          strokeWidth={2}
          stroke="#F7F5F0"
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color || "#3F7259"} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip currency={currency} />} />
        <Legend
          layout={isMobile ? "horizontal" : "vertical"}
          verticalAlign={isMobile ? "bottom" : "middle"}
          align={isMobile ? "center" : "right"}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{
            fontSize: isMobile ? "11px" : "12px",
            color: "#1B2430",
            paddingTop: isMobile ? "8px" : "0",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default CategoryPieChart;
