// aiController.js (clean, production-ready)
// Delegates data operations to queryController to avoid duplicated inline Mongo logic.
// Provides robust intent parsing, safe limits, and consistent output formatting.

import OpenAI from "openai";
import Entry from "../model/Entry.js";

import {
    getColumns,
    getTopN,
    getBottomN,
    getUnique,
    getSpecificColumns,
    getUniqueCombination,
    searchByText,
    filterByAmount,
    filterByDateRange,
    filterByStatus,
    combineFilters,
    getStatistics,
    getAllWithPagination
} from "./queryController.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- Configuration ----------
const PREVIEW_LIMIT = 50;
const DEFAULT_LIMIT = 50;

// ---------- Simple intent helpers ----------
const isAll = (q) => /\b(all|every|entire|complete)\b/i.test(q);
const extractNumber = (q) => {
    if (isAll(q)) return 10000;
    const m = q.match(/\b(\d{1,6})\b/);
    return Number(m?.[1] || 10);
};
const isUnique = (q) => /\b(unique|distinct|different)\b/i.test(q);
const isTop = (q) => /\b(top|first|show me|give me|show the top)\b/i.test(q);
const isBottom = (q) => /\b(bottom|last|latest|recent)\b/i.test(q);
const isDateRange = (q) => /(between|from|to).*?(date|posting|document)/i.test(q);
const isAmountRange = (q) => /(amount|greater than|less than|more than|between|>|<|>=|<=|\d,\d)/i.test(q);
const isStatusQuery = (q) => /\b(approved|rejected|pending)\b/i.test(q);
const isTextSearch = (q) => /\b(find|search|contains|matching|search for|show all entries for)\b/i.test(q);
const isStatsQuery = (q) => /\b(average|mean|avg|total|sum|max|min|highest|lowest)\b/i.test(q);
const isGroupQuery = (q) => /\b(group by|count by|total by|summarize|how many|breakdown|by)\b/i.test(q);
const isDuplicate = (q) => /\bduplicate\b/i.test(q);
const isMissingQuery = (q) => /\b(missing|null|empty|blank)\b/i.test(q);

// extract simple date patterns (YYYY-MM-DD)
const extractDateRange = (q) => {
    const m = q.match(/\b(\d{4}-\d{2}-\d{2})\b/g) || [];
    return { start: m[0], end: m[1] };
};

// extract simple amount numbers (strip commas)
const extractAmountRange = (q) => {
    const m = q.replace(/[,₹]/g, "").match(/\d{1,12}/g) || [];
    if (m.length === 0) return {};
    if (m.length === 1) return { min: Number(m[0]) };
    return { min: Number(m[0]), max: Number(m[1]) };
};

// try to find likely column names from text
const findColumnFromQuestion = (q, columns) => {
    const lower = q.toLowerCase();
    // exact tokens to common column keys mapping (common user phrases)
    const map = {
        "JournalEntryVendorName": ["vendor", "vendors", "vendor name", "supplier", "unique vendors"],
        "JournalEntryVendorNumber": ["vendor number"],

        "JournalEntryAmount": ["amount", "value"],
        "JournalEntryType": ["credit", "debit", "journal entry type"],
        "JournalEntryCostCenter": ["cost center", "costcenter", "cost_center"],

        "InitiatorStatus": ["initiator status", "initiator"],
        "L1ApproverStatus": ["l1", "l1 status"],
        "L2ApproverStatus": ["l2", "l2 status"],

        "DocumentDate": ["document date"],
        "PostingDate": ["posting date"]
    };


    for (const [col, tokens] of Object.entries(map)) {
        if (tokens.some(t => lower.includes(t))) return col;
    }

    if (lower.includes("cost center") && !lower.includes("profit")) return "JournalEntryCostCenter";

    // fallback: match any column token present in question
    for (const c of columns) {
        const cname = c.replace(/([A-Z])/g, " $1").toLowerCase();
        const words = cname.split(/\s+/).filter(Boolean);
        if (words.some(w => w.length > 2 && lower.includes(w))) return c;
    }
    return null;
};

