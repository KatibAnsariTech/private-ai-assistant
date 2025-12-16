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

    // ❌ If AI is not confident
    if (!decision.helperFunction || decision.confidence < 0.7) {
      console.log("❌ Low confidence or no helper function");
      return res.json({
        answer: "Unable to understand query",
        data: [],
        presentType: "table"
      });
    }

    const fn =
      helpers[decision.helperFunction] ||
      timeHelpers[decision.helperFunction];

    if (!fn) {
      console.log("❌ Helper function not found:", decision.helperFunction);
      return res.json({
        answer: "Helper function not found",
        data: [],
        presentType: "table"
      });
    }

    console.log("✅ Calling function:", decision.helperFunction);
    console.log("📋 Parameters:", decision.parameters);

    let data;

    if (decision.helperFunction === "getEntriesByAmount") {
      const { min = null, max = null } = decision.parameters || {};
      data = await fn(min, max);
    } else {
      data = await fn(...Object.values(decision.parameters || {}));
    }

    console.log("📊 Data returned:", Array.isArray(data) ? `${data.length} items` : typeof data);
    if (Array.isArray(data) && data.length > 0) {
      console.log("📄 First item:", JSON.stringify(data[0], null, 2));
    }

    let graph = null;
    let presentType = "table"; // ✅ DEFAULT

    /* =====================================================
       GRAPH DECISION LOGIC (FINAL & CORRECT)
       ===================================================== */

    // 🔹 SINGLE KPI → LINE FROM 0 → VALUE
    if (
      decision.helperFunction === "countAllEntries" &&
      data &&
      typeof data.count === "number"
    ) {
      presentType = "bar";
      graph = {
        type: "bar",
        x: ["Start", "Current"],
        y: [0, data.count],
        label: "Total Entries"
      };
    }

    if (decision.graph === true && Array.isArray(data) && data.length > 0) {

      // Month vs Count
      if (data[0].month && data[0].count !== undefined) {
        presentType = decision.graphType || "bar";
        graph = {
          type: presentType,
          x: data.map(d => d.month),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      // Month vs Amount
      else if (data[0].month && data[0].totalAmount !== undefined) {
        presentType = decision.graphType || "bar";
        graph = {
          type: presentType,
          x: data.map(d => d.month),
          y: data.map(d => d.totalAmount),
          label: decision.intent
        };
      }

      // Category vs Count
      else if (
        (data[0].type || data[0].value || data[0].vendorName) &&
        data[0].count !== undefined
      ) {
        presentType = "bar";
        graph = {
          type: "bar",
          x: data.map(d => d.type || d.value || d.vendorName),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

      //  count
      else if (data[0].label && data[0].count !== undefined) {
        presentType = "bar"; // changed from pie
        graph = {
          type: "bar",
          x: data.map(d => d.label),
          y: data.map(d => d.count),
          label: decision.intent
        };
      }

    }

    // ✅ AUTO-GRAPH: Vendor monthly trends (from getEntriesByVendor)
    // Data structure: [{vendorName, month, count, totalAmount}...]
    // Always show as LINE chart in ascending date order
    if (!graph && Array.isArray(data) && data.length > 0) {
      if (data[0].month && data[0].vendorName && data[0].totalAmount !== undefined) {
        presentType = "bar";
        graph = {
          type: "bar",
          x: data.map(d => d.month),
          y: data.map(d => d.totalAmount),
          label: `${data[0].vendorName} - Monthly Trend`
        };
      }
    }

    // ✅ AUTO-GRAPH: Amount range queries (from getEntriesByAmount)
    // Data structure: [{totalCount, uniqueVendorCount}]
    // Show as LINE chart with count data points
    if (!graph && Array.isArray(data) && data.length > 0) {
      if (data[0].totalCount !== undefined && data[0].uniqueVendorCount !== undefined) {
        presentType = "bar";
        graph = {
          type: "bar",
          x: ["Total Entries", "Unique Vendors"],
          y: [data[0].totalCount, data[0].uniqueVendorCount],
          label: decision.intent || "Amount Range Statistics"
        };
      }
    }

    return res.json({
      answer: decision.message,
      data,
      graph,
      presentType // ✅ UI relies ONLY on this
    });

  } catch (err) {
    console.error("askAi error:", err);
    res.status(500).json({ error: err.message });
  }
};
