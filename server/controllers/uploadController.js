import XLSX from "xlsx";
import Entry from "../model/Entry.js";
import { progressEmitter } from "../utils/progress.js";

// Convert Excel serial date → YYYY-MM-DD
function fixDate(value) {
    if (!value) return "";

    // If already a string date (e.g., "31-07-2024")
    if (typeof value === "string" && value.trim() !== "") return value;

    // If Excel stored date as number → convert
    if (typeof value === "number") {
        const excelEpoch = new Date((value - 25569) * 86400 * 1000);
        return excelEpoch.toISOString().split("T")[0]; // YYYY-MM-DD
    }

    return String(value);
}

// Convert ANY Excel cell to clean string
function toStr(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim();
}

export const uploadExcel = async (req, res) => {
    try {
        console.log("⚡ Upload started…");
        const startTime = Date.now();

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        console.log("📄 Reading Excel file...");

        // ❗ IMPORTANT: Prevent XLSX from converting dates to JS Date
        const workbook = XLSX.read(req.file.buffer, {
            type: "buffer",
            cellDates: false,
            raw: false,
        });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        console.log(`📊 Total rows detected: ${rows.length}`);

        const batchSize = 20000; //  50,000 per batch
        let batch = [];

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];

            batch.push({
                zvolvWID: toStr(r["Zvolv WID"]),
                WID: toStr(r["WID"]),
                DocumentDate: fixDate(r["Document Date"]),
                PostingDate: fixDate(r["Posting Date"]),
                JournalEntrySrNo: toStr(r["Journal Entry Sr. No"]),
                JournalEntryBusinessArea: toStr(r["Journal Entry Business Area"]),
                JournalEntryAccountType: toStr(r["Journal Entry Account Type"]),
                JournalEntryType: toStr(r["Journal Entry Type"]),
                JournalEntryVendorName: toStr(r["Journal Entry Vendor/Customer/GL Name"]),
                JournalEntryVendorNumber: toStr(r["Journal Entry Vendor/Customer/GL Number"]),
                JournalEntryCostCenter: toStr(r["Journal Entry Cost Center"]),
                JournalEntryProfitCenter: toStr(r["Journal Entry Profit Center"]),
                JournalEntryAmount: toStr(r["Journal Entry Amount"]),
                JournalEntryPersonalNumber: toStr(r["Journal Entry Personal Number"]),
                InitiatorName: toStr(r["Initiator's Name"]),
                InitiatorStatus: toStr(r["Initiator's Status"]),
                L1ApproverName: toStr(r["L1 Approver's Name"]),
                L1ApproverStatus: toStr(r["L1 Approver's Status"]),
                L2ApproverName: toStr(r["L2 Approver's Name"]),
                L2ApproverStatus: toStr(r["L2 Approver's Status"]),
                DocumentNumberOrErrorMessage: toStr(r["Document Number/Error Message"]),
                ReversalDocumentNumber: toStr(r["Reversal Document Number"]),
                excelRowNumber: i + 1,
            });

            // When batch is full → insert & show progress
            if (batch.length === batchSize) {
                const batchNumber = Math.ceil((i + 1) / batchSize);

                console.log(`📥 Inserting batch ${batchNumber} (${batch.length} rows)…`);
                await Entry.insertMany(batch);
                batch = [];

                // Memory usage
                const usedMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                console.log(`🧠 Memory used: ${usedMB} MB`);

                // Percentage progress
                const percent = (((i + 1) / rows.length) * 100).toFixed(2);
                console.log(`⏳ Progress: ${percent}%`);
                progressEmitter.emit("progress", { percent });
            }
        }

        if (batch.length > 0) {
            await Entry.insertMany(batch);
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log("✅ Upload complete in", totalTime, "seconds");

        res.json({
            message: "Excel uploaded successfully",
            rows: rows.length,
            time: totalTime,
            status: true
        });
    } catch (err) {
        console.error("❌ Upload failed:", err);
        res.status(500).json({ error: err.message });
    }
};
