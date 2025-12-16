// Updated queryController.js
// Replaces amount handling with robust cleaning and numeric conversion.
// Adds safe preview limits and consistent projections.
// Kept original function names and exports so other code works unchanged.

import Entry from "../model/Entry.js";

/**
 * Helper: get columns from one sample document
 */
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
    const rows = await Entry.find()
        .sort({ excelRowNumber: -1 })  // last rows first
        .limit(n)
        .select({ ...projection, _id: 0 })
        .lean();

    return rows.reverse();  // flip to correct order
};


export const getUnique = async (column) => {
    // return the whole distinct list (caller will slice/preview)
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

/**
 * --- Amount cleaning expression (reusable)
 * This expression:
 * - removes commas
 * - removes currency symbol like ₹
 * - trims spaces
 * - converts parentheses ( (500) -> -500 )
 * - handles trailing minus (5000- -> -5000)
 */
const buildCleanAmountExpression = (fieldName = "$JournalEntryAmount") => {
    // Step 1: remove commas, currency symbol and spaces
    const removeCommas = {
        $replaceAll: {
            input: fieldName,
            find: ",",
            replacement: ""
        }
    };
    const removeCurrency = {
        $replaceAll: {
            input: removeCommas,
            find: "₹",
            replacement: ""
        }
    };
    const removeSpaces = {
        $replaceAll: {
            input: removeCurrency,
            find: " ",
            replacement: ""
        }
    };
    // Trim
    const trimmed = { $trim: { input: removeSpaces } };

    // Handle trailing minus (e.g., "500-" => "-500")
    const trailingMinusHandled = {
        $cond: [
            { $regexMatch: { input: trimmed, regex: /-$/ } },
            { $concat: ["-", { $substr: [trimmed, 0, { $subtract: [{ $strLenCP: trimmed }, 1] }] }] },
            trimmed
        ]
    };

    // Handle parentheses (e.g., "(500)" => "-500")
    const parenthesesHandled = {
        $cond: [
            { $regexMatch: { input: trailingMinusHandled, regex: /^\(.*\)$/ } },
            {
                $concat: [
                    "-",
                    { $substr: [trailingMinusHandled, 1, { $subtract: [{ $strLenCP: trailingMinusHandled }, 2] }] }
                ]
            },
            trailingMinusHandled
        ]
    };

    // Final: convert to double (onError & onNull -> 0)
    const toDouble = {
        $convert: {
            input: parenthesesHandled,
            to: "double",
            onError: 0,
            onNull: 0
        }
    };

    return toDouble;
};

/**
 * Search text across columns or specific columns
 */
export const searchByText = async (searchText, columns = null, limit = 100) => {
    if (!searchText) return [];

    const searchRegex = new RegExp(searchText, "i");
    let query;
    if (columns && columns.length > 0) {
        query = {
            $or: columns.map(col => ({ [col]: searchRegex }))
        };
    } else {
        // fallback: search across common text fields
        const sampleCols = [
            "zvolvWID",
            "WID",
            "DocumentDate",
            "PostingDate",
            "JournalEntrySrNo",
            "JournalEntryBusinessArea",
            "JournalEntryAccountType",
            "JournalEntryType",
            "JournalEntryVendorName",
            "JournalEntryVendorNumber",
            "JournalEntryCostCenter",
            "JournalEntryProfitCenter",
            "JournalEntryAmount",
            "JournalEntryPersonalNumber",
            "InitiatorName",
            "InitiatorStatus",
            "L1ApproverName",
            "L1ApproverStatus",
            "L2ApproverName",
            "L2ApproverStatus",
            "DocumentNumberOrErrorMessage",
            "ReversalDocumentNumber"
        ];
        query = { $or: sampleCols.map(c => ({ [c]: searchRegex })) };
    }

    // Keep default limit to avoid flooding UI
    const safeLimit = Math.min(limit || 100, 1000);
    return Entry.find(query)
        .limit(safeLimit)
        .select({ _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
        .lean();
};

/**
 * Filter by amount range using cleaned numeric expression
 */
export const filterByAmount = async (minAmount = null, maxAmount = null, limit = 100) => {
    const query = {};
    if (minAmount !== null || maxAmount !== null) {
        // use $expr with cleaned numeric field
        const numericExpr = buildCleanAmountExpression("$JournalEntryAmount");

        const conditions = [];
        if (minAmount !== null) {
            conditions.push({ $gte: [numericExpr, minAmount] });
        }
        if (maxAmount !== null) {
            conditions.push({ $lte: [numericExpr, maxAmount] });
        }

        if (conditions.length === 1) {
            query.$expr = conditions[0];
        } else if (conditions.length > 1) {
            query.$expr = { $and: conditions };
        }
    }

    const safeLimit = Math.min(limit || 100, 5000);

    return Entry.find(query)
        .limit(safeLimit)
        .select({ _id: 0 })
        .lean();
};

/**
 * Filter by date range (DocumentDate or PostingDate)
 */
export const filterByDateRange = async (startDate = null, endDate = null, dateField = "DocumentDate", limit = 100) => {
    const query = {};

    if (startDate || endDate) {
        query[dateField] = {};
        if (startDate) query[dateField].$gte = startDate;
        if (endDate) query[dateField].$lte = endDate;
    }

    const safeLimit = Math.min(limit || 100, 5000);
    return Entry.find(query)
        .limit(safeLimit)
        .select({ _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
        .lean();
};

/**
 * Filter by approval status (Initiator, L1, L2)
 */
export const filterByStatus = async (initiatorStatus = null, l1Status = null, l2Status = null, limit = 100) => {
    const query = {};

    if (initiatorStatus) query.InitiatorStatus = new RegExp(`^${initiatorStatus}$`, "i");
    if (l1Status) query.L1ApproverStatus = new RegExp(`^${l1Status}$`, "i");
    if (l2Status) query.L2ApproverStatus = new RegExp(`^${l2Status}$`, "i");

    const safeLimit = Math.min(limit || 100, 5000);
    return Entry.find(query)
        .limit(safeLimit)
        .select({ _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
        .lean();
};

/**
 * Combine multiple filters into one query
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

    // TEXT SEARCH
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

    // AMOUNT FILTER
    if (minAmount !== null || maxAmount !== null) {
        const amountConditions = [];
        const numericExpr = buildCleanAmountExpression("$JournalEntryAmount");
        if (minAmount !== null) amountConditions.push({ $gte: [numericExpr, minAmount] });
        if (maxAmount !== null) amountConditions.push({ $lte: [numericExpr, maxAmount] });
        query.$expr = amountConditions.length > 1 ? { $and: amountConditions } : amountConditions[0];
    }

    // DATE RANGE
    if (startDate || endDate) {
        query[dateField] = {};
        if (startDate) query[dateField].$gte = startDate;
        if (endDate) query[dateField].$lte = endDate;
    }

    // STATUS
    if (initiatorStatus) query.InitiatorStatus = new RegExp(`^${initiatorStatus}$`, "i");
    if (l1Status) query.L1ApproverStatus = new RegExp(`^${l1Status}$`, "i");
    if (l2Status) query.L2ApproverStatus = new RegExp(`^${l2Status}$`, "i");

    const skip = Math.max(0, (page - 1) * limit);
    const sortObj = { [sortBy]: sortOrder };

    const safeLimit = Math.min(limit || 100, 5000);

    const [results, total] = await Promise.all([
        Entry.find(query)
            .sort(sortObj)
            .skip(skip)
            .limit(safeLimit)
            .select({ _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
            .lean(),
        Entry.countDocuments(query)
    ]);

    return {
        data: results,
        pagination: {
            total,
            page,
            limit: safeLimit,
            totalPages: Math.ceil(total / safeLimit)
        }
    };
};

/**
 * Get summary statistics using a single $facet aggregation
 */
export const getStatistics = async () => {
    try {
        const result = await Entry.aggregate([
            {
                $facet: {
                    // 1️⃣ Total entries
                    totalEntries: [
                        { $count: "count" }
                    ],

                    // 2️⃣ Amount stats
                    amountStats: [
                        { $match: { JournalEntryAmount: { $exists: true, $ne: null } } },

                        // force string
                        {
                            $addFields: {
                                amountStr: {
                                    $trim: {
                                        input: { $toString: "$JournalEntryAmount" }
                                    }
                                }
                            }
                        },

                        // clean symbols
                        {
                            $addFields: {
                                amountStr: {
                                    $replaceAll: {
                                        input: {
                                            $replaceAll: {
                                                input: {
                                                    $replaceAll: {
                                                        input: "$amountStr",
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
                        },

                        // convert to number
                        {
                            $addFields: {
                                amountNumeric: {
                                    $convert: {
                                        input: "$amountStr",
                                        to: "double",
                                        onError: 0,
                                        onNull: 0
                                    }
                                }
                            }
                        },

                        // aggregate
                        {
                            $group: {
                                _id: null,
                                totalAmount: { $sum: "$amountNumeric" },
                                avgAmount: { $avg: "$amountNumeric" },
                                maxAmount: { $max: "$amountNumeric" },
                                minAmount: { $min: "$amountNumeric" }
                            }
                        }
                    ],

                    // 3️⃣ Unique vendors
                    uniqueVendors: [
                        { $match: { JournalEntryVendorName: { $exists: true, $ne: null } } },
                        {
                            $group: {
                                _id: {
                                    $toUpper: {
                                        $trim: {
                                            input: { $toString: "$JournalEntryVendorName" }
                                        }
                                    }
                                }
                            }
                        },
                        { $count: "count" }
                    ]
                }
            }
        ]);

        const stats = result[0] || {};

        return {
            totalEntries: stats.totalEntries?.[0]?.count || 0,

            amountStats: stats.amountStats?.[0] || {
                totalAmount: 0,
                avgAmount: 0,
                maxAmount: 0,
                minAmount: 0
            },

            uniqueCounts: {
                vendors: stats.uniqueVendors?.[0]?.count || 0
            }
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
