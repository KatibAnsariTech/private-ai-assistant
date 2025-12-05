import OpenAI from "openai";
import Entry from "../model/Entry.js";

import {
    getColumns,
    getTopN,
    getBottomN,
    getUnique,
    getSpecificColumns,
    getUniqueCombination
} from "./queryController.js";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// =========================
// Intent Helpers
// =========================

const isAll = q => /all|every|entire|complete/i.test(q);
const extractNumber = (q) => {
    if (isAll(q)) return 10000;
    return Number(q.match(/\b(\d+)\b/)?.[1] || 10);
};
const isUnique = q => /unique|distinct|different|without repetition/i.test(q);
const isTop = q => /top|first|initial|show me|give me/i.test(q);
const isBottom = q => /bottom|last|latest|recent/i.test(q);

const extractCols = (q, cols) => {
    const lowerQ = q.toLowerCase();
    return cols.filter(c => {
        const lowerC = c.toLowerCase();
        // Direct match
        if (lowerQ.includes(lowerC)) return true;
        // Handle "Cost Center" -> "JournalEntryCostCenter"
        if (lowerC.includes(lowerQ.replace(/\s+/g, ''))) return true;
        // Handle split words "Cost Center" matching "JournalEntryCostCenter"
        // Use 'c' (original) to preserve case for splitting
        const words = c.replace(/([A-Z])/g, ' $1').trim().toLowerCase().split(' ');
        // Check if any significant word from the column name appears in the query
        // Also handle plural forms in query (e.g., "vendors" includes "vendor")
        return words.some(w => w.length > 2 && lowerQ.includes(w));
    });
};

// ---- Date Range Helpers ----
const isDateRange = q =>
    /(between|from|to)/i.test(q) && /(date|posting|document)/i.test(q);

const extractDateRange = q => {
    const match = q.match(/(\d{4}-\d{2}-\d{2})/g);
    if (!match) return {};
    return { start: match[0], end: match[1] };
};

// ---- Amount Range ----
const isAmountRange = q =>
    /(amount|value)/i.test(q) && /(>|<|<=|>=|between)/i.test(q);

const extractAmountRange = q => {
    const nums = q.match(/\d+/g);
    if (!nums) return {};
    if (nums.length === 1) return { min: Number(nums[0]) };
    return { min: Number(nums[0]), max: Number(nums[1]) };
};

// ---- Status ----
const isStatusQuery = q =>
    /(approved|rejected|pending)/i.test(q);

// ---- Text Search ----
const isTextSearch = q =>
    /(find|search|contains|matching)/i.test(q);

// ---- Group By ----
const isStatsQuery = q =>
    /(average|mean|total|sum|min|max|minimum|maximum)/i.test(q) && /(amount|value|quantity)/i.test(q);

const isGroupQuery = q =>
    /(group by|count by|total by|summarize|how many|breakdown)/i.test(q);

// ---- Duplicate ----
const isDuplicate = q =>
    /duplicate/i.test(q);

// ---- Missing / Empty ----
const isMissingQuery = q =>
    /(missing|null|empty)/i.test(q);

// =====================================================
//                   MAIN ASK AI CONTROLLER
// =====================================================

