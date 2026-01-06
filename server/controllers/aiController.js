import OpenAI from "openai";
import { AI_SYSTEM_PROMPT } from "../config/aiSystemPrompt.js";
import * as helpers from "./aiHelperFunctions.js";
import * as timeHelpers from "./timeSeriesHelpers.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const askAi = async (req, res) => {
  try {
    const { question } = req.body;

    const ai = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content: question }
      ]
    });

    const decision = JSON.parse(ai.choices[0].message.content);

    console.log("🤖 AI Decision:", JSON.stringify(decision, null, 2));

    // ❌ Low confidence
    if (!decision.helperFunction || decision.confidence < 0.7) {
      return res.json({
        answer: "Unable to understand query",
        data: [],
        graph: null,
        presentType: "table"
      });
    }

    const fn =
      helpers[decision.helperFunction] ||
      timeHelpers[decision.helperFunction];

    if (!fn) {
      return res.json({
        answer: "Helper function not found",
        data: [],
        graph: null,
        presentType: "table"
      });
    }

    console.log("✅ Calling function:", decision.helperFunction);
    console.log("📋 Parameters:", decision.parameters);

    let data;

    // ===== PARAMETER HANDLING =====
    if (decision.helperFunction === "getEntriesByAmount") {
      const { min = null, max = null } = decision.parameters || {};
      data = await fn(min, max);

    } else if (decision.helperFunction === "getEntriesByStatus") {
      const [[field, status]] = Object.entries(decision.parameters || {});
      data = await fn(field, status);

    } else if (decision.helperFunction === "topByField") {
      data = await fn("JournalEntryVendorName");
    }
    else {
      data = await fn(...Object.values(decision.parameters || {}));
    }

    console.log(
      "📊 Data returned:",
      Array.isArray(data) ? `${data.length} items` : typeof data
    );

    let graph = null;
    let presentType = "table";

    if (Array.isArray(data) && data.length > 0) {

      // ⭐ NEW: APPROVAL OVERVIEW (L1 / L2)
      if (
        decision.helperFunction === "getApprovalOverview" &&
        data[0].status !== undefined &&
        data[0].count !== undefined
      ) {
        graph = {
          type: "bar",
          x: data.map(d => d.status),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      // 1️⃣ Journal Entry Type distribution
      else if (decision.helperFunction === "countAllJournalEntryTypes") {
        graph = {
          type: "bar",
          x: data.map(d => d.type),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      // 2️⃣ Top-by-field (single)
      else if (
        decision.helperFunction === "topByField" &&
        data[0].value !== undefined &&
        data[0].count !== undefined
      ) {
        graph = {
          type: "bar",
          x: [data[0].value],
          y: [data[0].count],
          label: decision.intent
        };
      }

      // 3️⃣ Generic distribution
      else if (
        decision.helperFunction === "countByField" &&
        data[0].value !== undefined &&
        data[0].count !== undefined
      ) {
        graph = {
          type: "bar",
          x: data.map(d => d.value),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      // 4️⃣ Month vs Count
      else if (data[0].month && data[0].count !== undefined) {
        graph = {
          type: "bar",
          x: data.map(d => d.month),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      // 5️⃣ Month vs Amount
      else if (data[0].month && data[0].totalAmount !== undefined) {
        graph = {
          type: "bar",
          x: data.map(d => d.month),
          y: data.map(d => d.totalAmount),
          label: decision.intent
        };
      }

      // 6️⃣ Vendor vs Count
      else if (data[0].vendorName && data[0].count !== undefined) {
        graph = {
          type: "bar",
          x: data.map(d => d.vendorName),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      // 7️⃣ Label / Status count
      else if (data[0].label && data[0].count !== undefined) {
        graph = {
          type: "bar",
          x: data.map(d => d.label),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      // 🏢 Cost Center distribution
      else if (data[0].costCenter && data[0].count !== undefined) {
        graph = {
          type: "bar",
          x: data.map(d => d.costCenter),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      // 🏢 Profit Center distribution
      else if (data[0].profitCenter && data[0].count !== undefined) {
        graph = {
          type: "bar",
          x: data.map(d => d.profitCenter),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      // 🏢 Business Area distribution
      else if (data[0].businessArea && data[0].count !== undefined) {
        graph = {
          type: "bar",
          x: data.map(d => d.businessArea),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      // 👤 Vendor concentration (totalAmount)
      else if (data[0].vendorName && data[0].totalAmount !== undefined && data[0].count !== undefined) {
        graph = {
          type: "bar",
          x: data.map(d => d.vendorName),
          y: data.map(d => d.totalAmount),
          label: decision.intent
        };
      }

      // ✅ Approval rates (with percentage)
      else if (data[0].status && data[0].percentage !== undefined) {
        graph = {
          type: "bar",
          x: data.map(d => d.status),
          y: data.map(d => d.percentage),
          label: decision.intent
        };
      }

      // ✅ Approver workload
      else if (data[0].approverName && data[0].count !== undefined) {
        graph = {
          type: "bar",
          x: data.map(d => d.approverName),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      // 📈 Year over year
      else if (data[0].year && data[0].totalAmount !== undefined) {
        graph = {
          type: "bar",
          x: data.map(d => d.year),
          y: data.map(d => d.totalAmount),
          label: decision.intent
        };
      }

      // 📄 Error messages distribution
      else if (data[0].errorMessage && data[0].count !== undefined) {
        graph = {
          type: "bar",
          x: data.map(d => d.errorMessage),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      // 8️⃣ Amount range summary
      else if (
        data[0].totalCount !== undefined &&
        data[0].uniqueVendorCount !== undefined
      ) {
        graph = {
          type: "bar",
          x: ["Total Entries", "Unique Vendors"],
          y: [data[0].totalCount, data[0].uniqueVendorCount],
          label: decision.intent
        };
      }
    }

    // 🔐 FINAL GUARANTEE
    if (graph?.type) {
      presentType = graph.type;
    }

    return res.json({
      answer: decision.message,
      data,
      graph,
      presentType
    });

  } catch (err) {
    console.error("askAi error:", err);
    res.status(500).json({ error: err.message });
  }
};
