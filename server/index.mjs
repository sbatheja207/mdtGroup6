import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PAYERPRICE_API_KEY = process.env.PAYERPRICE_API_KEY;
const PAYERPRICE_API_URL = "https://api.payerprice.com";
const MAX_HOSPITALS = 10;

const supportedPayers = [
  "BCBS",
  "United",
  "Aetna",
  "Cigna",
  "FirstHealth",
  "BannerHealth",
  "MeritainHealth",
  "Centene",
  "Fidelis",
  "Ambetter",
  "QualChoice",
  "HealthNet",
  "ManagedHealthNetwork",
  "WellCare",
  "DeanHealthPlan",
  "Prevea360",
  "TripleSSalud",
  "AlliantHealthPlans",
  "AmeriHealth",
  "AveraHealthPlans",
  "BaylorScottWhiteHealthPlan",
  "CareSource",
  "CommunityCareOklahoma",
  "PriorityHealth",
  "TuftsHealthPlan",
  "MVPHealthCare",
  "HarvardPilgrimHealthCare",
  "HealthAlliance",
  "HealthAllianceHAP",
  "HealthFirst",
  "HealthLink",
  "HealthNewEngland",
  "HealthPartners",
  "HealthSmart",
  "HometownHealth",
  "IndependentHealthAssociation",
  "InterWestHealth",
  "JohnsHopkinsHealthPlans",
  "KaiserPermanente",
  "LyraHealth",
  "LuminareHealth",
  "MagnaCare",
  "MassGeneralBrigham",
  "Medica",
  "MedicalMutual",
  "MidlandsChoice",
  "ModaHealth",
  "Molina",
  "MultiPlan",
  "NeighborhoodHealthPlanOfRhodeIsland",
  "OSUHealthPlan",
  "OptimaHealth",
  "Oscar",
  "PacificSource",
  "PhysiciansHealthPlan",
  "PresbyterianHealthPlan",
  "ProvidenceHealthPlan",
  "Quartz",
  "SanfordHealthPlan",
  "SelectHealth",
  "TexasChildrensHealthPlan",
  "TheAlliance",
  "TrilogyHealthSolutions",
  "UCare",
  "UHAHealthInsurance",
  "UPMCHealthPlan",
];

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function resolvePayer(value) {
  const normalized = normalize(value);
  if (
    normalized.includes("bluecross") &&
    normalized.includes("blueshield")
  ) {
    return "BCBS";
  }
  if (
    normalized === "uhc" ||
    normalized === "unitedhealthcare" ||
    normalized === "unitedhealthcareinsurance"
  ) {
    return "United";
  }
  return supportedPayers.find((payer) => normalize(payer) === normalized);
}

