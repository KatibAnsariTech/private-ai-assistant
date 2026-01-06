import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend, Cell
} from "recharts";

const COLORS = [
  "#a855f7", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"
];

const Graph = ({ graph }) => {
  if (!graph || !graph.x || !graph.y) return null;

  const data = graph.x.map((x, i) => ({
    name: String(x),
    value: graph.y[i] ?? 0
  }));

  // Max bar size to prevent single bars from being too wide
  const maxBarSize = data.length === 1 ? 80 : data.length <= 3 ? 120 : undefined;

  // Dynamic width based on number of data points to prevent overlap
  const minWidth = data.length === 1 ? 400 : 700;
  let pixelsPerDataPoint;
  if (data.length <= 3) {
    pixelsPerDataPoint = 100;
  } else if (data.length <= 10) {
    pixelsPerDataPoint = 80;
  } else if (data.length <= 20) {
    pixelsPerDataPoint = 100;
  } else {
    pixelsPerDataPoint = 120; // More space for large datasets
  }
  const dynamicWidth = Math.max(minWidth, data.length * pixelsPerDataPoint);

  return (
    <div className="mt-4 p-6 bg-slate-900/60 rounded-xl border border-slate-700/50 shadow-lg">
      <h4 className="text-base text-white font-bold mb-4">
        📊 {graph.label || "Graph Result"}
      </h4>

      <div className="w-full overflow-x-auto">
        <ResponsiveContainer width={dynamicWidth} height={400}>
          {graph.type === "line" ? (
            <LineChart data={data}>
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#a855f7"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barCategoryGap="10%">
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={maxBarSize}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Graph;
