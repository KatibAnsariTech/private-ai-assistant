
// Mock Dependencies
const Entry = {
    find: () => ({
        sort: () => ({
            limit: (n) => ({
                select: (proj) => {
                    console.log(`[Entry.find] Called with limit: ${n}`);
                    return Promise.resolve([{ "mock": "data" }]);
                }
            })
        }),
        limit: (n) => ({
            select: (proj) => {
                console.log(`[Entry.find] Called with limit: ${n}`);
                return Promise.resolve([{ "mock": "data" }]);
            }
        })
    }),
    aggregate: (pipeline) => {
        console.log(`[Entry.aggregate] Called with pipeline length: ${pipeline.length}`);
        return Promise.resolve([{
            _id: null,
            totalAmount: 50000,
            avgAmount: 5000,
            maxAmount: 10000,
            minAmount: 1000,
            count: 10
        }]);
    }
};

const OpenAI = class {
    constructor() { }
    chat = {
        completions: {
            create: () => Promise.resolve({
                choices: [{ message: { content: "{}" } }]
            })
        }
    }
};

const getColumns = async () => ["WID", "JournalEntryVendorName", "JournalEntryAmount", "DocumentDate"];
const extractCols = (q, cols) => [];

// COPIED & ADAPTED HELPERS
const isAll = q => /all|every|entire|complete/i.test(q);
const extractNumber = (q) => {
    if (isAll(q)) return 10000;
    return Number(q.match(/\b(\d+)\b/)?.[1] || 10);
};

const isStatsQuery = q =>
    /(average|mean|total|sum|min|max|minimum|maximum)/i.test(q) && /(amount|value|quantity)/i.test(q);

const isTextSearch = q =>
    /(find|search|contains|matching)/i.test(q);

const isStatusQuery = q =>
    /(approved|rejected|pending)/i.test(q);

const isDateRange = q =>
    /(between|from|to)/i.test(q) && /(date|posting|document)/i.test(q);
const extractDateRange = q => ({ start: "2023-01-01", end: "2023-01-31" });

const isAmountRange = q =>
    /(amount|value)/i.test(q) && /(>|<|<=|>=|between)/i.test(q);
const extractAmountRange = q => ({ min: 100 });

// SIMULATE CONTROLLER LOGIC (Simplified for logic test)
async function testLogic(question) {
    console.log(`\nTesting Question: "${question}"`);

    // Setup context
    const columns = await getColumns();
    const isAllQuery = isAll(question);
    const dynamicLimit = isAllQuery ? 0 : 50;

    // Stats
    if (isStatsQuery(question)) {
        console.log("-> Detected as Stats Query");
        await Entry.aggregate([]);
        return;
    }

    // Text Search
    if (isTextSearch(question)) {
        console.log("-> Detected as Text Search");
        await Entry.find({}).limit(dynamicLimit).select({});
        return;
    }

    // Status
    if (isStatusQuery(question)) {
        console.log("-> Detected as Status Query");
        await Entry.find({}).limit(dynamicLimit).select({});
        return;
    }

    // Date
    if (isDateRange(question)) {
        console.log("-> Detected as Date Range");
        await Entry.find({}).limit(dynamicLimit).select({});
        return;
    }

    // Amount
    if (isAmountRange(question)) {
        console.log("-> Detected as Amount Range");
        await Entry.find({}).limit(dynamicLimit).select({});
        return;
    }

    // Fallback/General
    console.log("-> General Query");
}

async function runTests() {
    await testLogic("Show all entries for vendor TCS"); // Text search + All
    await testLogic("What is the average amount?"); // Stats
    await testLogic("Find entries matching TCS"); // Normal text search
    await testLogic("Show approved entries"); // Status (normal)
    await testLogic("Show all approved entries"); // Status + All
}

runTests();
