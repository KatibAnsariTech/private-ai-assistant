// aiController.js - Complete Production-Ready Version
import OpenAI from "openai";
import Entry from "../model/Entry.js";

import {
    getColumns,
    getTopN,
    getBottomN,
    getSpecificColumns,
    searchByText,
    filterByAmount,
    filterByDateRange,
    filterByStatus,
    combineFilters,
    getStatistics
} from "./queryController.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuration
const PREVIEW_LIMIT = 50;
const DEFAULT_LIMIT = 50;
const GRAPH_LIMIT = 20; // Limit graph data for readability

// Intent Detection Helpers
const isAll = (q) => /\b(all|every|entire|complete)\b/i.test(q);
const extractNumber = (q) => {
    if (isAll(q)) return 10000;
    const m = q.match(/\b(\d{1,6})\b/);
    return Number(m?.[1] || 10);
};
const isTop = (q) => /\b(top|first|show me|give me)\b/i.test(q);
const isBottom = (q) => /\b(bottom|last|latest|recent)\b/i.test(q);
const isDateRange = (q) => /(between|from|to).*?(date|posting|document)/i.test(q);
const isAmountRange = (q) => /(amount|greater than|less than|more than|between|>|<|>=|<=|\d,\d)/i.test(q);
const isStatusQuery = (q) => /\b(approved|rejected|pending)\b/i.test(q);
const isTextSearch = (q) => /\b(find|search|contains|matching|search for|show all entries for)\b/i.test(q);
const isStatsQuery = (q) => /\b(average|mean|avg|total|sum|max|min|highest|lowest)\b/i.test(q);
const isGroupQuery = (q) => /\b(group by|count by|total by|summarize|how many|breakdown|by|distribution)\b/i.test(q);
const isDuplicate = (q) => /\bduplicate\b/i.test(q);
const isMissingQuery = (q) => /\b(missing|null|empty|blank)\b/i.test(q);

// IMPROVED: Graph detection
// const isGraphQuery = (q) => /\b(graph|chart|plot|visualize|visualization|bar chart|line chart|pie chart|show.*graph|graph of|visual|trend)\b/i.test(q);
const isGraphQuery = (q) => /(graph|chart|plot|visualize|visualization|bar chart|line chart|pie chart|show graph|graph of|draw|visual|trend)/i.test(q);

// Extract date range
const extractDateRange = (q) => {
    const m = q.match(/\b(\d{4}-\d{2}-\d{2})\b/g) || [];
    return { start: m[0], end: m[1] };
};

// Extract amount range
const extractAmountRange = (q) => {
    const m = q.replace(/[,₹]/g, "").match(/\d{1,12}/g) || [];
    if (m.length === 0) return {};
    if (m.length === 1) return { min: Number(m[0]) };
    return { min: Number(m[0]), max: Number(m[1]) };
};

// Find column from question
const findColumnFromQuestion = (q, columns) => {
    const lower = q.toLowerCase();

    const map = {
        "JournalEntryVendorName": ["vendor", "vendors", "vendor name", "supplier", "vendo", "vend"],
        "JournalEntryVendorNumber": ["vendor number"],
        "JournalEntryAmount": ["amount", "value", "price"],
        "JournalEntryType": ["credit", "debit", "type", "entry type"],
        "JournalEntryCostCenter": ["cost center", "costcenter", "cost centre"],
        "JournalEntryProfitCenter": ["profit center", "profitcenter"],
        "InitiatorStatus": ["initiator status", "initiator"],
        "L1ApproverStatus": ["l1", "l1 status", "level 1"],
        "L2ApproverStatus": ["l2", "l2 status", "level 2"],
        "DocumentDate": ["document date", "doc date"],
        "PostingDate": ["posting date", "post date"]
    };

    for (const [col, tokens] of Object.entries(map)) {
        if (tokens.some(t => lower.includes(t))) return col;
    }

    return null;
};

