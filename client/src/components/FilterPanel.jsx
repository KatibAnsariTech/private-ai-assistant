import React, { useState } from 'react';
import { Search, Filter, X, Calendar, DollarSign, UserCheck } from 'lucide-react';

const FilterPanel = ({ onFilter, onClear }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filters, setFilters] = useState({
        searchText: '',
        minAmount: '',
        maxAmount: '',
        startDate: '',
        endDate: '',
        initiatorStatus: '',
        l1Status: '',
        l2Status: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onFilter(filters);
    };

    const handleClear = () => {
        setFilters({
            searchText: '',
            minAmount: '',
            maxAmount: '',
            startDate: '',
            endDate: '',
            initiatorStatus: '',
            l1Status: '',
            l2Status: ''
        });
        onClear();
    };

    return (
        <div className="glass-card p-4 mb-6">
            {/* Search Bar - Always Visible */}
            <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        name="searchText"
                        value={filters.searchText}
                        onChange={handleChange}
                        placeholder="Search by WID, Vendor Name, Cost Center..."
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-all"
                    />
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-3 rounded-xl border transition-all flex items-center gap-2 font-medium ${isOpen
                            ? 'bg-accent-purple/20 border-accent-purple text-accent-purple'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                >
                    <Filter className="w-5 h-5" />
                    Filters
                </button>
                <button
                    onClick={handleSubmit}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-purple text-white font-bold shadow-lg hover:shadow-primary-500/20 transition-all"
                >
                    Apply
                </button>
            </div>

            {/* Expandable Filters */}
            {isOpen && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                    {/* Amount Range */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" /> Amount Range
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                name="minAmount"
                                value={filters.minAmount}
                                onChange={handleChange}
                                placeholder="Min"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-accent-purple focus:outline-none"
                            />
                            <input
                                type="number"
                                name="maxAmount"
                                value={filters.maxAmount}
                                onChange={handleChange}
                                placeholder="Max"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-accent-purple focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Date Range */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Date Range
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                name="startDate"
                                value={filters.startDate}
                                onChange={handleChange}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-accent-purple focus:outline-none"
                            />
                            <input
                                type="date"
                                name="endDate"
                                value={filters.endDate}
                                onChange={handleChange}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-accent-purple focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Status Filters */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <UserCheck className="w-4 h-4" /> Approval Status
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <select
                                name="initiatorStatus"
                                value={filters.initiatorStatus}
                                onChange={handleChange}
                                className="bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200 focus:border-accent-purple focus:outline-none"
                            >
                                <option value="">Initiator</option>
                                <option value="Approved">Approved</option>
                                <option value="Pending">Pending</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                            <select
                                name="l1Status"
                                value={filters.l1Status}
                                onChange={handleChange}
                                className="bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200 focus:border-accent-purple focus:outline-none"
                            >
                                <option value="">L1 Status</option>
                                <option value="Approved">Approved</option>
                                <option value="Pending">Pending</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                            <select
                                name="l2Status"
                                value={filters.l2Status}
                                onChange={handleChange}
                                className="bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200 focus:border-accent-purple focus:outline-none"
                            >
                                <option value="">L2 Status</option>
                                <option value="Approved">Approved</option>
                                <option value="Pending">Pending</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {isOpen && (
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={handleClear}
                        className="text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                        <X className="w-4 h-4" /> Clear all filters
                    </button>
                </div>
            )}
        </div>
    );
};

export default FilterPanel;