export const askAi = async (req, res) => {
    try {
        const { question } = req.body;

        if (!question || question.trim() === "") {
            return res.json({
                answer: "Please ask a question about your data.",
                data: []
            });
        }

        const columns = await getColumns();
        const N = extractNumber(question);
        const isAllQuery = isAll(question);
        const dynamicLimit = isAllQuery ? 0 : 50;

        const selectedColumns = extractCols(question, columns);

        // ============================
        // COLUMN LIST
        // ============================
        if (/column/i.test(question)) {
            return res.json({
                answer: "Here are all column names:",
                data: columns
            });
        }

        // ============================
        // UNIQUE
        // ============================
        if (isUnique(question) && selectedColumns.length === 1) {
            const field = selectedColumns[0];
            const result = await getUnique(field);
            return formatOutput(res, question, result);
        }

        if (isUnique(question) && selectedColumns.length > 1) {
            const result = await getUniqueCombination(selectedColumns);
            return formatOutput(res, question, result);
        }

        // ============================
        // SPECIFIC COLUMNS
        // ============================
        if (selectedColumns.length > 0) {
            const result = await getSpecificColumns(N, selectedColumns);
            return formatOutput(res, question, result);
        }

        // ============================
        // TOP N
        // ============================
        if (isTop(question) || /^\s*\d+\s+(rows?|records?|entries?)/i.test(question)) {
            const result = await getTopN(N);
            return formatOutput(res, question, result);
        }

        // ============================
        // BOTTOM N
        // ============================
        if (isBottom(question)) {
            const result = await getBottomN(N);
            return formatOutput(res, question, result);
        }

        // ============================
        // DATE RANGE
        // ============================
        if (isDateRange(question)) {
            const { start, end } = extractDateRange(question);
            const dateField = question.includes("posting")
                ? "PostingDate"
                : "DocumentDate";

            const result = await Entry.find({
                [dateField]: { $gte: start, $lte: end }
            })
                .limit(dynamicLimit)
                .select({ _id: 0 });

            return formatOutput(res, question, result);
        }

        // ============================
        // AMOUNT RANGE
        // ============================
        if (isAmountRange(question)) {
            const { min, max } = extractAmountRange(question);
            const filter = {};

            if (min && max) {
                filter.$expr = {
                    $and: [
                        { $gte: [{ $toDouble: "$JournalEntryAmount" }, min] },
                        { $lte: [{ $toDouble: "$JournalEntryAmount" }, max] }
                    ]
                };
            } else {
                filter.$expr = {
                    $gte: [{ $toDouble: "$JournalEntryAmount" }, min]
                };
            }

            const result = await Entry.find(filter)
                .limit(dynamicLimit)
                .select({ _id: 0 });

            return formatOutput(res, question, result);
        }

        // ============================
        // STATUS QUERY
        // ============================
        if (isStatusQuery(question)) {
            let field;

            if (question.includes("l1")) field = "L1ApproverStatus";
            else if (question.includes("l2")) field = "L2ApproverStatus";
            else field = "InitiatorStatus";

            const keyword = question.match(/approved|rejected|pending/i)[0];

            const result = await Entry.find({
                [field]: new RegExp(keyword, "i")
            })
                .limit(dynamicLimit)
                .select({ _id: 0 });

            return formatOutput(res, question, result);
        }

        // ============================
        // TEXT SEARCH
        // ============================
        if (isTextSearch(question)) {
            const keyword = question.replace(/find|search|entries|matching/gi, "").trim();

            const regex = new RegExp(keyword, "i");
            const orQuery = columns.map(c => ({ [c]: regex }));

            const result = await Entry.find({ $or: orQuery })
                .limit(dynamicLimit)
                .select({ _id: 0 });

            return formatOutput(res, question, result);
        }

        // ============================
        // STATS QUERY (New)
        // ============================
        if (isStatsQuery(question)) {
            const stats = await Entry.aggregate([
                {
                    $addFields: {
                        amountNumeric: { $toDouble: "$JournalEntryAmount" }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: "$amountNumeric" },
                        avgAmount: { $avg: "$amountNumeric" },
                        maxAmount: { $max: "$amountNumeric" },
                        minAmount: { $min: "$amountNumeric" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            const s = stats[0] || { totalAmount: 0, avgAmount: 0 };

            let answer = "";
            const qLower = question.toLowerCase();
            if (qLower.includes("average") || qLower.includes("mean")) answer = `The average amount is ${s.avgAmount.toFixed(2)}.`;
            else if (qLower.includes("total") || qLower.includes("sum")) answer = `The total amount is ${s.totalAmount.toFixed(2)}.`;
            else if (qLower.includes("max")) answer = `The maximum amount is ${s.maxAmount}.`;
            else if (qLower.includes("min")) answer = `The minimum amount is ${s.minAmount}.`;
            else answer = `Total: ${s.totalAmount}, Average: ${s.avgAmount}, Count: ${s.count}`;

            return res.json({
                answer: answer,
                data: [s]
            });
        }

        // ============================
        // GROUP BY
        // ============================
        if (isGroupQuery(question)) {
            let field = columns.find(c => question.toLowerCase().includes(c.toLowerCase()));

            // Infer field if not explicitly found
            if (!field) {
                const lowerQ = question.toLowerCase();
                if (lowerQ.includes('credit') || lowerQ.includes('debit')) {
                    field = 'JournalEntryType';
                } else if (lowerQ.includes('approved') || lowerQ.includes('rejected') || lowerQ.includes('pending')) {
                    if (lowerQ.includes('l1')) field = 'L1ApproverStatus';
                    else if (lowerQ.includes('l2')) field = 'L2ApproverStatus';
                    else field = 'InitiatorStatus';
                } else if (lowerQ.includes('vendor')) {
                    field = 'JournalEntryVendorName';
                } else if (lowerQ.includes('cost center')) {
                    field = 'JournalEntryCostCenter';
                }
            }

            if (!field) {
                return res.json({
                    answer: "I'm not sure which column to count by. Try asking 'how many by vendor' or 'breakdown by status'.",
                    data: []
                });
            }

            const result = await Entry.aggregate([
                { $group: { _id: `$${field}`, count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            const labeledResult = result.map(r => ({
                [field]: r._id,
                count: r.count
            }));

            return formatOutput(res, question, labeledResult);
        }

        // ============================
        // DUPLICATE FINDER
        // ============================
        if (isDuplicate(question)) {
            const field = columns.find(c => question.includes(c.toLowerCase()));

            const result = await Entry.aggregate([
                { $group: { _id: `$${field}`, rows: { $push: "$$ROOT" }, count: { $sum: 1 } } },
                { $match: { count: { $gt: 1 } } }
            ]);

            const labeledResult = result.map(r => ({
                [field]: r._id,
                count: r.count,
                rows: r.rows
            }));

            return formatOutput(res, question, labeledResult);
        }

        // ============================
        // EMPTY / NULL CHECKER
        // ============================
        if (isMissingQuery(question)) {
            const field = columns.find(c => question.includes(c.toLowerCase()));

            const result = await Entry.find({
                $or: [
                    { [field]: null },
                    { [field]: "" },
                    { [field]: undefined }
                ]
            }).limit(50).select({ _id: 0 });

            return formatOutput(res, question, result);
        }

        // ======================================================
        // FALLBACK → AI GENERATED QUERY (MongoDB JSON)
        // ======================================================

        const prompt = `
Convert user question into a MongoDB query JSON.

FIELDS: ${columns.join(", ")}

Return ONLY this JSON:
{
 "filter": {},
 "sort": {},
 "limit": 10,
 "projection": {}
}

DO NOT include comments.
DO NOT explain anything.
Use exact field names.
If the user asks for "all" or "every", set "limit" to 0. 
If specific number is asked, use that limit.
Default limit: 10.

User question: "${question}"
`;

        const ai = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0
        });

        let query = {};
        try {
            query = JSON.parse(ai.choices[0].message.content);
        } catch {
            return res.json({
                answer: "I couldn't understand your query. Please rephrase.",
                data: [],
                error: "Invalid JSON from AI"
            });
        }

        const { filter = {}, sort = {}, limit = 10, projection = {} } = query;

        let finalProj = {};
        const hasInclusion = Object.values(projection).includes(1);

        if (hasInclusion) {
            Object.keys(projection).forEach(k => {
                if (projection[k] === 1 && !["_id", "__v", "createdAt", "updatedAt"].includes(k)) {
                    finalProj[k] = 1;
                }
            });
        }

        finalProj._id = 0;
        finalProj.__v = 0;
        finalProj.createdAt = 0;
        finalProj.updatedAt = 0;

        const result = await Entry.find(filter)
            .sort(sort)
            .limit(limit)
            .select(finalProj);

        return formatOutput(res, question, result, query);

    } catch (error) {
        console.error("AI error:", error);
        console.error(error.stack);

        return res.json({
            answer: "An error occurred while processing your question.",
            error: error.message,
            data: []
        });
    }
};

// =====================================================
// FORMAT OUTPUT
// =====================================================

async function formatOutput(res, question, data, queryUsed = null) {
    if (!data || data.length === 0) {
        return res.json({
            answer: "No data found for your query.",
            data: [],
            queryUsed
        });
    }

    if (typeof data[0] === "string" || typeof data[0] === "number") {
        return res.json({
            answer: data.map((v, i) => `${i + 1}. ${v}`).join("\n"),
            data,
            queryUsed
        });
    }

    const cleaned = data.map(row => {
        const obj = row.toObject ? row.toObject() : row;
        delete obj._id;
        delete obj.__v;
        delete obj.createdAt;
        delete obj.updatedAt;

        Object.keys(obj).forEach(k => (obj[k] = String(obj[k] || "")));
        return obj;
    });

    const prompt = `
The user has asked a question about their data. The full data is already displayed to them in a separate table view.
Please provide a brief, helpful summary or introduction to the data found.
Do NOT repeat the data in a table or list format.

User question: "${question}"
Number of results: ${cleaned.length}

Example response: "Here are the top ${cleaned.length} entries matching your criteria."
`;

    try {
        const formatted = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2
        });

        res.json({
            answer: formatted.choices[0].message.content,
            data: cleaned,
            queryUsed
        });

    } catch (error) {
        console.error("Formatting failed:", error);

        res.json({
            answer: `Here are ${cleaned.length} results:`,
            data: cleaned,
            queryUsed
        });
    }
}
