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

  return (
    <div className="mt-4 p-6 bg-slate-900/60 rounded-xl border border-slate-700/50 shadow-lg">
      <h4 className="text-base text-white font-bold mb-4">
        📊 {graph.label || "Graph Result"}
      </h4>

      <div className="w-full overflow-x-auto">
        <div className="min-w-[700px]">
          <ResponsiveContainer width="100%" height={400}>
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
              <BarChart data={data}>
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Graph;
