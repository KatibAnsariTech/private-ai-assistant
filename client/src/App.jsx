import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Database, MessageSquare, Menu, X } from 'lucide-react';
import FileUpload from './components/FileUpload';
import AIChat from './components/AIChat';
import Statistics from './components/Statistics';
import FilterPanel from './components/FilterPanel';
import DataTable from './components/DataTable';
import { getPaginatedData, combineFilters } from './services/api';

function Dashboard({ refreshTrigger }) {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1
  });
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'excelRowNumber', direction: 'asc' });
  const [activeFilters, setActiveFilters] = useState({});

  // Columns definition
  const columns = [
    { key: 'excelRowNumber', label: '#' },
    { key: 'WID', label: 'WID' },
    { key: 'JournalEntryVendorName', label: 'Vendor Name' },
    { key: 'JournalEntryAmount', label: 'Amount' },
    { key: 'DocumentDate', label: 'Date' },
    { key: 'JournalEntryCostCenter', label: 'Cost Center' },
    {
      key: 'InitiatorStatus', label: 'Initiator Status', render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${val === 'Approved' ? 'bg-green-500/20 text-green-400' :
          val === 'Rejected' ? 'bg-red-500/20 text-red-400' :
            'bg-yellow-500/20 text-yellow-400'
          }`}>
          {val}
        </span>
      )
    },
    { key: 'L1ApproverStatus', label: 'L1 Status' },
    { key: 'L2ApproverStatus', label: 'L2 Status' },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      if (Object.keys(activeFilters).length > 0) {
        response = await combineFilters({
          ...activeFilters,
          page: pagination.page,
          limit: pagination.limit,
          sortBy: sortConfig.key,
          sortOrder: sortConfig.direction === 'asc' ? 1 : -1
        });
      } else {
        response = await getPaginatedData(
          pagination.page,
          pagination.limit,
          sortConfig.key,
          sortConfig.direction === 'asc' ? 1 : -1
        );
      }

      setData(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages
      }));

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, sortConfig, activeFilters, refreshTrigger]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilter = (filters) => {
    const cleanedFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== '')
    );
    setActiveFilters(cleanedFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setActiveFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <Statistics key={refreshTrigger} />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Data Explorer</h2>
          <span className="text-sm text-slate-400">
            {(pagination.total || 0).toLocaleString()} records found
          </span>
        </div>
        <FilterPanel onFilter={handleFilter} onClear={handleClearFilters} />
        <DataTable
          data={data}
          columns={columns}
          pagination={pagination}
          onPageChange={handlePageChange}
          onSort={handleSort}
          sortConfig={sortConfig}
        />
      </div>
    </div>
  );
}

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-purple flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                DataInsight AI
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${location.pathname === '/'
                  ? 'bg-slate-800 text-white shadow-lg shadow-primary-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>
              <Link
                to="/chat"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${location.pathname === '/chat'
                  ? 'bg-slate-800 text-white shadow-lg shadow-primary-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
              >
                <MessageSquare className="w-4 h-4" /> AI Assistant
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-8">

        {/* Left Sidebar - File Upload */}
        <aside className="w-full lg:w-1/3 xl:w-1/4 space-y-6">
          <div className="sticky top-24">
            <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-primary-400" />
                Data Source
              </h2>
              <FileUpload onUploadSuccess={handleUploadSuccess} />
            </div>

            {/* Additional Sidebar Info */}
            <div className="mt-6 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <h3 className="text-sm font-medium text-slate-400 mb-2">System Status</h3>
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Online & Ready
              </div>
            </div>

            {/* Common Questions */}
            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider px-1">Common Questions</h3>
              <div className="space-y-2 max-h-[calc(100vh-500px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {[
                  "Show me the top 10 entries",
                  "Show the last 20 rows",
                  "How many are Credit and how many are Debit?",
                  "Breakdown by Initiator Status",
                  "Count entries by Vendor Name",
                  "Show me unique vendors",
                  "Show me unique cost centers",
                  "Show entries where amount is greater than 1,00,000",
                  "What is the average transaction amount?",
                  "Show all entries for vendor TCS",
                  "Show records from 2023 only",
                  "Show all entries approved by Initiator",
                  "Which vendor has the highest amount?",
                  "Summarize the vendor activity"
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      navigate(`/chat?q=${encodeURIComponent(q)}`);
                    }}
                    className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600 transition-all text-sm text-slate-400 hover:text-white group"
                  >
                    <span className="line-clamp-2">{q}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 min-w-0 space-y-8">
          <Routes>
            <Route path="/" element={<Dashboard refreshTrigger={refreshTrigger} />} />
            <Route path="/chat" element={
              <div className="animate-slide-up h-[calc(100vh-8rem)] flex flex-col">
                <div className="text-center mb-6">
                  <h2 className="text-3xl font-bold text-white mb-2">Ask AI About Your Data</h2>
                  <p className="text-slate-400">
                    Get instant insights, summaries, and answers from your uploaded Excel files.
                  </p>
                </div>
                <div className="flex-1 bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden">
                  <AIChat />
                </div>
              </div>
            } />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
