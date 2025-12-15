import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Loader2 } from "lucide-react";
import { askAI } from "../services/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from "recharts";
import { useSearchParams, useNavigate } from "react-router-dom";

const COLORS = [
  "#a855f7", // Bright Purple
  "#ec4899", // Bright Pink
  "#eab308", // Bright Yellow
  "#22c55e", // Bright Green
  "#3b82f6", // Bright Blue
  "#f43f5e", // Bright Red
  "#06b6d4", // Bright Cyan
  "#8b5cf6"  // Bright Indigo
];

// Custom Tooltip component for dark mode styling
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800/90 border border-slate-700/50 p-2 rounded-md shadow-lg text-sm text-white">
        <p className="font-semibold text-slate-300">{label}</p>
        {payload.map((item, index) => (
          <p key={index} style={{ color: item.color || '#fff' }}>
            {`${item.name || 'Value'}: ${item.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const AIChat = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "assistant",
      content:
        "👋 Hello! I'm your AI assistant for Excel data analysis.\n\n**Try asking:**\n• Graph of credit vs debit\n• Vendor distribution\n• Cost center breakdown",
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSearch = async (query) => {
    if (!query.trim() || isLoading) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: query, timestamp: new Date() }
    ]);

    setInput("");
    setIsLoading(true);

    try {
      const res = await askAI(query);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: res.data.answer || "Here are the results",
          data: res.data.data,
          graph: res.data.graph,
          presentType: res.data.presentType,
          timestamp: new Date()
        }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "❌ Something went wrong.",
          isError: true,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      handleSearch(q);
      navigate("/chat", { replace: true });
    }
  }, [searchParams, navigate, handleSearch]);

  // Removed exportToCSV function

  return (
    <div className="flex flex-col h-full glass-card">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center">
              {msg.role === "user" ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>

            <div className="max-w-[90%]">
              <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl px-4 py-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>

                {/* GRAPH - Always show when available */}
                {msg.graph?.x?.length > 0 && msg.graph?.y?.length > 0 && (() => {
                  const allData = msg.graph.x.map((x, i) => ({
                    name: String(x),
                    value: msg.graph.y[i] ?? 0
                  }));

                  // Sort by value descending for better visualization
                  const chartData = [...allData].sort((a, b) => b.value - a.value);

                  // Use presentType from message, fallback to graph.type
                  const chartType = msg.presentType || msg.graph.type || "bar";

                  // Custom label truncation
                  const truncateLabel = (label) => {
                    const str = String(label);
                    return str.length > 20 ? str.substring(0, 20) + '...' : str;
                  };

                  // Dynamic width based on number of data points
                  const minWidth = 800;
                  const pixelsPerDataPoint = 60;
                  const dynamicWidth = Math.max(minWidth, chartData.length * pixelsPerDataPoint);

                  return (
                    <div className="mt-4 bg-slate-900/60 p-4 rounded-xl">
                      <p className="text-xs text-slate-400 mb-2">
                        Showing {chartData.length} items {chartData.length > 10 ? '(scroll horizontally for more)' : ''}
                      </p>
                      <div className="overflow-x-auto">
                        <ResponsiveContainer width={dynamicWidth} height={450}>
                          {chartType === "pie" ? (
                            <PieChart>
                              <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={70}
                                outerRadius={140}
                                paddingAngle={3}
                                label
                              >
                                {chartData.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip />} />
                              <Legend />
                            </PieChart>
                          ) : chartType === "line" ? (
                            <LineChart data={chartData}>
                              <XAxis
                                dataKey="name"
                                stroke="#a1a1aa"
                                angle={-45}
                                textAnchor="end"
                                height={100}
                                interval={0}
                                tickFormatter={truncateLabel}
                              />
                              <YAxis stroke="#a1a1aa" />
                              <Tooltip content={<CustomTooltip />} />
                              <Legend />
                              <Line dataKey="value" stroke={COLORS[0]} strokeWidth={3} />
                            </LineChart>
                          ) : (
                            <BarChart data={chartData}>
                              <XAxis
                                dataKey="name"
                                stroke="#a1a1aa"
                                angle={-45}
                                textAnchor="end"
                                height={100}
                                interval={0}
                                tickFormatter={truncateLabel}
                              />
                              <YAxis stroke="#a1a1aa" />
                              <Tooltip content={<CustomTooltip />} />
                              <Legend />
                              <Bar dataKey="value">
                                {chartData.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })()}

                {/* TABLE - Always show when data exists, regardless of graph */}
                {Array.isArray(msg.data) && msg.data.length > 0 && (() => {
                  const firstItem = msg.data[0];
                  const hasMultipleFields = Object.keys(firstItem).length > 2; // More than label/type and count

                  // Show table when data has multiple fields
                  if (hasMultipleFields) {
                    return (
                      <div className="mt-4 overflow-x-auto">
                        <h4 className="text-sm font-semibold text-slate-300 mb-2">Detailed Data</h4>
                        <table className="w-full text-sm text-left border border-slate-700 rounded-lg overflow-hidden">
                          <thead className="text-xs uppercase bg-slate-800 text-slate-400">
                            <tr>
                              {Object.keys(firstItem).map((key) => (
                                <th key={key} className="px-4 py-3 border-b border-slate-700">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.data.slice(0, 10).map((row, idx) => (
                              <tr key={idx} className="border-b border-slate-700 hover:bg-slate-800/50 transition-colors">
                                {Object.values(row).map((val, i) => (
                                  <td key={i} className="px-4 py-3 text-slate-300">
                                    {typeof val === 'number' ? val.toLocaleString() : String(val)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {msg.data.length > 10 && (
                          <p className="text-xs text-slate-500 mt-2">
                            Showing 10 of {msg.data.length} results
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 text-slate-400">
            <Loader2 className="animate-spin" /> Analyzing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch(input);
        }}
        className="p-4 border-t border-slate-700/50"
      >
        <div className="relative">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-white" // Added text-white for visibility
            placeholder="Ask something…"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;