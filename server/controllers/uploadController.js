import Excel from "exceljs";
import { progressEmitter } from "../utils/progress.js";
import Entry from "../model/Entry.js";

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

export const uploadExcel = async (req, res) => {
    try {
        console.log("⚡ Upload started...");

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const workbook = new Excel.Workbook();
        await workbook.xlsx.load(req.file.buffer);

        const sheet = workbook.getWorksheet(1);
        const totalRows = sheet.actualRowCount;

        console.log("Total rows:", totalRows);

        let batch = [];
        const batchSize = 10000; // prevent Render crash

        for (let rowNumber = 2; rowNumber <= totalRows; rowNumber++) {
            const r = sheet.getRow(rowNumber);

            batch.push({
                zvolvWID: toStr(r.getCell(1).value),
                WID: toStr(r.getCell(2).value),
                DocumentDate: fixDate(r.getCell(3).value),
                PostingDate: fixDate(r.getCell(4).value),
                JournalEntrySrNo: toStr(r.getCell(5).value),
                JournalEntryBusinessArea: toStr(r.getCell(6).value),
                JournalEntryAccountType: toStr(r.getCell(7).value),
                JournalEntryType: toStr(r.getCell(8).value),
                JournalEntryVendorName: toStr(r.getCell(9).value),
                JournalEntryVendorNumber: toStr(r.getCell(10).value),
                JournalEntryCostCenter: toStr(r.getCell(11).value),
                JournalEntryProfitCenter: toStr(r.getCell(12).value),
                JournalEntryAmount: toStr(r.getCell(13).value),
                JournalEntryPersonalNumber: toStr(r.getCell(14).value),
                InitiatorName: toStr(r.getCell(15).value),
                InitiatorStatus: toStr(r.getCell(16).value),
                L1ApproverName: toStr(r.getCell(17).value),
                L1ApproverStatus: toStr(r.getCell(18).value),
                L2ApproverName: toStr(r.getCell(19).value),
                L2ApproverStatus: toStr(r.getCell(20).value),
                DocumentNumberOrErrorMessage: toStr(r.getCell(21).value),
                ReversalDocumentNumber: toStr(r.getCell(22).value),

                excelRowNumber: rowNumber
            });

            // when batch fills → insert
            if (batch.length === batchSize) {
                await Entry.insertMany(batch);
                batch = [];

                // send progress update
                const percent = ((rowNumber / totalRows) * 100).toFixed(2);
                progressEmitter.emit("progress", { percent });

                console.log("Progress:", percent + "%");
            }
        }

        // insert leftover rows
        if (batch.length > 0) {
            await Entry.insertMany(batch);
        }

        progressEmitter.emit("progress", { percent: 100 });

        res.json({
            status: true,
            message: "Upload completed",
            rows: totalRows
        });

    } catch (err) {
        console.error("❌ Upload failed:", err);
        res.status(500).json({ error: err.message });
    }
};