// Main Controller
export const askAi = async (req, res) => {
    try {
        const { question } = req.body;

        if (!question || !question.trim()) {
            return res.json({
                answer: "Please ask a question about your data.",
                data: []
            });
        }

        console.log(`📝 Question: ${question}`);

        const columns = await getColumns();
        const N = extractNumber(question);
        const isAllQuery = isAll(question);
        const dynamicLimit = isAllQuery ? 0 : DEFAULT_LIMIT;

        // 1) COLUMN NAMES
        if (/column(s)?\b/i.test(question)) {
            return res.json({
                answer: "Here are all available columns in your dataset:",
                data: columns.map(c => ({ column: c }))
            });
        }

        // 15) GROUP BY / BREAKDOWN QUERIES
        if (isGroupQuery(question)) {
            const detected = findColumnFromQuestion(question, columns) || "InitiatorStatus";

            console.log(`🔍 Grouping by: ${detected}`);

            const agg = await Entry.aggregate([
                {
                    $match: {
                        [detected]: { $nin: ["", null, undefined] }
                    }
                },
                {
                    $group: {
                        _id: `$${detected}`,
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 100 },
                {
                    $project: {
                        field: detected,
                        value: "$_id",
                        count: 1,
                        _id: 0
                    }
                }
            ]);

            if (agg.length === 0) {
                return res.json({
                    answer: `No data found for ${detected}.`,
                    data: []
                });
            }

            // If graph requested
            if (isGraphQuery(question)) {
                const graphData = agg.slice(0, GRAPH_LIMIT);

                return res.json({
                    answer: `📊 Here is the graphical distribution of **${detected}** (showing top ${graphData.length} items).`,
                    graph: {
                        type: "bar",
                        x: graphData.map(r => String(r.value || "Unknown")),
                        y: graphData.map(r => r.count),
                        label: `Count by ${detected}`
                    }
                });
            }

            // Normal table
            return res.json({
                answer: `📊 Breakdown by ${detected} (showing top ${Math.min(agg.length, PREVIEW_LIMIT)} of ${agg.length}):`,
                data: agg.slice(0, PREVIEW_LIMIT)
            });
        }

        // 2) JUST "GRAPH" - Show Help
        if (question.trim().toLowerCase() === "graph") {
            return res.json({
                answer: "What would you like to visualize?\n\n**Try:**\n• Graph of entries by vendor\n• Graph of credit vs debit\n• Chart of cost center distribution\n• Visualize top 10 vendors",
                data: []
            });
        }

        // 3) UNIQUE VENDORS (Name + Number)
        if (question.match(/unique\s+vendors?/i) || question.match(/distinct\s+vendors?/i)) {
            const vendors = await Entry.aggregate([
                {
                    $match: {
                        JournalEntryVendorName: { $nin: ["", null, undefined] }
                    }
                },
                {
                    $group: {
                        _id: {
                            vendorNumber: "$JournalEntryVendorNumber",
                            vendorName: "$JournalEntryVendorName"
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        vendorNumber: "$_id.vendorNumber",
                        vendorName: "$_id.vendorName"
                    }
                },
                { $sort: { vendorNumber: 1 } },
                { $limit: PREVIEW_LIMIT }
            ]);

            return res.json({
                answer: `Found ${vendors.length} unique vendors (showing first ${PREVIEW_LIMIT}).`,
                data: vendors
            });
        }

        // 4) UNIQUE COST CENTERS
        if (question.match(/unique\s+cost\s+center/i) || question.match(/distinct\s+cost\s+center/i)) {
            const costCenters = await Entry.distinct("JournalEntryCostCenter", {
                JournalEntryCostCenter: { $nin: ["", null, undefined] }
            });

            return res.json({
                answer: `Found ${costCenters.length} unique cost centers.`,
                data: costCenters.slice(0, PREVIEW_LIMIT).map(c => ({ costCenter: c }))
            });
        }

        // 5) TOP N VENDORS
        if (question.match(/top\s+\d+\s+vendors?/i)) {
            const numberMatch = question.match(/top\s+(\d+)/i);
            const topN = numberMatch ? parseInt(numberMatch[1]) : 10;

            const agg = await Entry.aggregate([
                {
                    $match: {
                        JournalEntryVendorName: { $nin: ["", null, undefined] }
                    }
                },
                {
                    $group: {
                        _id: "$JournalEntryVendorName",
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: topN },
                {
                    $project: {
                        vendorName: "$_id",
                        count: 1,
                        _id: 0
                    }
                }
            ]);

            // Check if graph requested
            if (isGraphQuery(question)) {
                return res.json({
                    answer: `📊 Here is the graph showing the top ${topN} vendors by entry count.`,
                    graph: {
                        type: "bar",
                        x: agg.map(r => r.vendorName || "Unknown"),
                        y: agg.map(r => r.count),
                        label: `Top ${topN} Vendors by Entry Count`
                    }
                });
            }

            return res.json({
                answer: `📊 Top ${topN} vendors by number of entries:`,
                data: agg
            });
        }

        // 6) SPECIFIC COLUMNS
        const requestedCols = columns.filter(c => {
            const cname = c.replace(/([A-Z])/g, " $1").toLowerCase();
            return cname.split(/\s+/).some(w => w.length > 2 && question.toLowerCase().includes(w));
        });

        if (
            requestedCols.length > 0 &&
            !isGroupQuery(question) &&
            !question.match(/top\s+\d+\s+vendors?/i) &&
            !/\blast\b/i.test(question) &&
            !isAmountRange(question) &&
            !isGraphQuery(question)
        ) {
            const result = await getSpecificColumns(N, requestedCols);
            return formatOutput(res, question, result);
        }

        // 7) TOP / FIRST N
        if (isTop(question) && !isGraphQuery(question)) {
            const rows = await getTopN(N);
            return formatOutput(res, question, rows);
        }

        // 8) BOTTOM / LAST N
        if (/\blast\b/i.test(question) || /\brecent\b/i.test(question)) {
            const rows = await getBottomN(N);
            return formatOutput(res, question, rows);
        }

        // 9) DATE RANGE
        if (isDateRange(question)) {
            const { start, end } = extractDateRange(question);
            const dateField = question.toLowerCase().includes("posting") ? "PostingDate" : "DocumentDate";
            const rows = await filterByDateRange(start, end, dateField, dynamicLimit || PREVIEW_LIMIT);
            return formatOutput(res, question, rows);
        }

        // 10) AMOUNT RANGE
        if (isAmountRange(question)) {
            const { min, max } = extractAmountRange(question);
            const rows = await filterByAmount(min ?? null, max ?? null, dynamicLimit || PREVIEW_LIMIT);
            return formatOutput(res, question, rows);
        }

        // 11) STATUS QUERIES
        if (isStatusQuery(question) && !isGroupQuery(question)) {
            const col = findColumnFromQuestion(question, columns) || "InitiatorStatus";
            const m = question.match(/\b(approved|rejected|pending)\b/i);
            if (!m) return res.json({ answer: "Please specify status: approved, rejected, or pending.", data: [] });

            const status = m[0];
            const rows = await filterByStatus(status, null, null, dynamicLimit || PREVIEW_LIMIT);
            return formatOutput(res, question, rows);
        }

        // 12) TEXT SEARCH
        if (isTextSearch(question)) {
            const cleaned = question.replace(/\b(find|search|entries|matching|show|show me|for|all)\b/gi, "").trim();
            const kw = cleaned.replace(/[^a-zA-Z0-9\s]/g, "").trim();

            if (!kw) return res.json({ answer: "Please provide a keyword to search for.", data: [] });

            const rows = await searchByText(kw, null, dynamicLimit || PREVIEW_LIMIT);
            return formatOutput(res, question, rows);
        }

        // 13) STATISTICS
        if (isStatsQuery(question) && !isGroupQuery(question)) {
            const stats = await getStatistics();
            const qLower = question.toLowerCase();
            let answer = "";

            if (qLower.includes("average") || qLower.includes("avg") || qLower.includes("mean")) {
                answer = `📊 Average amount: ₹${Math.round(stats.amountStats.avgAmount || 0).toLocaleString()}`;
            } else if (qLower.includes("total") || qLower.includes("sum")) {
                answer = `📊 Total amount: ₹${Math.round(stats.amountStats.totalAmount || 0).toLocaleString()}`;
            } else if (qLower.includes("max") || qLower.includes("highest")) {
                answer = `📊 Maximum amount: ₹${Math.round(stats.amountStats.maxAmount || 0).toLocaleString()}`;
            } else if (qLower.includes("min") || qLower.includes("lowest")) {
                answer = `📊 Minimum amount: ₹${Math.round(stats.amountStats.minAmount || 0).toLocaleString()}`;
            } else {
                answer = `📊 **Statistics:**\n• Total: ₹${Math.round(stats.amountStats.totalAmount || 0).toLocaleString()}\n• Average: ₹${Math.round(stats.amountStats.avgAmount || 0).toLocaleString()}`;
            }

            return res.json({ answer, data: [stats.amountStats] });
        }

        // 14) CREDIT / DEBIT COUNTING
        if (question.match(/credit|debit/i)) {
            let result = [];

            try {
                result = await Entry.aggregate([
                    {
                        $addFields: {
                            normalizedType: {
                                $trim: {
                                    input: {
                                        $toUpper: {
                                            $ifNull: ["$JournalEntryType", ""]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    {
                        $match: {
                            normalizedType: { $in: ["DEBIT", "CREDIT"] }
                        }
                    },
                    {
                        $group: {
                            _id: "$normalizedType",
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } },
                    {
                        $project: {
                            type: "$_id",
                            count: 1,
                            _id: 0
                        }
                    }
                ]);
            } catch (err) {
                console.error("❌ Credit/Debit Aggregation Error:", err);
                return res.json({
                    answer: "Error counting Credit/Debit entries. Please check the data format.",
                    data: []
                });
            }

            if (result.length === 0) {
                return res.json({
                    answer: "No Credit or Debit entries found in the dataset.",
                    data: []
                });
            }

            // If graph requested
            if (isGraphQuery(question)) {
                return res.json({
                    answer: "📊 Here is the graphical distribution of Credit vs Debit entry counts.",
                    graph: {
                        type: "bar",
                        x: result.map(r => r.type),
                        y: result.map(r => r.count),
                        label: "Credit vs Debit Entry Counts"
                    }
                });
            }

            // Normal table
            return res.json({
                answer: "📊 Credit and Debit entry counts:",
                data: result
            });
        }

        // 16) DUPLICATE CHECK
        if (isDuplicate(question)) {
            const detected = findColumnFromQuestion(question, columns);
            if (!detected) {
                return res.json({
                    answer: "Please specify which column to check for duplicates (e.g., 'duplicate vendors').",
                    data: []
                });
            }

            const duplicates = await Entry.aggregate([
                { $group: { _id: `$${detected}`, count: { $sum: 1 } } },
                { $match: { count: { $gt: 1 } } },
                { $sort: { count: -1 } },
                { $limit: PREVIEW_LIMIT }
            ]);

            const mapped = duplicates.map(d => ({
                [detected]: d._id,
                duplicateCount: d.count
            }));

            return formatOutput(res, question, mapped);
        }

        // 17) MISSING VALUES
        if (isMissingQuery(question)) {
            const detected = findColumnFromQuestion(question, columns);
            if (!detected) {
                return res.json({
                    answer: "Please specify which column to check for missing values.",
                    data: []
                });
            }

            const rows = await Entry.find({
                $or: [
                    { [detected]: null },
                    { [detected]: "" },
                    { [detected]: undefined }
                ]
            }).limit(PREVIEW_LIMIT).select({ _id: 0 }).lean();

            return formatOutput(res, question, rows);
        }

        // 18) FALLBACK: Combined Filters
        const fallbackLimit = isAllQuery ? 0 : PREVIEW_LIMIT;
        const combined = await combineFilters({
            searchText: question,
            limit: fallbackLimit
        });

        if (combined?.data?.length > 0) {
            return formatOutput(res, question, combined.data.slice(0, PREVIEW_LIMIT), {
                pagination: combined.pagination
            });
        }

        // 19) LAST RESORT - AI Suggestion
        return res.json({
            answer: "🤔 I couldn't understand your query.\n\n**Try asking:**\n• Show me top 10 entries\n• Graph of credit vs debit\n• Unique vendors\n• Amount > 100000\n• Breakdown by cost center",
            data: []
        });

    } catch (error) {
        console.error("❌ askAi Error:", error);
        return res.status(500).json({
            answer: "An error occurred while processing your request. Please try again.",
            error: error.message,
            data: []
        });
    }
};

// Output Formatter
async function formatOutput(res, question, data, meta = {}) {
    if (!data || (Array.isArray(data) && data.length === 0)) {
        return res.json({
            answer: "No data found for your query.",
            data: [],
            meta
        });
    }

    // Handle array of strings
    if (Array.isArray(data) && typeof data[0] === "string") {
        return res.json({
            answer: `Found ${data.length} unique values.`,
            data
        });
    }

    // Handle grouped results
    const isGroupLike = Array.isArray(data) && data.every(d => d?.count !== undefined);
    if (isGroupLike) {
        const cleaned = data.map(r => {
            const obj = { ...r };
            Object.keys(obj).forEach(k => {
                if (obj[k] === null || obj[k] === undefined) obj[k] = "";
                else if (typeof obj[k] === "object") obj[k] = JSON.stringify(obj[k]);
            });
            return obj;
        });

        return res.json({
            answer: `📊 Found ${cleaned.length} grouped results.`,
            data: cleaned.slice(0, PREVIEW_LIMIT),
            meta
        });
    }

    // Normal table cleanup
    const cleaned = data.map(row => {
        const obj = row.toObject ? row.toObject() : row;
        delete obj._id;
        delete obj.__v;
        delete obj.createdAt;
        delete obj.updatedAt;

        Object.keys(obj).forEach(k => {
            if (obj[k] === null || obj[k] === undefined) obj[k] = "";
            else if (typeof obj[k] === "object") obj[k] = JSON.stringify(obj[k]);
        });
        return obj;
    });

    if (cleaned.length > PREVIEW_LIMIT) {
        return res.json({
            answer: `📋 Showing first ${PREVIEW_LIMIT} of ${cleaned.length} results.`,
            data: cleaned.slice(0, PREVIEW_LIMIT),
            meta
        });
    }

    // Try OpenAI summary
    try {
        const summaryPrompt = `User asked: "${question}". Provide a brief one-line summary of the results (don't describe the table).`;
        const summaryResp = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: summaryPrompt }],
            temperature: 0.2,
            max_tokens: 100
        });

        const summary = summaryResp.choices?.[0]?.message?.content || `Found ${cleaned.length} rows.`;
        return res.json({ answer: summary, data: cleaned, meta });
    } catch (err) {
        console.error("OpenAI Summary Error:", err);
        return res.json({
            answer: `📋 Found ${cleaned.length} rows.`,
            data: cleaned,
            meta
        });
    }
}