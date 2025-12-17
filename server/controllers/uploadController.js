import Excel from "exceljs";
import fs from "fs";
import Entry from "../model/Entry.js";
import { progressEmitter } from "../utils/progress.js";


function toStr(value) {
    if (!value) return "";
    if (typeof value === "object" && value.text) return value.text.trim();
    return String(value).trim();
}

function fixDate(value) {
    if (!value) return "";

    if (typeof value === "string") return value;

    if (typeof value === "object" && value.text) {
        return value.text.trim();
    }

    if (typeof value === "number") {
        const excelEpoch = new Date((value - 25569) * 86400 * 1000);
        return excelEpoch.toISOString().split("T")[0];
    }

    return String(value);
}

async function countRows(filePath) {
    let total = 0;
    const workbook = new Excel.stream.xlsx.WorkbookReader(filePath);

    for await (const worksheet of workbook) {
        for await (const row of worksheet) {
            if (row.number === 1) continue;
            total++;
        }
    }
    return total;
}


export const uploadExcel = async (req, res) => {
    const startTime = Date.now();
    try {
        console.log("⚡ Upload started...");

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const filePath = req.file.path;

        // ✅ PASS 1: Count rows
        const totalRows = await countRows(filePath);

        // Inform UI upload started
        progressEmitter.emit("progress", {
            status: "started",
            totalRows
        });

        // ✅ PASS 2: Actual upload
        const workbook = new Excel.stream.xlsx.WorkbookReader(filePath);
        const batchSize = 500;
        let batch = [];
        let processed = 0;

        for await (const worksheet of workbook) {
            for await (const row of worksheet) {
                if (row.number === 1) continue;

                batch.push({
                    zvolvWID: toStr(row.getCell(1).value),
                    WID: toStr(row.getCell(2).value),
                    DocumentDate: fixDate(row.getCell(3).value),
                    PostingDate: fixDate(row.getCell(4).value),
                    JournalEntrySrNo: toStr(row.getCell(5).value),
                    JournalEntryBusinessArea: toStr(row.getCell(6).value),
                    JournalEntryAccountType: toStr(row.getCell(7).value),
                    JournalEntryType: toStr(row.getCell(8).value),
                    JournalEntryVendorName: toStr(row.getCell(9).value),
                    JournalEntryVendorNumber: toStr(row.getCell(10).value),
                    JournalEntryCostCenter: toStr(row.getCell(11).value),
                    JournalEntryProfitCenter: toStr(row.getCell(12).value),
                    JournalEntryAmount: toStr(row.getCell(13).value),
                    JournalEntryPersonalNumber: toStr(row.getCell(14).value),
                    InitiatorName: toStr(row.getCell(15).value),
                    InitiatorStatus: toStr(row.getCell(16).value),
                    L1ApproverName: toStr(row.getCell(17).value),
                    L1ApproverStatus: toStr(row.getCell(18).value),
                    L2ApproverName: toStr(row.getCell(19).value),
                    L2ApproverStatus: toStr(row.getCell(20).value),
                    DocumentNumberOrErrorMessage: toStr(row.getCell(21).value),
                    ReversalDocumentNumber: toStr(row.getCell(22).value),
                    excelRowNumber: row.number
                });

                if (batch.length === batchSize) {
                    await Entry.insertMany(batch, { ordered: false });
                    processed += batch.length;
                    batch = [];

                    const percent = Math.round((processed / totalRows) * 100);

                    progressEmitter.emit("progress", {
                        processed,
                        totalRows,
                        percent
                    });
                }
            }
        }

        if (batch.length) {
            await Entry.insertMany(batch, { ordered: false });
            processed += batch.length;
        }

        fs.unlinkSync(filePath);

        progressEmitter.emit("progress", {
            status: "completed",
            percent: 100,
            processed
        });

        const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);

        res.json({
            success: true,
            message: "Upload completed",
            rows: processed,
            time: timeTaken
        });

    } catch (err) {
        console.error("❌ Upload failed:", err);
        res.status(500).json({ error: err.message });
    }
};
