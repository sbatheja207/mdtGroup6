import type { PlanDocument } from "./plan";

export const benefitFields = [
  {
    key: "annualDeductible",
    label: "Annual medical deductible",
    unit: "$",
    help: "Your total deductible for the selected scope and network this plan year.",
  },
  {
    key: "remainingDeductible",
    label: "Deductible remaining",
    unit: "$",
    help: "The amount still unpaid, from your current insurer portal. Do not enter the amount already met.",
  },
  {
    key: "annualOopMax",
    label: "Annual out-of-pocket maximum",
    unit: "$",
    help: "The annual limit for covered care in the selected network.",
  },
  {
    key: "remainingOop",
    label: "Out-of-pocket amount remaining",
    unit: "$",
    help: "How much more counts toward your maximum. This is not the amount already spent.",
  },
  {
    key: "coinsuranceRate",
    label: "Your medical coinsurance",
    unit: "%",
    help: "The percentage YOU pay after the deductible, not the percentage the insurer pays. Service-specific rules can differ.",
  },
  {
    key: "primaryCopay",
    label: "Primary care visit copay",
    unit: "$",
    help: "Enter 0 only if the plan explicitly says no copay. Coinsurance-only or unclear? Choose unknown and describe the rule below.",
  },
  {
    key: "specialistCopay",
    label: "Specialist visit copay",
    unit: "$",
    help: "Check the specialist office visit benefit in your plan summary.",
  },
  {
    key: "emergencyCopay",
    label: "Emergency room copay",
    unit: "$",
    help: "Check whether this is waived if admitted. Describe exceptions below.",
  },
] as const;
export type BenefitKey = (typeof benefitFields)[number]["key"];
export type BenefitValue = {
  value: string;
  unknown: boolean;
  source?: { documentId: string; name: string; quote: string };
  conflicts?: string[];
};
export type PlanBenefits = {
  version: 1;
  scope: "" | "individual" | "family";
  network: "" | "in" | "out";
  periodStart: string;
  periodEnd: string;
  balancesAsOf: string;
  values: Record<BenefitKey, BenefitValue>;
  notes: string;
  reviewed: boolean;
};
export function emptyBenefits(): PlanBenefits {
  return {
    version: 1,
    scope: "",
    network: "",
    periodStart: "",
    periodEnd: "",
    balancesAsOf: "",
    values: Object.fromEntries(
      benefitFields.map((f) => [f.key, { value: "", unknown: false }]),
    ) as PlanBenefits["values"],
    notes: "",
    reviewed: false,
  };
}
const matchers: Record<BenefitKey, RegExp> = {
  annualDeductible:
    /(?:annual (?:medical )?deductible|(?:medical )?deductible)(?!\s*(?:remaining|met|paid))/i,
  remainingDeductible:
    /(?:deductible remaining|remaining (?:medical )?deductible)/i,
  annualOopMax: /(?:annual )?out[- ]of[- ]pocket (?:maximum|max|limit)/i,
  remainingOop:
    /(?:out[- ]of[- ]pocket (?:amount )?remaining|remaining out[- ]of[- ]pocket)/i,
  coinsuranceRate: /(?:your|member|patient) (?:medical )?coinsurance/i,
  primaryCopay: /(?:primary care|pcp)(?: (?:office )?visit)? copay/i,
  specialistCopay: /specialist(?: (?:office )?visit)? copay/i,
  emergencyCopay: /(?:emergency room|er)(?: visit)? copay/i,
};
// Only accept unambiguous labeled amounts with explicit matching scope/network.
// Tables, mixed networks, ranges and multiple contradictory values fall back to questions.
export function extractBenefits(
  documents: PlanDocument[],
  current: PlanBenefits,
): PlanBenefits {
  const next = structuredClone(current);
  if (!current.scope || !current.network) return next;
  for (const field of benefitFields) {
    const existing = current.values[field.key];
    if ((existing.value && !existing.source) || existing.unknown) continue;
    next.values[field.key] = { value: "", unknown: false };
    const hits: {
      value: string;
      source: NonNullable<BenefitValue["source"]>;
    }[] = [];
    for (const doc of documents) {
      const lines = doc.text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!matchers[field.key].test(line)) continue;
        if (
          field.key === "annualDeductible" &&
          /remaining|\bmet\b|paid|prescription|drug|dental/i.test(line)
        )
          continue;
        if (
          field.key === "annualOopMax" &&
          /remaining|\bmet\b|paid|prescription|drug/i.test(line)
        )
          continue;
        if (/\b(?:example|illustration|not covered|unlimited)\b/i.test(line))
          continue;
        const context = line;
        const scope =
          /\bindividual\b/i.test(context) && !/\bfamily\b/i.test(context)
            ? "individual"
            : /\bfamily\b/i.test(context) && !/\bindividual\b/i.test(context)
              ? "family"
              : "";
        const network =
          /\bout[- ]of[- ]network\b/i.test(context) &&
          !/\bin[- ]network\b/i.test(context)
            ? "out"
            : /\bin[- ]network\b/i.test(context) &&
                !/\bout[- ]of[- ]network\b/i.test(context)
              ? "in"
              : "";
        if (scope !== current.scope || network !== current.network) continue;
        // Sparse OCR often puts the amount on the following line.
        const valueLine = /[$%]/.test(line)
          ? line
          : `${line} ${lines[i + 1] ?? ""}`;
        const amounts =
          field.unit === "%"
            ? [...valueLine.matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
            : [
                ...valueLine.matchAll(
                  /\$\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d.])/g,
                ),
              ];
        if (
          /[-–]\s*\$/.test(valueLine) ||
          amounts.length !== 1 ||
          /\$[^\n]*(?:\bto\b|[–—]|\s-\s)\s*\$?\d/.test(valueLine)
        )
          continue;
        const value = amounts[0][1].replace(/,/g, "");
        if (field.unit === "%" && Number(value) > 100) continue;
        hits.push({
          value,
          source: { documentId: doc.id, name: doc.name, quote: valueLine },
        });
      }
    }
    const distinct = [...new Set(hits.map((h) => Number(h.value)))];
    if (distinct.length === 1)
      next.values[field.key] = { ...hits[0], unknown: false };
    else if (distinct.length > 1)
      next.values[field.key] = {
        value: "",
        unknown: false,
        conflicts: hits.map((h) => `${h.source.name}: ${h.source.quote}`),
      };
  }
  next.reviewed = false;
  return next;
}
export function validateBenefits(b: PlanBenefits): string | null {
  if (!b.scope || !b.network)
    return "Choose whose benefits these are and the network before continuing.";
  if (!b.periodStart || !b.periodEnd || !b.balancesAsOf)
    return "Enter the benefit period and the date your remaining balances were checked.";
  if (b.periodStart > b.periodEnd)
    return "The benefit period must end on or after it starts.";
  if (b.balancesAsOf < b.periodStart || b.balancesAsOf > b.periodEnd)
    return "The balance date must fall within this benefit period.";
  for (const f of benefitFields) {
    const v = b.values[f.key];
    if (v.unknown) continue;
    if (!v.value.trim())
      return `Enter ${f.label.toLowerCase()} or explicitly choose “I don’t know”.`;
    if (
      !/^\d+(?:\.\d{1,2})?$/.test(v.value) ||
      !Number.isFinite(Number(v.value))
    )
      return `${f.label} must be a nonnegative number with up to two decimal places.`;
    if (f.unit === "%" && Number(v.value) > 100)
      return "Your coinsurance must be between 0 and 100%.";
  }
  for (const [remaining, total] of [
    ["remainingDeductible", "annualDeductible"],
    ["remainingOop", "annualOopMax"],
  ] as const) {
    if (
      !b.values[remaining].unknown &&
      !b.values[total].unknown &&
      Number(b.values[remaining].value) > Number(b.values[total].value)
    )
      return `${benefitFields.find((f) => f.key === remaining)!.label} cannot exceed the annual total.`;
  }
  if (!b.reviewed)
    return "Confirm that these benefits match your plan and that you reviewed the values.";
  return null;
}
export function missingBenefits(b?: PlanBenefits): string[] {
  if (!b) return ["Benefits have not been collected"];
  const problems = benefitFields
    .filter((f) => b.values[f.key].unknown || b.values[f.key].value === "")
    .map((f) => f.label as string);
  const validation = validateBenefits(b);
  if (validation && !problems.includes(validation)) problems.push(validation);
  return problems;
}
// Adapter for the cost-estimation branch. Rates are fractions there (20% -> .2).
// Does not select service rules, assume network eligibility, or invent missing values.
export function getEstimateInputs(b?: PlanBenefits) {
  const missing = missingBenefits(b);
  if (!b || missing.length) return { ready: false as const, missing };
  if (b.scope !== "individual" || b.network !== "in")
    return {
      ready: false as const,
      missing: [
        "The current estimator requires individual in-network benefits; family aggregation/out-of-network rules need a separate calculation.",
      ],
    };
  return {
    ready: true as const,
    remainingDeductible: Number(b.values.remainingDeductible.value),
    remainingOop: Number(b.values.remainingOop.value),
    benefitOverrides: {
      annualDeductible: Number(b.values.annualDeductible.value),
      annualOopMax: Number(b.values.annualOopMax.value),
      coinsuranceRate: Number(b.values.coinsuranceRate.value) / 100,
    },
    copays: {
      primary: Number(b.values.primaryCopay.value),
      specialist: Number(b.values.specialistCopay.value),
      emergency: Number(b.values.emergencyCopay.value),
    },
    balancesAsOf: b.balancesAsOf,
    periodStart: b.periodStart,
    periodEnd: b.periodEnd,
    notes: b.notes,
  };
}
export const demoBenefitText = `FICTIONAL BENEFITS — FOR SOFTWARE TESTING ONLY
Individual in-network annual medical deductible: $1,500
Individual in-network deductible remaining: $600
Individual in-network annual out-of-pocket maximum: $5,000
Individual in-network out-of-pocket amount remaining: $3,000
Individual in-network your medical coinsurance: 20%
Individual in-network primary care visit copay: $25
Individual in-network specialist visit copay: $50
Individual in-network emergency room copay: $200`;
