import Entry from "../model/Entry.js";

/* =====================================================
   BASIC COUNTS
   ===================================================== */

export const countAllEntries = async () => {
  const count = await Entry.countDocuments();
  return [
    { label: "Total Entries", count }
  ];
};


/* =====================================================
   UNIQUE / DISTRIBUTIONS
   ===================================================== */

// ✅ ALL unique Journal Entry Types (cleaned, no garbage)
export const countAllJournalEntryTypes = async () => {
  return Entry.aggregate([
    {
      $match: {
        JournalEntryType: { $exists: true, $ne: "" }
      }
    },
    {
      $addFields: {
        entryTypeCleaned: {
          $toUpper: {
            $trim: { input: "$JournalEntryType" }
          }
        }
      }
    },
    {
      $group: {
        _id: "$entryTypeCleaned",
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    {
      $project: {
        type: "$_id",
        count: 1,
        _id: 0
      }
    }
  ]);
};

// Generic distribution (vendors, cost centers, etc.)
export const countByField = async (field) => {
  return Entry.aggregate([
    {
      $match: {
        [field]: { $nin: ["", null, undefined] }
      }
    },
    {
      $group: {
        _id: `$${field}`,
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    {
      $project: {
        value: "$_id",
        count: 1,
        _id: 0
      }
    }
  ]);
};

// 🔝 Top value by field (vendor with highest entries)
export const topByField = async (field) => {
  const res = await Entry.aggregate([
    {
      $match: {
        [field]: { $nin: ["", null, undefined] }
      }
    },
    {
      $group: {
        _id: `$${field}`,
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 1 },
    {
      $project: {
        value: "$_id",
        count: 1,
        _id: 0
      }
    }
  ]);

  return res;
};

/* =====================================================
   AMOUNT STATS (SAFE NUMERIC)
   ===================================================== */


export const amountStats = async () => {
  return Entry.aggregate([
    {
      $addFields: {
        amountClean: {
          $switch: {
            branches: [
              // Case 1: Already a number (including scientific notation)
              {
                case: { $isNumber: "$JournalEntryAmount" },
                then: "$JournalEntryAmount"
              },
              // Case 2: String number with commas
              {
                case: { $eq: [{ $type: "$JournalEntryAmount" }, "string"] },
                then: {
                  $convert: {
                    input: {
                      $replaceAll: {
                        input: {
                          $trim: { input: "$JournalEntryAmount" }
                        },
                        find: ",",
                        replacement: ""
                      }
                    },
                    to: "double",
                    onError: null,
                    onNull: null
                  }
                }
              }
            ],
            default: null
          }
        }
      }
    },
    {
      // remove invalid / zero / null values
      $match: {
        amountClean: { $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amountClean" },
        avg: { $avg: "$amountClean" },
        max: { $max: "$amountClean" },
        min: { $min: "$amountClean" }
      }
    },
    {
      $project: { _id: 0 }
    }
  ]);

};

/* =====================================================
   FILTERED ENTRIES (TABLE ONLY)
   ===================================================== */

/**
 * 
 * @param {*} vendor 
 * @returns vendor name , total amount per month , date , count(how many time vendor name appear in this month) per month
 */

//   get data by vendor name :
export const getEntriesByVendor = async (vendor) => {
  // Handle apostrophe variations: ' and '
  const vendorPattern = vendor
    .replace(/'/g, "[''']")  // Match both straight and curly apostrophes
    .replace(/\s+/g, "\\s+"); // Handle multiple spaces

  return Entry.aggregate([
    // 1️⃣ Match vendor (case-insensitive, flexible apostrophes)
    {
      $match: {
        JournalEntryVendorName: new RegExp(vendorPattern, "i")
      }
    },

    // 2️⃣ Normalize amount + date (your DB format)
    {
      $addFields: {
        amountClean: {
          $toDouble: "$JournalEntryAmount"
        },
        postingDateClean: {
          $dateFromString: {
            dateString: {
              // remove weekday + timezone
              $substrBytes: ["$PostingDate", 4, 20]
            },
            format: "%b %d %Y %H:%M:%S",
            onError: null,
            onNull: null
          }
        }
      }
    },

    // 3️⃣ Remove invalid rows
    {
      $match: {
        amountClean: { $ne: null },
        postingDateClean: { $ne: null }
      }
    },

    // 4️⃣ Group by month + keep vendor name
    {
      $group: {
        _id: {
          month: {
            $dateToString: {
              format: "%Y-%m",
              date: "$postingDateClean"
            }
          }
        },
        vendorName: { $first: "$JournalEntryVendorName" },
        count: { $sum: 1 },
        totalAmount: { $sum: "$amountClean" }
      }
    },

    // 5️⃣ Sort months (old → new)
    {
      $sort: { "_id.month": 1 }
    },

    // 6️⃣ Final response shape
    {
      $project: {
        _id: 0,
        vendorName: 1,
        month: "$_id.month",
        count: 1,
        totalAmount: 1
      }
    }
  ]);
};



/**
 * 
 * @param {*} min 
 * @param {*} max 
 * @returns total count of unique vendor name , the count of data , between those min max amount 
 */

export const getEntriesByAmount = async (min, max = null) => {
  // Build pipeline dynamically to avoid $and: [] issue
  const pipeline = [
    // 1️⃣ Normalize amount safely
    {
      $addFields: {
        amountClean: {
          $switch: {
            branches: [
              // Case 1: already a number
              {
                case: { $isNumber: "$JournalEntryAmount" },
                then: "$JournalEntryAmount"
              },

              // Case 2: numeric-looking string ONLY
              {
                case: {
                  $and: [
                    { $eq: [{ $type: "$JournalEntryAmount" }, "string"] },
                    {
                      $regexMatch: {
                        input: { $trim: { input: "$JournalEntryAmount" } },
                        regex: /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/
                      }
                    }
                  ]
                },
                then: {
                  $convert: {
                    input: {
                      $replaceAll: {
                        input: { $trim: { input: "$JournalEntryAmount" } },
                        find: ",",
                        replacement: ""
                      }
                    },
                    to: "double",
                    onError: null,
                    onNull: null
                  }
                }
              }
            ],
            default: null
          }
        }
      }
    },

    // 2️⃣ Remove invalid amounts
    {
      $match: {
        amountClean: { $ne: null }
      }
    }
  ];

  // 3️⃣ Apply min / max filter ONLY if provided
  // Build conditions array dynamically
  const conditions = [];
  if (min !== null && min !== undefined) {
    conditions.push({ $gte: ["$amountClean", min] });
  }
  if (max !== null && max !== undefined) {
    conditions.push({ $lte: ["$amountClean", max] });
  }

  // Only add the $match stage if we have conditions
  if (conditions.length > 0) {
    pipeline.push({
      $match: {
        $expr: conditions.length === 1 ? conditions[0] : { $and: conditions }
      }
    });
  }

  // 4️⃣ Facet → rows + totalCount + uniqueVendorCount
  pipeline.push({
    $facet: {

      totalCount: [
        { $count: "count" }
      ],

      uniqueVendorCount: [
        {
          $match: {
            JournalEntryVendorName: { $nin: ["", null] }
          }
        },
        {
          $group: {
            _id: {
              $toUpper: {
                $trim: { input: "$JournalEntryVendorName" }
              }
            }
          }
        },
        { $count: "count" }
      ]
    }
  });

  // 5️⃣ Final response shape
  pipeline.push({
    $project: {
      rows: 1,
      totalCount: {
        $ifNull: [{ $arrayElemAt: ["$totalCount.count", 0] }, 0]
      },
      uniqueVendorCount: {
        $ifNull: [{ $arrayElemAt: ["$uniqueVendorCount.count", 0] }, 0]
      }
    }
  });

  console.log("📊 getEntriesByAmount called with min:", min, "max:", max);
  console.log("📊 Conditions count:", conditions.length);

  return Entry.aggregate(pipeline);
};




/**
 * 
 * @param {date} start 
 * @param {date} end 
 * @param {} field 
 * @returns from between start date to end date , return , vendor name , total amount , count
 */
export const getEntriesByDate = async (
  start,
  end,
  field = "DocumentDate"
) => {
  return Entry.aggregate([
    // 1️⃣ Parse date string → Date
    {
      $addFields: {
        documentDateClean: {
          $dateFromString: {
            dateString: { $substrBytes: [`$${field}`, 4, 20] },
            format: "%b %d %Y %H:%M:%S",
            onError: null,
            onNull: null
          }
        }
      }
    },

    // 2️⃣ Filter by date range
    {
      $match: {
        documentDateClean: {
          $gte: new Date(start),
          $lte: new Date(end)
        }
      }
    },

    // 3️⃣ Clean amount safely
    {
      $addFields: {
        amountClean: {
          $switch: {
            branches: [
              // already number
              {
                case: { $isNumber: "$JournalEntryAmount" },
                then: "$JournalEntryAmount"
              },
              // numeric-looking string only
              {
                case: {
                  $and: [
                    { $eq: [{ $type: "$JournalEntryAmount" }, "string"] },
                    {
                      $regexMatch: {
                        input: { $trim: { input: "$JournalEntryAmount" } },
                        regex:
                          /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/
                      }
                    }
                  ]
                },
                then: {
                  $toDouble: {
                    $replaceAll: {
                      input: { $trim: { input: "$JournalEntryAmount" } },
                      find: ",",
                      replacement: ""
                    }
                  }
                }
              }
            ],
            default: null
          }
        }
      }
    },

    // 4️⃣ Remove invalid rows
    {
      $match: {
        JournalEntryVendorName: { $ne: "" },
        amountClean: { $ne: null }
      }
    },

    // 5️⃣ Group by UNIQUE vendor
    {
      $group: {
        _id: {
          $toUpper: {
            $trim: { input: "$JournalEntryVendorName" }
          }
        },
        vendorName: { $first: "$JournalEntryVendorName" },
        count: { $sum: 1 },
        totalAmount: { $sum: "$amountClean" }
      }
    },

    // 6️⃣ Sort (highest amount first – optional)
    {
      $sort: { totalAmount: -1 }
    },

    // 7️⃣ Final response
    {
      $project: {
        _id: 0,
        vendorName: 1,
        count: 1,
        totalAmount: 1
      }
    }
  ]);
};


/**
 * 
 * @param {*} field  //L1 Approver's Status or L2 Approver's Status
 * @param {*} status // approved , pending  ,reject 
 * @returns status , feild name  , count
 */
export const getEntriesByStatus = async (field, status) => {
  const count = await Entry.countDocuments({
    [field]: new RegExp(`^${status}$`, "i")
  });

  return { field, status, count };
};



// export const getEntryByDocument = async (doc) => {
//   return Entry.findOne({
//     DocumentNumberOrErrorMessage: doc
//   }).lean();
// };



/**
 * 
 * @returns monthly total amount and month
 */
// 📈 Monthly Total Amount Trend
export const amountMonthlyTrend = async () => {
  return Entry.aggregate([
    // 1️⃣ Parse date + clean amount
    {
      $addFields: {
        postingDateClean: {
          $dateFromString: {
            dateString: { $substrBytes: ["$PostingDate", 4, 20] },
            format: "%b %d %Y %H:%M:%S",
            onError: null,
            onNull: null
          }
        },
        amountClean: {
          $switch: {
            branches: [
              {
                case: { $isNumber: "$JournalEntryAmount" },
                then: "$JournalEntryAmount"
              },
              {
                case: {
                  $and: [
                    { $eq: [{ $type: "$JournalEntryAmount" }, "string"] },
                    {
                      $regexMatch: {
                        input: { $trim: { input: "$JournalEntryAmount" } },
                        regex:
                          /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/
                      }
                    }
                  ]
                },
                then: {
                  $toDouble: {
                    $replaceAll: {
                      input: { $trim: { input: "$JournalEntryAmount" } },
                      find: ",",
                      replacement: ""
                    }
                  }
                }
              }
            ],
            default: null
          }
        }
      }
    },

    // 2️⃣ Remove invalid rows
    {
      $match: {
        postingDateClean: { $ne: null },
        amountClean: { $ne: null }
      }
    },

    // 3️⃣ Group by month
    {
      $group: {
        _id: {
          month: {
            $dateToString: {
              format: "%Y-%m",
              date: "$postingDateClean"
            }
          }
        },
        totalAmount: { $sum: "$amountClean" }
      }
    },

    // 4️⃣ Sort old → new
    { $sort: { "_id.month": 1 } },

    // 5️⃣ Final output
    {
      $project: {
        _id: 0,
        month: "$_id.month",
        totalAmount: 1
      }
    }
  ]);
};
