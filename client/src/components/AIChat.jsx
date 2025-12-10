import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Download } from 'lucide-react';
import { askAI } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Cell
} from "recharts";
import { useSearchParams, useNavigate } from 'react-router-dom';

const AIChat = () => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        {
            id: 1,
            role: 'assistant',
            content: "👋 Hello! I'm your AI assistant for Excel data analysis.\n\n**What I can do:**\n• 📊 Create graphs and charts\n• 📋 Show data in tables\n• 🔍 Search and filter your data\n• 📈 Calculate statistics\n\n**Try asking:**\n• *Show graph of credit vs debit*\n• *Graph of top 10 vendors*\n• *Show me unique cost centers*\n• *List entries where amount > 100000*",
            timestamp: new Date()
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSearch = async (query) => {
        if (!query.trim() || isLoading) return;

        const userMessage = {
            id: Date.now(),
            role: 'user',
            content: query,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await askAI(query);
            console.log("AI Response:", response.data);

            const aiMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: response.data.answer || "Here are the results:",
                data: response.data.data,
                graph: response.data.graph,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error("AI Error:", error);
            const errorMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: `❌ Sorry, I encountered an error: ${error.response?.data?.error || error.message || "Unknown error"}`,
                isError: true,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    useEffect(() => {
        const query = searchParams.get('q');
        if (query) {
            handleSearch(query);
            navigate('/chat', { replace: true });
        }
    }, [searchParams]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        handleSearch(input);
    };

    // Enhanced color palette
    const COLORS = [
        '#a855f7', // Purple
        '#06b6d4', // Cyan
        '#10b981', // Green
        '#f59e0b', // Orange
        '#ef4444', // Red
        '#8b5cf6', // Violet
        '#ec4899', // Pink
        '#14b8a6', // Teal
        '#f97316', // Deep Orange
        '#6366f1'  // Indigo
    ];

    const exportToCSV = (data, filename = 'export.csv') => {
        if (!data || data.length === 0) return;

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(h => `"${row[h]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full glass-card overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center shadow-lg shadow-accent-purple/20">
                    <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-white">AI Data Assistant</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Ready to analyze
                    </p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            msg.role === 'user'
                                ? 'bg-slate-700'
                                : 'bg-gradient-to-br from-accent-purple to-accent-pink'
                        }`}>
                            {msg.role === 'user' ? (
                                <User className="w-5 h-5 text-slate-300" />
                            ) : (
                                <Sparkles className="w-5 h-5 text-white" />
                            )}
                        </div>

                        {/* Message Content */}
                        <div className={`flex flex-col ${msg.role === 'user' ? 'items-end max-w-[70%]' : 'items-start max-w-[90%]'}`}>
                            <div
                                className={`px-5 py-3.5 rounded-2xl shadow-md ${
                                    msg.role === 'user'
                                        ? 'bg-primary-600 text-white rounded-tr-sm'
                                        : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tl-sm'
                                } ${msg.isError ? 'border-red-500/50 bg-red-500/10 text-red-200' : ''}`}
                            >
                                {/* Text Content */}
                                <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>

                                {/* GRAPH RENDERING - FIXED WITH WIDER WIDTH */}
                                {msg.graph && msg.graph.x && msg.graph.y && msg.graph.x.length > 0 && msg.graph.y.length > 0 && (
                                    <div className="mt-4 p-6 bg-slate-900/60 rounded-xl border border-slate-700/50 shadow-lg">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-base text-white font-bold flex items-center gap-2">
                                                📊 {msg.graph.label || "Graph Result"}
                                            </h4>
                                            <button
                                                onClick={() => {
                                                    const chartData = msg.graph.x.map((x, i) => ({
                                                        [msg.graph.label || 'Category']: x,
                                                        Count: msg.graph.y[i]
                                                    }));
                                                    exportToCSV(chartData, 'graph-data.csv');
                                                }}
                                                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                                            >
                                                <Download className="w-3 h-3" /> Export
                                            </button>
                                        </div>

                                        {/* INCREASED WIDTH - Now uses min-w-[700px] for better visibility */}
                                        <div className="w-full overflow-x-auto">
                                            <div className="min-w-[700px]">
                                                <ResponsiveContainer width="100%" height={400}>
                                                    <BarChart
                                                        data={msg.graph.x.map((xVal, i) => ({
                                                            name: String(xVal || 'Unknown'),
                                                            value: msg.graph.y[i] || 0
                                                        }))}
                                                        margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                                                    >
                                                        <XAxis
                                                            dataKey="name"
                                                            stroke="#94a3b8"
                                                            fontSize={12}
                                                            tickLine={false}
                                                            axisLine={{ stroke: '#475569', strokeWidth: 2 }}
                                                            angle={-45}
                                                            textAnchor="end"
                                                            height={100}
                                                            interval={0}
                                                            tickFormatter={(value) => {
                                                                const str = String(value);
                                                                return str.length > 20 ? str.substring(0, 20) + '...' : str;
                                                            }}
                                                        />
                                                        <YAxis
                                                            stroke="#94a3b8"
                                                            fontSize={12}
                                                            tickLine={false}
                                                            axisLine={{ stroke: '#475569', strokeWidth: 2 }}
                                                            tickFormatter={(value) => {
                                                                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                                                                if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                                                                return value.toLocaleString();
                                                            }}
                                                        />
                                                        <Tooltip
                                                            contentStyle={{
                                                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                                border: '1px solid #475569',
                                                                borderRadius: '12px',
                                                                padding: '12px 16px',
                                                                boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                                                            }}
                                                            labelStyle={{ 
                                                                color: '#f1f5f9', 
                                                                fontWeight: 'bold',
                                                                marginBottom: '8px',
                                                                fontSize: '14px'
                                                            }}
                                                            itemStyle={{
                                                                color: '#cbd5e1',
                                                                fontSize: '13px'
                                                            }}
                                                            formatter={(value) => [value.toLocaleString(), 'Count']}
                                                            cursor={{ fill: 'rgba(168, 85, 247, 0.1)' }}
                                                        />
                                                        <Legend 
                                                            wrapperStyle={{ 
                                                                paddingTop: '20px',
                                                                fontSize: '13px'
                                                            }}
                                                            iconType="circle"
                                                        />
                                                        <Bar 
                                                            dataKey="value" 
                                                            fill="#a855f7"
                                                            radius={[8, 8, 0, 0]}
                                                            maxBarSize={80}
                                                            name="Count"
                                                        >
                                                            {msg.graph.x.map((entry, index) => (
                                                                <Cell 
                                                                    key={`cell-${index}`} 
                                                                    fill={COLORS[index % COLORS.length]}
                                                                />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Data Summary Below Chart */}
                                        <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-3 gap-4 text-center">
                                            <div>
                                                <p className="text-xs text-slate-400">Total Items</p>
                                                <p className="text-lg font-bold text-white">{msg.graph.x.length}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400">Max Value</p>
                                                <p className="text-lg font-bold text-green-400">
                                                    {Math.max(...msg.graph.y).toLocaleString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400">Total Count</p>
                                                <p className="text-lg font-bold text-blue-400">
                                                    {msg.graph.y.reduce((a, b) => a + b, 0).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* DATA TABLE */}
                                {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/30 shadow-lg">
                                        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between">
                                            <span className="text-sm font-semibold text-slate-300">
                                                📄 Data Preview ({msg.data.length} items)
                                            </span>
                                            <button
                                                onClick={() => exportToCSV(msg.data, 'data-export.csv')}
                                                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                                            >
                                                <Download className="w-3 h-3" /> Export CSV
                                            </button>
                                        </div>

                                        {/* Array of strings */}
                                        {typeof msg.data[0] === "string" ? (
                                            <div className="overflow-x-auto max-h-[400px]">
                                                <table className="min-w-full divide-y divide-slate-700/50">
                                                    <thead className="bg-slate-800/80 sticky top-0 z-10">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                                                                Value
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-700/50">
                                                        {msg.data.map((val, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                                                <td className="px-4 py-2.5 text-sm text-slate-300">{val}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            /* Array of objects */
                                            <div className="overflow-x-auto max-h-[500px]">
                                                <table className="min-w-full divide-y divide-slate-700/50">
                                                    <thead className="bg-slate-800/80 sticky top-0 z-10">
                                                        <tr>
                                                            {Object.keys(msg.data[0]).map((key) => (
                                                                <th
                                                                    key={key}
                                                                    className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap"
                                                                >
                                                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-700/50">
                                                        {msg.data.map((row, i) => (
                                                            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                                                {Object.values(row).map((val, j) => (
                                                                    <td 
                                                                        key={j} 
                                                                        className="px-4 py-2.5 text-sm text-slate-300 whitespace-nowrap"
                                                                    >
                                                                        {typeof val === "object" 
                                                                            ? JSON.stringify(val) 
                                                                            : String(val || '-')
                                                                        }
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            <span className="text-[10px] text-slate-500 mt-1.5 px-1">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-5 h-5 text-white animate-pulse" />
                        </div>
                        <div className="bg-slate-800/80 border border-slate-700/50 px-5 py-3.5 rounded-2xl rounded-tl-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-accent-purple animate-spin" />
                            <span className="text-sm text-slate-400">Analyzing your data...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your data... (e.g., 'show graph of top vendors')"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-4 pr-12 py-3.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/50 transition-all"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-lg bg-gradient-to-r from-primary-600 to-accent-purple text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary-500/30 transition-all hover:scale-105"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
                
                <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <span>💡 Tip: Try "graph of", "show table", "breakdown by"</span>
                </div>
            </div>
        </div>
    );
};

export default AIChat;