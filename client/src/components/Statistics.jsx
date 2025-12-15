import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, FileText, RefreshCw } from 'lucide-react';
import { getStatistics } from '../services/api';

const StatCard = ({ title, value, icon: Icon, color, loading }) => (
    <div className="glass-card p-6 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
            <Icon className="w-24 h-24" />
        </div>
        <div className="relative z-10">
            <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center ${color} bg-opacity-20`}>
                <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
            </div>
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
            {loading ? (
                <div className="h-8 w-24 bg-slate-700/50 rounded animate-pulse mt-2" />
            ) : (
                <p className="text-3xl font-bold text-white mt-1">{value}</p>
            )}
        </div>
    </div>
);

const Statistics = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const response = await getStatistics();
            setStats(response.data.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-accent-purple" />
                    Dashboard Overview
                </h2>
                <button
                    onClick={fetchStats}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Refresh Statistics"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard
                    title="Total Documents"
                    value={stats?.totalEntries?.toLocaleString() || '0'}
                    icon={FileText}
                    color="bg-blue-500 text-blue-500"
                    loading={loading}
                />
                <StatCard
                    title="Unique Vendor Names"
                    value={stats?.uniqueCounts?.vendors?.toLocaleString() || '0'}
                    icon={Users}
                    color="bg-purple-500 text-purple-500"
                    loading={loading}
                />
            </div>
        </div>
    );
};

export default Statistics;
