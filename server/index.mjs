import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

function cleanJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

app.post("/api/cost-search", async (req, res) => {
  if (!OPENAI_API_KEY) {
    res.status(503).json({
      error: "LLM search is not configured. Set OPENAI_API_KEY on the server.",
    });
    return;
  }

  const {
    procedureName,
    cptCode,
    location,
    payer,
    planName,
    planType,
  } = req.body ?? {};

  if (!procedureName || !location) {
    res.status(400).json({
      error: "Procedure and location are required.",
    });
    return;
  }

  const prompt = `Find publicly available, procedure-specific hospital negotiated prices for:
- Procedure: ${procedureName}${cptCode ? ` (CPT/HCPCS ${cptCode})` : ""}
- Location: ${location}
- Payer: ${payer || "not provided"}
- Plan: ${planName || "not provided"}
- Plan type: ${planType || "not provided"}

Search hospital websites and Machine-Readable Files (MRFs). Match the exact payer and plan only when evidence clearly supports it.

Return only JSON matching the supplied schema.
Do not invent hospital names, prices, plan matches, or source URLs.
Only include an explicitly published price when it has an identifiable source URL.
Set planMatch to "exact" only when the source explicitly supports this payer and specific plan, "payer_only" when it supports only the payer, and "unclear" otherwise. Do not copy the requested plan name into a result to imply a match.
Set network to "in" or "out" only for explicit evidence; otherwise use "unknown".
Only return results for the requested procedure code when one was supplied.
If no reliable price is available, return an empty hospitals array.
Include grossCharge and cashPrice only when explicitly found.
Use null for unavailable optional values.`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        tools: [{ type: "web_search_preview" }],
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "hospital_cost_search",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                hospitals: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      hospitalId: { type: "string" },
                      hospitalName: { type: "string" },
                      location: { type: "string" },
                      procedureCode: { type: "string" },
                      procedureDescription: { type: "string" },
                      payer: { type: "string" },
                      planName: { type: "string" },
                      planMatch: {
                        type: "string",
                        enum: ["exact", "payer_only", "unclear"],
                      },
                      network: {
                        type: "string",
                        enum: ["in", "out", "unknown"],
                      },
                      grossCharge: { type: ["number", "null"] },
                      cashPrice: { type: ["number", "null"] },
                      negotiatedAmount: { type: ["number", "null"] },
                      setting: {
                        type: "string",
                        enum: ["inpatient", "outpatient"],
                      },
                      sourceUrl: { type: "string" },
                      lastUpdated: { type: ["string", "null"] },
                    },
                    required: [
                      "hospitalId",
                      "hospitalName",
                      "location",
                      "procedureCode",
                      "procedureDescription",
                      "payer",
                      "planName",
                      "planMatch",
                      "network",
                      "grossCharge",
                      "cashPrice",
                      "negotiatedAmount",
                      "setting",
                      "sourceUrl",
                      "lastUpdated",
                    ],
                  },
                },
                summary: { type: "string" },
              },
              required: ["hospitals", "summary"],
            },
          },
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      console.error("OpenAI Responses API error", payload);
      res.status(502).json({
        error: payload.error?.message || "The LLM pricing search failed.",
      });
      return;
    }

    const outputText =
      payload.output_text ||
      payload.output
        ?.flatMap((item) => item.content || [])
        ?.map((item) => item.text)
        ?.filter(Boolean)
        ?.join("\n");

    if (!outputText) {
      res.status(502).json({ error: "The search returned no structured result." });
      return;
    }

    let data;
    try {
      data = cleanJson(outputText);
    } catch {
      res.status(502).json({
        error: "The LLM returned invalid structured pricing data.",
      });
      return;
    }

    if (!Array.isArray(data.hospitals)) {
      res.status(502).json({
        error: "The LLM returned an unexpected pricing result.",
      });
      return;
    }

    const hospitals = data.hospitals.filter((hospital) => {
      if (
        !hospital ||
        typeof hospital.hospitalName !== "string" ||
        typeof hospital.location !== "string" ||
        typeof hospital.procedureCode !== "string" ||
        typeof hospital.procedureDescription !== "string" ||
        typeof hospital.payer !== "string" ||
        typeof hospital.planName !== "string" ||
        !["exact", "payer_only", "unclear"].includes(hospital.planMatch) ||
        !["in", "out", "unknown"].includes(hospital.network) ||
        typeof hospital.sourceUrl !== "string" ||
        !/^https?:\/\//i.test(hospital.sourceUrl) ||
        !["inpatient", "outpatient"].includes(hospital.setting)
      ) {
        return false;
      }

      if (cptCode && hospital.procedureCode !== cptCode) return false;
      if (hospital.grossCharge !== null &&
        (typeof hospital.grossCharge !== "number" ||
          !Number.isFinite(hospital.grossCharge) ||
          hospital.grossCharge < 0)) return false;
      if (hospital.cashPrice !== null &&
        (typeof hospital.cashPrice !== "number" ||
          !Number.isFinite(hospital.cashPrice) ||
          hospital.cashPrice < 0)) return false;
      if (hospital.negotiatedAmount !== null &&
        (typeof hospital.negotiatedAmount !== "number" ||
          !Number.isFinite(hospital.negotiatedAmount) ||
          hospital.negotiatedAmount < 0)) return false;
      return true;
    });

    res.json({
      hospitals,
      summary:
        typeof data.summary === "string"
          ? data.summary
          : "No reliable hospital pricing summary was returned.",
    });
  } catch (error) {
    console.error("Cost search failed", error);
    res.status(502).json({
      error: "Could not complete the hospital pricing search.",
    });
  }
});

const port = Number(process.env.API_PORT || 3001);
app.listen(port, () => {
  console.log(`Cost search API listening on http://localhost:${port}`);
});
