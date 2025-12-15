import Entry from "../model/Entry.js";

/**
 * SAFE date conversion for:
 * "Sun Nov 30 2025 05:30:00 GMT+0530 (India Standard Time)"
 */
const safePostingDate = {
  $convert: {
    input: { $substrBytes: ["$PostingDate", 0, 24] },
    to: "date",
    onError: null,
    onNull: null
  }
};

/**
 * SAFE amount conversion (handles "")
 */
const safeAmount = {
  $convert: {
    input: "$JournalEntryAmount",
    to: "double",
    onError: 0,
    onNull: 0
  }
};

/* =====================================================
   1️⃣ Vendor Monthly Trend (ALL MONTHS)
   ===================================================== */
export const vendorMonthlyTrend = async (vendor) => {
  return Entry.aggregate([
    {
      $match: {
        JournalEntryVendorName: new RegExp(vendor, "i"),
        PostingDate: { $type: "string" }
      }
    },
    {
      $addFields: {
        postingDateParsed: safePostingDate
      }
    },
    { $match: { postingDateParsed: { $ne: null } } },
    {
      $addFields: {
        month: {
          $dateToString: {
            format: "%Y-%m",
            date: "$postingDateParsed"
          }
        }
      }
    },
    {
      $group: {
        _id: "$month",
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        month: "$_id",
        count: 1,
        _id: 0
      }
    }
  ]);
};

/* =====================================================
   2️⃣ Vendor: This Month vs Last Month
   ===================================================== */
export const vendorThisVsLastMonth = async (vendor) => {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const previousMonth = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  ).toISOString().slice(0, 7);

  return Entry.aggregate([
    {
      $match: {
        JournalEntryVendorName: new RegExp(vendor, "i"),
        PostingDate: { $type: "string" }
      }
    },
    { $addFields: { postingDateParsed: safePostingDate } },
    { $match: { postingDateParsed: { $ne: null } } },
    {
      $addFields: {
        month: {
          $dateToString: {
            format: "%Y-%m",
            date: "$postingDateParsed"
          }
        }
      }
    },
    {
      $match: {
        month: { $in: [currentMonth, previousMonth] }
      }
    },
    {
      $group: {
        _id: "$month",
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        month: "$_id",
        count: 1,
        _id: 0
      }
    }
  ]);
};

/* =====================================================
   3️⃣ Amount Monthly Trend (ALL MONTHS)
   ===================================================== */
export const amountMonthlyTrend = async () => {
  return Entry.aggregate([
    {
      $match: {
        PostingDate: { $type: "string" }
      }
    },
    {
      $addFields: {
        postingDateParsed: safePostingDate,
        amountSafe: safeAmount
      }
    },
    { $match: { postingDateParsed: { $ne: null } } },
    {
      $addFields: {
        month: {
          $dateToString: {
            format: "%Y-%m",
            date: "$postingDateParsed"
          }
        }
      }
    },
    {
      $group: {
        _id: "$month",
        totalAmount: { $sum: "$amountSafe" }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        month: "$_id",
        totalAmount: 1,
        _id: 0
      }
    }
  ]);
};

/* =====================================================
   4️⃣ Credit vs Debit Monthly Trend
   ===================================================== */
export const creditDebitMonthlyTrend = async () => {
  return Entry.aggregate([
    {
      $match: {
        PostingDate: { $type: "string" }
      }
    },
    {
      $addFields: {
        postingDateParsed: safePostingDate,
        entryType: { $toUpper: "$JournalEntryType" }
      }
    },
    { $match: { postingDateParsed: { $ne: null } } },
    {
      $addFields: {
        month: {
          $dateToString: {
            format: "%Y-%m",
            date: "$postingDateParsed"
          }
        }
      }
    },
    {
      $group: {
        _id: { month: "$month", type: "$entryType" },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.month": 1 } },
    {
      $project: {
        month: "$_id.month",
        type: "$_id.type",
        count: 1,
        _id: 0
      }
    }
  ]);
};
