import mongoose from "mongoose";

const EntrySchema = new mongoose.Schema(
  {
    zvolvWID: String,
    WID: String,
    DocumentDate: String,
    PostingDate: String,
    JournalEntrySrNo: String,
    JournalEntryBusinessArea: String,
    JournalEntryAccountType: String,
    JournalEntryType: String,
    JournalEntryVendorName: String,
    JournalEntryVendorNumber: String,
    JournalEntryCostCenter: String,
    JournalEntryProfitCenter: String,
    JournalEntryAmount: String,
    JournalEntryPersonalNumber: String,
    InitiatorName: String,
    InitiatorStatus: String,
    L1ApproverName: String,
    L1ApproverStatus: String,
    L2ApproverName: String,
    L2ApproverStatus: String,
    DocumentNumberOrErrorMessage: String,
    ReversalDocumentNumber: String,

    // Only number field → used for sorting
    excelRowNumber: Number,
  },
  { timestamps: true }
);

export default mongoose.model("Entry", EntrySchema);
