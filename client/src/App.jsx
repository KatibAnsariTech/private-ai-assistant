import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Database, MessageSquare, Sparkles } from 'lucide-react';
import FileUpload from './components/FileUpload';
import AIChat from './components/AIChat';
import Statistics from './components/Statistics';
import FilterPanel from './components/FilterPanel';
import DataTable from './components/DataTable';
import { getPaginatedData, combineFilters } from './services/api';
import FloatingChat from "./components/FloatingChat";

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
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading data...</div>
        ) : (
          <DataTable
            data={data}
            columns={columns}
            pagination={pagination}
            onPageChange={handlePageChange}
            onSort={handleSort}
            sortConfig={sortConfig}
          />
        )}
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

  // IMPROVED: Better categorized questions
  const commonQuestions = [
    {
      category: "📊 Statistics",
      questions: [
        "How many total entries are there?",
        "Count all unique Journal Entry Type ",
        "Show total, average, max and min amount",
        "Which vendor has highest entries?",
        "Show cost center distribution"
      ]
    },
    {
      category: "🔍 Filters",
      questions: [
        "Show entries for vendor {vendor name}",
        "Show entries where amount > {amount}",
        "Show entries from {startDate} to {endDate}",
        "Show entries approved by {status}",
      ]
    },
    {
      category: "📈 Status",
      questions: [
        "Show L1 approval overview",
        "Show L2 approval overview"
      ]
    }
  ];

  return (
    <div className="min-h-screen pb-12">
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-accent-purple flex items-center justify-center shadow-lg shadow-primary-500/30">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                  DataInsight AI
                </span>
                <p className="text-xs text-slate-500">Excel Analytics Assistant</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
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

        {/* Left Sidebar */}
        <aside className="w-full lg:w-1/3 xl:w-1/4 space-y-6">
          <div className="sticky top-24">

            {/* File Upload - Dashboard Only */}
            {location.pathname === "/" && (
              <>
                <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50 shadow-xl">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary-400" />
                    Upload Data
                  </h2>
                  <FileUpload onUploadSuccess={handleUploadSuccess} />
                </div>

                <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-green-400" />
                    <h3 className="text-sm font-bold text-green-400">System Status</h3>
                  </div>
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    All systems operational
                  </div>
                </div>
              </>
            )}

            {/* Common Questions - Chat Page Only */}
            {location.pathname === "/chat" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <Sparkles className="w-5 h-5 text-accent-purple" />
                  <h3 className="text-lg font-bold text-white">Try These Questions</h3>
                </div>

                <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                  {commonQuestions.map((category, idx) => (
                    <div key={idx} className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">
                        {category.category}
                      </h4>
                      {category.questions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => navigate(`/chat?q=${encodeURIComponent(q)}`)}
                          className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-accent-purple/50 transition-all text-sm text-slate-300 hover:text-white group"
                        >
                          <span className="line-clamp-2">{q}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 min-w-0 space-y-8">
          <Routes>
            <Route path="/" element={<Dashboard refreshTrigger={refreshTrigger} />} />
            <Route path="/chat" element={
              <div className="animate-slide-up h-[calc(100vh-8rem)] flex flex-col">
                <div className="text-center mb-6">
                  <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                    <Sparkles className="w-8 h-8 text-accent-purple" />
                    AI Data Assistant
                  </h2>
                  <p className="text-slate-400">
                    Get instant insights, visualizations, and answers from your Excel data.
                  </p>
                </div>
                <div className="flex-1 bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
                  <AIChat />
                </div>
              </div>
            } />
          </Routes>

          {/* Floating Chat - Dashboard Only */}
          {location.pathname === "/" && <FloatingChat />}
        </main>
      </div>
    </div>
  );
}

export default App;