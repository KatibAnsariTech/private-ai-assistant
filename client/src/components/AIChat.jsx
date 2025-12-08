import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { askAI } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useSearchParams, useNavigate } from 'react-router-dom';

const AIChat = () => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        {
            id: 1,
            role: 'assistant',
            content: "Hello! I'm your personal AI assistant. I can help you analyze your Excel data. Try asking 'Show me the top 10 entries' or 'What is the total amount?'",
            timestamp: new Date()
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const hasSearchedRef = useRef(false);

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

            const aiMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: response.data.answer,
                data: response.data.data,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            const errorMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: "I'm sorry, I encountered an error processing your request. Please try again.",
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
            // Clear the query param to prevent re-triggering on re-renders,
            // but allow new clicks to trigger it again (since they change the URL)
            navigate('/chat', { replace: true });
        }
    }, [searchParams, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        handleSearch(input);
    };

    return (
        <div className="flex flex-col h-full glass-card overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center shadow-lg shadow-accent-purple/20">
                    <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-white">AI Assistant</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Online & Ready
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
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user'
                            ? 'bg-slate-700'
                            : 'bg-gradient-to-br from-accent-purple to-accent-pink'
                            }`}>
                            {msg.role === 'user' ? <User className="w-5 h-5 text-slate-300" /> : <Sparkles className="w-5 h-5 text-white" />}
                        </div>

                        {/* Message Bubble */}
                        <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div
                                className={`px-5 py-3.5 rounded-2xl shadow-md ${msg.role === 'user'
                                    ? 'bg-primary-600 text-white rounded-tr-sm'
                                    : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tl-sm'
                                    } ${msg.isError ? 'border-red-500/50 bg-red-500/10 text-red-200' : ''}`}
                            >
                                <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            table: ({ node, ...props }) => (
                                                <div className="overflow-x-auto my-4 rounded-lg border border-slate-700/50">
                                                    <table className="min-w-full divide-y divide-slate-700/50 bg-slate-900/50" {...props} />
                                                </div>
                                            ),
                                            thead: ({ node, ...props }) => (
                                                <thead className="bg-slate-800/80" {...props} />
                                            ),
                                            tbody: ({ node, ...props }) => (
                                                <tbody className="divide-y divide-slate-700/50" {...props} />
                                            ),
                                            tr: ({ node, ...props }) => (
                                                <tr className="hover:bg-slate-800/30 transition-colors" {...props} />
                                            ),
                                            th: ({ node, ...props }) => (
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider" {...props} />
                                            ),
                                            td: ({ node, ...props }) => (
                                                <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap" {...props} />
                                            ),
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                                {/* DATA PREVIEW */}
                                {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/30">

                                        <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
                                            <span className="text-xs font-medium text-slate-400">
                                                Data Preview ({msg.data.length} items)
                                            </span>
                                        </div>

                                        {/* CASE 1 — ARRAY OF STRINGS */}
                                        {typeof msg.data[0] === "string" ? (
                                            <div className="overflow-x-auto max-h-[300px]">
                                                <table className="min-w-full divide-y divide-slate-700/50">
                                                    <thead className="bg-slate-800/80 sticky top-0 z-10">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                                                                Value
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-700/50">
                                                        {msg.data.map((val, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                                                <td className="px-4 py-2 text-sm text-slate-300">{val}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            /* CASE 2 — ARRAY OF OBJECTS (unique vendors + all other queries) */
                                            <div className="overflow-x-auto max-h-[300px]">
                                                <table className="min-w-full divide-y divide-slate-700/50">
                                                    <thead className="bg-slate-800/80 sticky top-0 z-10">
                                                        <tr>
                                                            {Object.keys(msg.data[0]).map((key) => (
                                                                <th
                                                                    key={key}
                                                                    className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider whitespace-nowrap"
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
                                                                    <td key={j} className="px-4 py-2 text-sm text-slate-300 whitespace-nowrap">
                                                                        {typeof val === "object" ? JSON.stringify(val) : String(val)}
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
                            <span className="text-[10px] text-slate-500 mt-1 px-1">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div className="bg-slate-800/80 border border-slate-700/50 px-5 py-3.5 rounded-2xl rounded-tl-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-accent-purple animate-spin" />
                            <span className="text-sm text-slate-400">Thinking...</span>
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
                        placeholder="Ask something about your data..."
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-4 pr-12 py-3.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-all"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-gradient-to-r from-primary-600 to-accent-purple text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary-500/20 transition-all"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AIChat;
