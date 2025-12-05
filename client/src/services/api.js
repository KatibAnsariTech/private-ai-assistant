import axios from 'axios';

// Base axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for adding auth tokens (if needed in future)
api.interceptors.request.use(
    (config) => {
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

// ==================== FILE UPLOAD ====================

/**
 * Upload Excel file to backend
 * @param {File} file - Excel file to upload
 * @returns {Promise} Response with upload results
 */
export const uploadExcel = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/api/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

// ==================== AI QUERIES ====================

/**
 * Ask AI a natural language question about the data
 * @param {string} question - Natural language question
 * @returns {Promise} Response with AI answer and data
 */
export const askAI = async (question) => {
    return api.post('/api/ask', { question });
};

// ==================== DATA QUERIES ====================

/**
 * Search by text across columns
 * @param {string} searchText - Text to search for
 * @param {Array<string>} columns - Columns to search in
 * @param {number} limit - Max results to return
 * @returns {Promise} Search results
 */
export const searchByText = async (searchText, columns = [], limit = 100) => {
    return api.post('/api/query/search', { searchText, columns, limit });
};

/**
 * Filter by amount range
 * @param {number} minAmount - Minimum amount
 * @param {number} maxAmount - Maximum amount
 * @param {number} limit - Max results to return
 * @returns {Promise} Filtered results
 */
export const filterByAmount = async (minAmount, maxAmount, limit = 100) => {
    return api.post('/api/query/amount', { minAmount, maxAmount, limit });
};

/**
 * Filter by date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} dateField - Date field to filter on (default: DocumentDate)
 * @param {number} limit - Max results to return
 * @returns {Promise} Filtered results
 */
export const filterByDateRange = async (startDate, endDate, dateField = 'DocumentDate', limit = 100) => {
    return api.post('/api/query/date', { startDate, endDate, dateField, limit });
};

/**
 * Filter by approval status
 * @param {string} initiatorStatus - Initiator status
 * @param {string} l1Status - L1 Approver status
 * @param {string} l2Status - L2 Approver status
 * @param {number} limit - Max results to return
 * @returns {Promise} Filtered results
 */
export const filterByStatus = async (initiatorStatus, l1Status, l2Status, limit = 100) => {
    return api.post('/api/query/status', { initiatorStatus, l1Status, l2Status, limit });
};

/**
 * Combined multi-field filtering
 * @param {Object} filters - Filter object with various criteria
 * @returns {Promise} Filtered results
 */
export const combineFilters = async (filters) => {
    return api.post('/api/query/filter', filters);
};

/**
 * Get paginated data
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {string} sortBy - Field to sort by
 * @param {number} sortOrder - Sort order (1 for asc, -1 for desc)
 * @returns {Promise} Paginated results
 */
export const getPaginatedData = async (page = 1, limit = 50, sortBy = 'excelRowNumber', sortOrder = 1) => {
    return api.post('/api/query/paginate', { page, limit, sortBy, sortOrder });
};

/**
 * Get statistics
 * @returns {Promise} Statistics data
 */
export const getStatistics = async () => {
    return api.get('/api/query/stats');
};

export default api;