// ---------- Main controller ----------
export const askAi = async (req, res) => {
    try {
        const { question } = req.body;
        if (!question || !question.trim()) {
            return res.json({ answer: "Please ask a question about your data.", data: [] });
        }

        const columns = await getColumns();
        const N = extractNumber(question);

        const isAllQuery = isAll(question);
        const dynamicLimit = isAllQuery ? 0 : DEFAULT_LIMIT;

        // 1) Return column names
        if (/column(s)?\b/i.test(question)) {
            return res.json({ answer: "Here are the column names:", data: columns });
        }

        // --- Unique Vendors (return BOTH Name + Number) ---
        if (question.match(/unique\s+vendors?/i) || question.match(/distinct\s+vendors?/i)) {
            const vendors = await Entry.aggregate([
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
                { $limit: 50 } // preview
            ]);

            return res.json({
                answer: `Found ${vendors.length} unique vendors.`,
                data: vendors
            });
        }


        // --- Unique Cost Centers (ONLY cost center, no profit center) ---
        if (question.match(/unique\s+cost\s+centers?/i) || question.match(/distinct\s+cost\s+centers?/i)) {

            const costCenters = await Entry.distinct("JournalEntryCostCenter", {
                JournalEntryCostCenter: { $nin: ["", null, undefined] }
            });

            return res.json({
                answer: `Found ${costCenters.length} unique cost centers.`,
                data: costCenters.slice(0, PREVIEW_LIMIT).map(c => ({ costCenter: c }))
            });
        }


        // 3) Specific columns requested (e.g., 'show WID and amount')
        // naive detection: check for column tokens in question
        const requestedCols = columns.filter(c => {
            const cname = c.replace(/([A-Z])/g, " $1").toLowerCase();
            return cname.split(/\s+/).some(w => w.length > 2 && question.toLowerCase().includes(w));
        });

        // Prevent specific-column extraction if the question is a breakdown or group-by
        if (
            requestedCols.length > 0 &&
            !isGroupQuery(question) &&
            !/\bbreakdown\b/i.test(question) &&
            !/\bsummary\b/i.test(question) &&
            !/\bcount by\b/i.test(question) &&
            !/\bgroup\b/i.test(question) &&
            !/\blast\b/i.test(question) &&
            !/\brecent\b/i.test(question) &&
            !isAmountRange(question)
        ) {
            const result = await getSpecificColumns(N, requestedCols);
            return formatOutput(res, question, result);
        }

        if (
            requestedCols.length > 0 &&
            !isGroupQuery(question) &&
            !question.match(/top\s+\d+\s+vendors?/i) &&
            !question.match(/top\s+\d+\s+vendor\s+name/i) &&
            !question.match(/\blast\b/i) &&
            !question.match(/\brecent\b/i) &&
            !isAmountRange(question)
        ) {
            const result = await getSpecificColumns(N, requestedCols);
            return formatOutput(res, question, result);
        }

        // --- Top N Vendors (must run BEFORE specific columns logic) ---
        if (question.match(/top\s+\d+\s+vendors?/i) || question.match(/top\s+\d+\s+vendor\s+name/i)) {

            const numberMatch = question.match(/top\s+(\d+)/i);
            const topN = numberMatch ? parseInt(numberMatch[1]) : 10;

            const agg = await Entry.aggregate([
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

            return res.json({
                answer: `Top ${topN} Vendors by number of entries:`,
                data: agg
            });
        }

        // 4) TOP / FIRST N
        if (isTop(question)) {
            const rows = await getTopN(N);
            return formatOutput(res, question, rows);
        }

        // 5) BOTTOM / LAST N
        if (/\blast\b/i.test(question) || /\brecent\b/i.test(question) || isBottom(question)) {
            const rows = await getBottomN(N);
            return formatOutput(res, question, rows);
        }

        // 6) DATE RANGE queries
        if (isDateRange(question)) {
            const { start, end } = extractDateRange(question);
            const dateField = question.toLowerCase().includes("posting") ? "PostingDate" : "DocumentDate";
            const rows = await filterByDateRange(start, end, dateField, dynamicLimit || PREVIEW_LIMIT);
            return formatOutput(res, question, rows);
        }

        // 7) AMOUNT RANGE queries -> use queryController.filterByAmount
        if (isAmountRange(question)) {
            const { min, max } = extractAmountRange(question);
            const rows = await filterByAmount(min ?? null, max ?? null, dynamicLimit || PREVIEW_LIMIT);
            return formatOutput(res, question, rows);
        }

        // 8) STATUS related queries (initiator / L1 / L2)
        if (isStatusQuery(question)) {
            const col = findColumnFromQuestion(question, columns) || "InitiatorStatus";
            const m = question.match(/\b(approved|rejected|pending)\b/i);
            if (!m) return res.json({ answer: "Specify status (approved / rejected / pending).", data: [] });
            const status = m[1] || m[0];
            const rows = await filterByStatus(status, null, null, dynamicLimit || PREVIEW_LIMIT)
                .catch(async () => {
                    // if default filterByStatus signature differs, fallback to general find
                    return Entry.find({ [col]: new RegExp(`^${status}$`, "i") }).limit(dynamicLimit || PREVIEW_LIMIT).select({ _id: 0 }).lean();
                });
            return formatOutput(res, question, rows);
        }

        // 9) TEXT SEARCH
        if (isTextSearch(question)) {
            // extract a keyword-like phrase (strip words like 'show', 'entries', etc.)
            const cleaned = question.replace(/\b(find|search|entries|matching|show|show me|for)\b/gi, "").trim();
            const kw = cleaned.replace(/[^a-zA-Z0-9\s]/g, "").trim();
            if (!kw) return res.json({ answer: "Please provide a keyword to search for.", data: [] });
            const rows = await searchByText(kw, null, dynamicLimit || PREVIEW_LIMIT);
            return formatOutput(res, question, rows);
        }

        // 10) STATS: total / average / min / max
        if (isStatsQuery(question)) {
            const stats = await getStatistics();
            // build a friendly answer
            const qLower = question.toLowerCase();
            let answer = "";
            if (qLower.includes("average") || qLower.includes("avg") || qLower.includes("mean")) {
                answer = `Average transaction amount: ₹${Math.round(stats.amountStats.avgAmount || 0).toLocaleString()}`;
            } else if (qLower.includes("total") || qLower.includes("sum")) {
                answer = `Total amount: ₹${Math.round(stats.amountStats.totalAmount || 0).toLocaleString()}`;
            } else if (qLower.includes("max") || qLower.includes("highest")) {
                answer = `Maximum amount: ₹${Math.round(stats.amountStats.maxAmount || 0).toLocaleString()}`;
            } else if (qLower.includes("min") || qLower.includes("lowest")) {
                answer = `Minimum amount: ₹${Math.round(stats.amountStats.minAmount || 0).toLocaleString()}`;
            } else {
                answer = `Total: ₹${Math.round(stats.amountStats.totalAmount || 0).toLocaleString()}, Average: ₹${Math.round(stats.amountStats.avgAmount || 0).toLocaleString()}`;
            }
            return res.json({ answer, data: [stats.amountStats] });
        }

        // ---------- SPECIAL FIX: Clean Credit / Debit Counting ----------
        if (question.match(/credit|debit/i)) {
            const result = await Entry.aggregate([
                {
                    $addFields: {
                        normalizedType: {
                            $trim: { input: { $toUpper: "$JournalEntryType" } }
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

            return res.json({
                answer: "Correct Credit / Debit counts (cleaned):",
                data: result
            });
        }


        // 11) GROUP BY queries (counts by vendor/type/status/cost center)
        // 11) GROUP BY queries (counts by vendor/type/status/cost center)
        if (isGroupQuery(question)) {
            const detected = findColumnFromQuestion(question, columns) || "InitiatorStatus";

            const agg = await Entry.aggregate([
                {
                    $group: {
                        _id: `$${detected}`,
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                {
                    $project: {
                        field: detected,
                        value: "$_id",
                        count: 1,
                        _id: 0
                    }
                }
            ]);

            return res.json({
                answer: `Breakdown by ${detected}:`,
                data: agg
            });
        }


        // 12) DUPLICATE check
        if (isDuplicate(question)) {
            const detected = findColumnFromQuestion(question, columns);
            if (!detected) return res.json({ answer: "Please specify which column to check duplicates for.", data: [] });
            const duplicates = await Entry.aggregate([
                { $group: { _id: `$${detected}`, count: { $sum: 1 }, rows: { $push: "$$ROOT" } } },
                { $match: { count: { $gt: 1 } } },
                { $limit: PREVIEW_LIMIT }
            ]);
            const mapped = duplicates.map(d => ({ [detected]: d._id, count: d.count }));
            return formatOutput(res, question, mapped);
        }

        // 13) MISSING / NULL checks
        if (isMissingQuery(question)) {
            const detected = findColumnFromQuestion(question, columns);
            if (!detected) return res.json({ answer: "Please specify which column to check for missing values.", data: [] });
            const rows = await Entry.find({
                $or: [{ [detected]: null }, { [detected]: "" }, { [detected]: undefined }]
            }).limit(PREVIEW_LIMIT).select({ _id: 0 }).lean();
            return formatOutput(res, question, rows);
        }

        // 14) Fallback: try combineFilters to handle complex natural queries
        // We'll create a simple filter object and use combineFilters; if unsure, fallback to limited full-text search
        const fallbackLimit = isAllQuery ? 0 : PREVIEW_LIMIT;
        const combined = await combineFilters({ searchText: question, limit: fallbackLimit });
        if (combined && combined.data && combined.data.length > 0) {
            return formatOutput(res, question, combined.data.slice(0, PREVIEW_LIMIT), { pagination: combined.pagination });
        }

        // 15) As last resort: return guided message
        return res.json({
            answer: "I couldn't map your question to a strict data operation. Try phrases like 'show top 10 entries', 'unique vendors', 'amount > 100000', or 'breakdown by vendor'.",
            data: []
        });

    } catch (error) {
        console.error("askAi error:", error);
        return res.status(500).json({
            answer: "An internal error occurred while processing your request.",
            error: String(error),
            data: []
        });
    }
};

// ---------- Output formatter ----------
async function formatOutput(res, question, data, meta = {}) {
    if (!data || (Array.isArray(data) && data.length === 0)) {
        return res.json({ answer: "No data found for your query.", data: [], meta });
    }

    // Correct handling for UNIQUE VENDOR strings
    if (Array.isArray(data) && data.every(item => typeof item === "string")) {
        return res.json({
            answer: `Found ${data.length} unique values.`,
            data
        });
    }


    // detect group-like structures (objects with 'count' property)
    const isGroupLike = Array.isArray(data) && data.every(d => d && (d.count !== undefined));
    if (isGroupLike) {
        const cleaned = data.map(r => {
            // ensure values are primitive strings/numbers
            const obj = { ...r };
            Object.keys(obj).forEach(k => {
                if (obj[k] === null || obj[k] === undefined) obj[k] = "";
                else obj[k] = typeof obj[k] === "object" ? JSON.stringify(obj[k]) : obj[k];
            });
            return obj;
        });
        return res.json({
            answer: `Here are ${cleaned.length} grouped results (preview).`,
            data: cleaned.slice(0, PREVIEW_LIMIT),
            meta
        });
    }

    // generic table data - cleanup fields
    const cleaned = data.map(row => {
        const obj = row.toObject ? row.toObject() : row;
        delete obj._id;
        delete obj.__v;
        delete obj.createdAt;
        delete obj.updatedAt;
        Object.keys(obj).forEach(k => {
            if (obj[k] === null || obj[k] === undefined) obj[k] = "";
            else obj[k] = typeof obj[k] === "object" ? JSON.stringify(obj[k]) : obj[k];
        });
        return obj;
    });

    // if result length is huge, only preview
    if (cleaned.length > PREVIEW_LIMIT) {
        return res.json({
            answer: `Showing first ${PREVIEW_LIMIT} of ${cleaned.length} results.`,
            data: cleaned.slice(0, PREVIEW_LIMIT),
            meta
        });
    }

    // attempt a short summary using OpenAI for friendly text (non-blocking if fails)
    try {
        const summaryPrompt = `The user asked: "${question}". Provide a short helpful one-line summary describing the results (do not include the full table).`;
        const summaryResp = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: summaryPrompt }],
            temperature: 0.2
        });
        const summary = summaryResp.choices?.[0]?.message?.content || `Found ${cleaned.length} rows.`;
        return res.json({ answer: summary, data: cleaned, meta });
    } catch (err) {
        // If summarization fails, return data with a neutral answer
        return res.json({ answer: `Found ${cleaned.length} rows.`, data: cleaned, meta });
    }
}
