import Entry from "../model/Entry.js";

// ========== ORIGINAL QUERY FUNCTIONS ==========

export const getColumns = async () => {
    const sample = await Entry.findOne();
    if (!sample) return [];
    return Object.keys(sample.toObject()).filter(
        key => !["_id", "__v", "createdAt", "updatedAt"].includes(key)
    );
};

export const getTopN = async (n = 10, projection = {}) => {
    return Entry.find()
        .sort({ excelRowNumber: 1 })
        .limit(n)
        .select({ ...projection, _id: 0 });
};

export const getBottomN = async (n = 10, projection = {}) => {
    return Entry.find()
        .sort({ excelRowNumber: -1 })
        .limit(n)
        .select({ ...projection, _id: 0 });
};

export const getUnique = async (column) => {
    return Entry.distinct(column);
};

export const getSpecificColumns = async (n = 10, selectedColumns = []) => {
    const projection = {};
    selectedColumns.forEach(col => (projection[col] = 1));

    return Entry.find()
        .sort({ excelRowNumber: 1 })
        .limit(n)
        .select({ ...projection, _id: 0 });
};

export const getUniqueCombination = async (fields = []) => {
    return Entry.aggregate([
        {
            $group: {
                _id: fields.reduce((o, f) => ({ ...o, [f]: `$${f}` }), {})
            }
        },
        {
            $project: fields.reduce(
                (o, f) => ({ ...o, [f]: `$_id.${f}` }),
                { _id: 0 }
            )
        }
    ]);
};

// ========== ADVANCED QUERY FUNCTIONS ==========

/**
 * Search for text across all columns or specific columns
 * @param {string} searchText - Text to search for
 * @param {Array} columns - Optional array of column names to search in
 * @param {number} limit - Maximum number of results
 */