async function payerPriceRequest(path, body) {
  const response = await fetch(`${PAYERPRICE_API_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYERPRICE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("PayerPrice returned an unreadable response.");
  }

  if (!response.ok) {
    const messages = {
      401: "PayerPrice rejected the API key. Check PAYERPRICE_API_KEY.",
      402: "PayerPrice API credit is insufficient.",
      403: "Your PayerPrice organization does not have access to this endpoint.",
      429: "PayerPrice rate limit reached. Wait before searching again.",
    };
    const message =
      messages[response.status] ||
      (typeof payload?.error === "string" ? payload.error : null) ||
      "PayerPrice could not complete the pricing search.";
    throw new Error(message);
  }
  return payload;
}

function amountOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function toHospitalResult(rate, facility, requestedPayer, requestedPlan) {
  const plans = Array.isArray(rate.plan)
    ? rate.plan.filter((plan) => typeof plan === "string")
    : [];
  const reportedPayer =
    typeof rate.payer === "string" ? rate.payer : requestedPayer;
  const samePayer = normalize(reportedPayer) === normalize(requestedPayer);
  const exactPlan =
    samePayer &&
    requestedPlan.trim() !== "" &&
    plans.some((plan) => normalize(plan) === normalize(requestedPlan));
  const setting = ["inpatient", "outpatient", "both"].includes(rate.setting)
    ? rate.setting
    : "unknown";

  return {
    hospitalId: [
      rate.ccn,
      rate.billingCode,
      reportedPayer,
      plans.join(","),
      rate.year,
      rate.month,
      rate.setting || "",
      rate.billingClass || "",
      rate.methodology || "",
    ].join("-"),
    hospitalName:
      typeof rate.hospitalName === "string" && rate.hospitalName
        ? rate.hospitalName
        : facility.name,
    location: [facility.city, facility.state].filter(Boolean).join(", "),
    procedureCode: rate.billingCode,
    procedureDescription:
      typeof rate.description === "string" && rate.description
        ? rate.description
        : rate.billingCode,
    payer: reportedPayer,
    planName: plans.length ? plans.join(", ") : "Plan not listed",
    planMatch: exactPlan ? "exact" : samePayer ? "payer_only" : "unclear",
    network: "unknown",
    grossCharge: amountOrNull(rate.standardChargeGross),
    cashPrice: amountOrNull(rate.standardChargeDiscountedCash),
    negotiatedAmount: amountOrNull(rate.negotiatedDollar),
    setting,
    sourceUrl: null,
    filePeriod:
      Number.isInteger(rate.year) && Number.isInteger(rate.month)
        ? `${rate.year}-${String(rate.month).padStart(2, "0")}`
        : null,
  };
}

app.post("/api/cost-search", async (req, res) => {
  if (!PAYERPRICE_API_KEY) {
    res.status(503).json({
      error:
        "PayerPrice search is not configured. Set PAYERPRICE_API_KEY on the server.",
    });
    return;
  }

  const { procedureName, cptCode, location, payer, planName = "" } =
    req.body ?? {};

  if (!procedureName || !cptCode || !location || !payer) {
    res.status(400).json({
      error: "Procedure, CPT code, location, and insurer are required.",
    });
    return;
  }
  if (/^\d{5}$/.test(String(location).trim())) {
    res.status(400).json({
      error:
        "PayerPrice facility search supports city names, not ZIP codes. Enter a city or city and state.",
    });
    return;
  }

  const payerId = resolvePayer(String(payer));
  if (!payerId) {
    res.status(400).json({
      error: `PayerPrice does not list a supported payer matching "${payer}".`,
    });
    return;
  }

  try {
    const locationParts = String(location)
      .trim()
      .match(/^(.*?),\s*([A-Za-z]{2})$/);
    const cityOrSearch = locationParts ? locationParts[1].trim() : String(location).trim();
    if (!cityOrSearch) {
      res.status(400).json({ error: "Enter a city name to search." });
      return;
    }
    const facilitySearch = await payerPriceRequest("/api/v1/ccnSearch", {
      searchTerms: [cityOrSearch.slice(0, 40)],
      facilityTypes: ["HOSPITAL"],
      ...(locationParts ? { states: [locationParts[2].toUpperCase()] } : {}),
      limit: MAX_HOSPITALS,
    });

    if (!Array.isArray(facilitySearch)) {
      throw new Error("PayerPrice returned an invalid facility search result.");
    }

    const facilities = facilitySearch
      .filter(
        (facility) =>
          facility &&
          typeof facility.ccn === "string" &&
          typeof facility.name === "string" &&
          typeof facility.city === "string" &&
          typeof facility.state === "string",
      )
      .filter(
        (facility, index, list) =>
          list.findIndex((entry) => entry.ccn === facility.ccn) === index,
      )
      .slice(0, MAX_HOSPITALS);

    const rateResults = [];
    for (let index = 0; index < facilities.length; index += 2) {
      const batch = facilities.slice(index, index + 2);
      const rates = await payerPriceRequest(
        "/api/v1/hospital/provider/rates",
        {
          providers: { ccns: batch.map((facility) => facility.ccn) },
          payers: [payerId],
          billingCodeAndTypes: [{ code: String(cptCode), type: "CPT" }],
          limit: 1000,
        },
      );
      if (!rates || !Array.isArray(rates.data)) {
        throw new Error("PayerPrice returned invalid hospital rate data.");
      }
      for (const rate of rates.data) {
        if (
          !rate ||
          typeof rate !== "object" ||
          typeof rate.ccn !== "string" ||
          typeof rate.billingCode !== "string"
        ) {
          throw new Error("PayerPrice returned an invalid hospital rate record.");
        }
        const facility = batch.find((entry) => entry.ccn === rate.ccn);
        if (
          facility &&
          rate.billingCode === String(cptCode) &&
          rate.billingCodeType === "CPT"
        ) {
          rateResults.push(
            toHospitalResult(rate, facility, payerId, String(planName)),
          );
        }
      }
    }

    const diagnostics = {
      facilitiesFound: facilities.length,
      rateRecordsFound: rateResults.length,
      facilityLimit: MAX_HOSPITALS,
    };
    console.info("PayerPrice search diagnostics", diagnostics);

    res.json({
      hospitals: rateResults,
      diagnostics,
      summary: facilities.length
        ? rateResults.length
          ? "Pricing data is from PayerPrice hospital-published price transparency files. Exact plan and network status are shown only when supported by the returned data."
          : `PayerPrice found ${facilities.length} hospitals near the requested location, but no rate records for this payer and CPT code.`
        : "PayerPrice found no hospitals matching the requested location.",
    });
  } catch (error) {
    console.error("PayerPrice cost search failed", error);
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Could not complete the PayerPrice hospital search.",
    });
  }
});

const port = Number(process.env.API_PORT || 3001);
app.listen(port, () => {
  console.log(`Cost search API listening on http://localhost:${port}`);
});
