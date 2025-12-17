import express from "express";
import {
    searchByText,
    filterByAmount,
    filterByDateRange,
    filterByStatus,
    combineFilters,
    getStatistics,
    getAllWithPagination
} from "../controllers/queryController.js";

const router = express.Router();

// Search by text across columns
router.post("/search", async (req, res) => {
    try {
        const { searchText, columns, limit = 100 } = req.body;
        const results = await searchByText(searchText, columns, limit);
        res.json({ success: true, data: results, count: results.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Filter by amount range
router.post("/amount", async (req, res) => {
    try {
        const { minAmount, maxAmount, limit = 100 } = req.body;
        const results = await filterByAmount(minAmount, maxAmount, limit);
        res.json({ success: true, data: results, count: results.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Filter by date range
router.post("/date", async (req, res) => {
    try {
        const { startDate, endDate, dateField = "DocumentDate", limit = 100 } = req.body;
        const results = await filterByDateRange(startDate, endDate, dateField, limit);
        res.json({ success: true, data: results, count: results.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Filter by status
router.post("/status", async (req, res) => {
    try {
        const { initiatorStatus, l1Status, l2Status, limit = 100 } = req.body;
        const results = await filterByStatus(initiatorStatus, l1Status, l2Status, limit);
        res.json({ success: true, data: results, count: results.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Combined multi-field filtering with pagination
router.post("/filter", async (req, res) => {
    try {
        const results = await combineFilters(req.body);
        res.json({ success: true, ...results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get statistics
router.get("/stats", async (req, res) => {
    try {
        const stats = await getStatistics();
        // console.log("statistics data : ",stats);
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get paginated data
router.post("/paginate", async (req, res) => {
    try {
        const { page = 1, limit = 50, sortBy = "excelRowNumber", sortOrder = 1 } = req.body;
        const results = await getAllWithPagination(page, limit, sortBy, sortOrder);
        res.json({ success: true, ...results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