export const searchByText = async (searchText, columns = null, limit = 100) => {
    if (!searchText) return [];

    const searchRegex = new RegExp(searchText, "i"); // Case-insensitive search

    let query;
    if (columns && columns.length > 0) {
        // Search only in specified columns
        query = {
            $or: columns.map(col => ({ [col]: searchRegex }))
        };
    } else {
        // Search across all text fields
        query = {
            $or: [
                { zvolvWID: searchRegex },
                { WID: searchRegex },
                { DocumentDate: searchRegex },
                { PostingDate: searchRegex },
                { JournalEntrySrNo: searchRegex },
                { JournalEntryBusinessArea: searchRegex },
                { JournalEntryAccountType: searchRegex },
                { JournalEntryType: searchRegex },
                { JournalEntryVendorName: searchRegex },
                { JournalEntryVendorNumber: searchRegex },
                { JournalEntryCostCenter: searchRegex },
                { JournalEntryProfitCenter: searchRegex },
                { JournalEntryAmount: searchRegex },
                { JournalEntryPersonalNumber: searchRegex },
                { InitiatorName: searchRegex },
                { InitiatorStatus: searchRegex },
                { L1ApproverName: searchRegex },
                { L1ApproverStatus: searchRegex },
                { L2ApproverName: searchRegex },
                { L2ApproverStatus: searchRegex },
                { DocumentNumberOrErrorMessage: searchRegex },
                { ReversalDocumentNumber: searchRegex }
            ]
        };
    }

    return Entry.find(query)
        .limit(limit)
        .select({ _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
        .lean();
};

/**
 * Filter by amount range
 * @param {number} minAmount - Minimum amount
 * @param {number} maxAmount - Maximum amount
 * @param {number} limit - Maximum number of results
 */
export const filterByAmount = async (minAmount = null, maxAmount = null, limit = 100) => {
    const query = {};

    // Build amount filter
    if (minAmount !== null || maxAmount !== null) {
        query.$expr = {};
        const conditions = [];

        if (minAmount !== null) {
            conditions.push({ $gte: [{ $toDouble: "$JournalEntryAmount" }, minAmount] });
        }
        if (maxAmount !== null) {
            conditions.push({ $lte: [{ $toDouble: "$JournalEntryAmount" }, maxAmount] });
        }

        query.$expr = conditions.length > 1 ? { $and: conditions } : conditions[0];
    }

    return Entry.find(query)
        .limit(limit)
        .select({ _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
        .lean();
};

/**
 * Filter by date range
 * @param {string} startDate - Start date (YYYY-MM-DD format)
 * @param {string} endDate - End date (YYYY-MM-DD format)
 * @param {string} dateField - Which date field to filter ('DocumentDate' or 'PostingDate')
 * @param {number} limit - Maximum number of results
 */
export const filterByDateRange = async (startDate = null, endDate = null, dateField = "DocumentDate", limit = 100) => {
    const query = {};

    if (startDate || endDate) {
        query[dateField] = {};
        if (startDate) query[dateField].$gte = startDate;
        if (endDate) query[dateField].$lte = endDate;
    }

    return Entry.find(query)
        .limit(limit)
        .select({ _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
        .lean();
};

/**
 * Filter by approval status
 * @param {string} initiatorStatus - Initiator's approval status
 * @param {string} l1Status - L1 Approver's status
 * @param {string} l2Status - L2 Approver's status
 * @param {number} limit - Maximum number of results
 */
export const filterByStatus = async (initiatorStatus = null, l1Status = null, l2Status = null, limit = 100) => {
    const query = {};

    if (initiatorStatus) query.InitiatorStatus = new RegExp(initiatorStatus, "i");
    if (l1Status) query.L1ApproverStatus = new RegExp(l1Status, "i");
    if (l2Status) query.L2ApproverStatus = new RegExp(l2Status, "i");

    return Entry.find(query)
        .limit(limit)
        .select({ _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
        .lean();
};

/**
 * Combine multiple filters
 * @param {Object} filters - Object containing all filter parameters
 */
export const combineFilters = async (filters) => {
    const {
        searchText = null,
        searchColumns = null,
        minAmount = null,
        maxAmount = null,
        startDate = null,
        endDate = null,
        dateField = "DocumentDate",
        initiatorStatus = null,
        l1Status = null,
        l2Status = null,
        limit = 100,
        page = 1,
        sortBy = "excelRowNumber",
        sortOrder = 1
    } = filters;

    const query = {};

    // Text search
    if (searchText) {
        const searchRegex = new RegExp(searchText, "i");
        if (searchColumns && searchColumns.length > 0) {
            query.$or = searchColumns.map(col => ({ [col]: searchRegex }));
        } else {
            query.$or = [
                { zvolvWID: searchRegex },
                { WID: searchRegex },
                { JournalEntryVendorName: searchRegex },
                { InitiatorName: searchRegex },
                { L1ApproverName: searchRegex },
                { L2ApproverName: searchRegex },
                { DocumentNumberOrErrorMessage: searchRegex }
            ];
        }
    }

    // Amount filter
    if (minAmount !== null || maxAmount !== null) {
        const amountConditions = [];
        if (minAmount !== null) {
            amountConditions.push({ $gte: [{ $toDouble: "$JournalEntryAmount" }, minAmount] });
        }
        if (maxAmount !== null) {
            amountConditions.push({ $lte: [{ $toDouble: "$JournalEntryAmount" }, maxAmount] });
        }
        query.$expr = amountConditions.length > 1 ? { $and: amountConditions } : amountConditions[0];
    }

    // Date range filter
    if (startDate || endDate) {
        query[dateField] = {};
        if (startDate) query[dateField].$gte = startDate;
        if (endDate) query[dateField].$lte = endDate;
    }

    // Status filters
    if (initiatorStatus) query.InitiatorStatus = new RegExp(initiatorStatus, "i");
    if (l1Status) query.L1ApproverStatus = new RegExp(l1Status, "i");
    if (l2Status) query.L2ApproverStatus = new RegExp(l2Status, "i");

    const skip = (page - 1) * limit;
    const sortObj = { [sortBy]: sortOrder };

    const [results, total] = await Promise.all([
        Entry.find(query)
            .sort(sortObj)
            .skip(skip)
            .limit(limit)
            .select({ _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
            .lean(),
        Entry.countDocuments(query)
    ]);

    return {
        data: results,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Get summary statistics
 */
export const getStatistics = async () => {
    try {
        const totalEntries = await Entry.countDocuments();

        if (totalEntries === 0) {
            return {
                totalEntries: 0,
                amountStats: { totalAmount: 0, avgAmount: 0, maxAmount: 0, minAmount: 0 },
                uniqueCounts: { vendors: 0 },
            };
        }

        const amountAgg = await Entry.aggregate([
            // CLEAN ALL COMMON EXCEL FORMATS
            {
                $addFields: {
                    cleanedAmount: {
                        $trim: {
                            input: {
                                $replaceAll: {
                                    input: {
                                        $replaceAll: {
                                            input: {
                                                $replaceAll: {
                                                    input: "$JournalEntryAmount",
                                                    find: ",",
                                                    replacement: ""
                                                }
                                            },
                                            find: "₹",
                                            replacement: ""
                                        }
                                    },
                                    find: " ",
                                    replacement: ""
                                }
                            }
                        }
                    }
                }
            },

            // Remove trailing minus: 5000- → -5000
            {
                $addFields: {
                    cleanedAmount: {
                        $cond: [
                            { $regexMatch: { input: "$cleanedAmount", regex: /-$/ } },
                            { $multiply: [-1, { $toDouble: { $substr: ["$cleanedAmount", 0, { $subtract: [{ $strLenCP: "$cleanedAmount" }, 1] }] } }] },
                            "$cleanedAmount"
                        ]
                    }
                }
            },

            // Handle parentheses (negative numbers): (5000) → -5000
            {
                $addFields: {
                    cleanedAmount: {
                        $cond: [
                            { $regexMatch: { input: "$cleanedAmount", regex: /^\(.*\)$/ } },
                            {
                                $multiply: [
                                    -1,
                                    {
                                        $toDouble: {
                                            $substr: [
                                                "$cleanedAmount",
                                                1,
                                                { $subtract: [{ $strLenCP: "$cleanedAmount" }, 2] }
                                            ]
                                        }
                                    }
                                ]
                            },
                            "$cleanedAmount"
                        ]
                    }
                }
            },

            // Convert cleaned string → number
            {
                $addFields: {
                    amountNumeric: {
                        $convert: {
                            input: "$cleanedAmount",
                            to: "double",
                            onError: 0,
                            onNull: 0
                        }
                    }
                }
            },

            // Group statistics
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amountNumeric" },
                    avgAmount: { $avg: "$amountNumeric" },
                    maxAmount: { $max: "$amountNumeric" },
                    minAmount: { $min: "$amountNumeric" }
                }
            }
        ]);

        // UNIQUE VENDORS (filter empty)
        const uniqueVendors = await Entry.distinct("JournalEntryVendorName", {
            JournalEntryVendorName: { $nin: ["", null, undefined] }
        });

        return {
            totalEntries,
            amountStats: amountAgg[0] || { totalAmount: 0, avgAmount: 0, maxAmount: 0, minAmount: 0 },
            uniqueCounts: { vendors: uniqueVendors.length }
        };

    } catch (error) {
        console.error("Error in getStatistics:", error);
        return {
            totalEntries: 0,
            amountStats: { totalAmount: 0, avgAmount: 0, maxAmount: 0, minAmount: 0 },
            uniqueCounts: { vendors: 0 }
        };
    }
};


/**
 * Get paginated results with sorting
 */
export const getAllWithPagination = async (page = 1, limit = 50, sortBy = "excelRowNumber", sortOrder = 1) => {
    const skip = (page - 1) * limit;
    const sortObj = { [sortBy]: sortOrder };

    const [results, total] = await Promise.all([
        Entry.find()
            .sort(sortObj)
            .skip(skip)
            .limit(limit)
            .select({ _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
            .lean(),
        Entry.countDocuments()
    ]);

    return {
        data: results,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};


