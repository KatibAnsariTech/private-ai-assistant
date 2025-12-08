import React from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const DataTable = ({ data, columns, pagination, onPageChange, onSort, sortConfig }) => {
    
    // -------- CASE 1: SIMPLE ARRAY OF STRINGS (unique vendor names) --------
    if (Array.isArray(data) && typeof data[0] === "string") {
        return (
            <div className="w-full space-y-4">
                <div className="overflow-x-auto rounded-xl border border-slate-700/50 shadow-xl bg-slate-900/40">
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs uppercase bg-slate-800/80 text-slate-400">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {data.map((value, index) => (
                                <tr key={index} className="bg-slate-800/20 hover:bg-slate-700/30">
                                    <td className="px-6 py-4">{value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* No pagination needed for simple string lists */}
            </div>
        );
    }

    // -------- CASE 2: NORMAL TABLE MODE (array of objects) --------
    if (!data || data.length === 0) {
        return (
            <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <p className="text-slate-400">No data found.</p>
            </div>
        );
    }

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4 text-slate-600" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-4 h-4 text-accent-purple" />
            : <ArrowDown className="w-4 h-4 text-accent-purple" />;
    };

    return (
        <div className="w-full space-y-4">
            <div className="overflow-x-auto rounded-xl border border-slate-700/50 shadow-xl bg-slate-900/40 backdrop-blur-sm">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs uppercase bg-slate-800/80 text-slate-400 sticky top-0 z-10">
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-800 group"
                                    onClick={() => onSort(col.key)}
                                >
                                    <div className="flex items-center gap-2">
                                        {col.label}
                                        {getSortIcon(col.key)}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-700/50">
                        {data.map((row, index) => (
                            <tr key={row._id || index} className="bg-slate-800/20 hover:bg-slate-700/30 transition-colors">
                                {columns.map((col) => (
                                    <td key={`${index}-${col.key}`} className="px-6 py-4">
                                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>

                </table>
            </div>

            {/* Pagination */}
            {pagination && (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    <div className="text-sm text-slate-400">
                        Showing <span className="text-white">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                        <span className="text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</span>{' '}
                        of <span className="text-white">{pagination.total}</span> results
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onPageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <span className="px-4 py-1 rounded-lg bg-slate-800 text-sm font-medium">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>

                        <button
                            onClick={() => onPageChange(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                            className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataTable;
