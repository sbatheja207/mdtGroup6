import type { PlanDetails } from "../plan";
import {
  BENEFIT_TEMPLATES,
  GENERIC_PPO,
  GEOS,
  PROCEDURES,
  SETTING_MULTIPLIER,
} from "./catalog";
import type {
  AllowedRange,
  BenefitMatchSource,
  CareSetting,
  CostEstimateResult,
  CostShareRule,
  EstimateRequest,
  GeoBucket,
  PlanBenefitTemplate,
  Procedure,
  ShareBreakdown,
} from "./types";

export { PROCEDURES, GEOS, SETTING_LABELS } from "./catalog";
export type { CareSetting, CostEstimate, CostEstimateResult } from "./types";

const roundMoney = (n: number) => Math.round(n * 100) / 100;

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function searchProcedures(query: string): Procedure[] {
  const q = norm(query);
  if (!q) return PROCEDURES;
  return PROCEDURES.filter((p) => {
    const hay = [p.displayName, p.cptCode, ...p.aliases].map(norm).join(" ");
    return hay.includes(q) || q.split(" ").every((part) => hay.includes(part));
  });
}

export function matchGeo(locationQuery: string): {
  geo: GeoBucket;
  assumed: boolean;
} {
  const q = norm(locationQuery);
  if (!q) {
    return { geo: GEOS.find((g) => g.id === "typical")!, assumed: true };
  }
  const zip = locationQuery.match(/\b(\d{5})\b/);
  if (zip) {
    const prefix = zip[1].slice(0, 3);
    const byZip = GEOS.find((g) => g.zipPrefixes.includes(prefix));
    if (byZip) return { geo: byZip, assumed: false };
  }
  const byAlias = GEOS.find((g) => g.aliases.some((a) => q.includes(a)));
  if (byAlias) return { geo: byAlias, assumed: false };
  return { geo: GEOS.find((g) => g.id === "typical")!, assumed: true };
}

const includesAny = (haystack: string, needles?: string[]) =>
  Boolean(needles?.some((n) => haystack.includes(n)));

export function resolveBenefits(details: PlanDetails): {
  benefits: PlanBenefitTemplate;
  source: BenefitMatchSource;
} {
  const insurer = norm(details.insurer);
  const planName = norm(details.planName);
  const planType = details.planType.trim().toUpperCase();

  const named = BENEFIT_TEMPLATES.find(
    (t) =>
      (t.insurerIncludes || t.planNameIncludes) &&
      (!t.insurerIncludes || includesAny(insurer, t.insurerIncludes)) &&
      (!t.planNameIncludes || includesAny(planName, t.planNameIncludes)) &&
      (!t.planTypes || !planType || t.planTypes.includes(planType)),
  );
  if (named) return { benefits: named, source: "named" };

  if (planType) {
    const byType = BENEFIT_TEMPLATES.find(
      (t) => !t.insurerIncludes && t.planTypes?.includes(planType),
    );
    if (byType) return { benefits: byType, source: "planType" };
  }
  return { benefits: GENERIC_PPO, source: "generic" };
}

export function allowedFor(
  procedure: Procedure,
  geo: GeoBucket,
  setting: CareSetting,
): AllowedRange {
  const factor =
    (geo.multiplier * SETTING_MULTIPLIER[setting]) /
    SETTING_MULTIPLIER[procedure.defaultSetting];
  const scale = (n: number) => roundMoney(n * factor);
  return {
    p25: scale(procedure.allowedTypical.p25),
    p50: scale(procedure.allowedTypical.p50),
    p75: scale(procedure.allowedTypical.p75),
  };
}

export function patientShare(
  allowed: number,
  remainingDeductible: number,
  remainingOop: number,
  rule: CostShareRule,
): ShareBreakdown {
  if (remainingOop <= 0) {
    return {
      allowed,
      appliedToDeductible: 0,
      copay: 0,
      coinsurance: 0,
      patientPay: 0,
    };
  }
  if (rule.kind === "free") {
    return {
      allowed,
      appliedToDeductible: 0,
      copay: 0,
      coinsurance: 0,
      patientPay: 0,
    };
  }

  let appliedToDeductible = 0;
  let copay = 0;
  let coinsurance = 0;

  if (rule.kind === "copay" && !rule.subjectToDeductible) {
    copay = rule.copay;
  } else {
    appliedToDeductible = rule.subjectToDeductible
      ? Math.min(allowed, Math.max(0, remainingDeductible))
      : 0;
    const afterDeductible = Math.max(0, allowed - appliedToDeductible);
    if (rule.kind === "copay") {
      if (afterDeductible > 0) copay = rule.copay;
    } else {
      coinsurance = afterDeductible * rule.coinsuranceRate;
    }
  }

  let patientPay = appliedToDeductible + copay + coinsurance;
  if (patientPay > remainingOop && patientPay > 0) {
    const scale = remainingOop / patientPay;
    appliedToDeductible *= scale;
    copay *= scale;
    coinsurance *= scale;
    patientPay = remainingOop;
  }

  return {
    allowed: roundMoney(allowed),
    appliedToDeductible: roundMoney(appliedToDeductible),
    copay: roundMoney(copay),
    coinsurance: roundMoney(coinsurance),
    patientPay: roundMoney(patientPay),
  };
}

function clampBenefit(value: number | undefined, max: number, fallback: number) {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(0, value), max);
}

export function estimateCost(request: EstimateRequest): CostEstimateResult {
  const procedure = PROCEDURES.find((p) => p.id === request.procedureId);
  if (!procedure) return { ok: false, error: "Choose a procedure from the list." };

  const setting = request.setting ?? procedure.defaultSetting;
  const { geo, assumed: geoAssumed } = matchGeo(request.locationQuery);
  const { benefits, source } = resolveBenefits(request.profile.details);
  const allowed = allowedFor(procedure, geo, setting);
  const rule = benefits.classes[procedure.serviceClass];

  const unknownRemainingDeductible = request.remainingDeductible === undefined;
  const unknownRemainingOop = request.remainingOop === undefined;

  const remainingOop = clampBenefit(
    request.remainingOop,
    benefits.annualOopMax,
    benefits.annualOopMax,
  );

  const remainingFor = (percentile: "low" | "mid" | "high") => {
    if (!unknownRemainingDeductible) {
      return clampBenefit(
        request.remainingDeductible,
        benefits.annualDeductible,
        benefits.annualDeductible,
      );
    }
    if (percentile === "low") return 0;
    if (percentile === "high") return benefits.annualDeductible;
    return roundMoney(benefits.annualDeductible / 2);
  };

  const low = patientShare(allowed.p25, remainingFor("low"), remainingOop, rule);
  const mid = patientShare(allowed.p50, remainingFor("mid"), remainingOop, rule);
  const high = patientShare(
    allowed.p75,
    remainingFor("high"),
    remainingOop,
    rule,
  );

  const assumptions: string[] = [
    "This is a seeded demo catalog, not a quote from your insurer.",
    "Care is assumed in-network. Out-of-network prices are not modeled.",
    `Benefit math uses the “${benefits.label}.” Coverage is not verified.`,
  ];
  if (geoAssumed) {
    assumptions.push(
      request.locationQuery.trim()
        ? `Location “${request.locationQuery.trim()}” was not in the demo map, so typical U.S. metro prices were used.`
        : "No location was entered, so typical U.S. metro prices were used.",
    );
  }
  if (unknownRemainingDeductible) {
    assumptions.push(
      `Remaining deductible was not entered. The range treats it as $0 (low), half of the $${benefits.annualDeductible} plan-year deductible (mid), and the full deductible (high).`,
    );
  } else {
    assumptions.push(
      `Remaining deductible is taken as $${remainingFor("mid")} of $${benefits.annualDeductible} plan-year deductible.`,
    );
  }
  if (unknownRemainingOop) {
    assumptions.push(
      `Remaining out-of-pocket maximum was not entered, so the full $${benefits.annualOopMax} plan-year maximum is assumed still available.`,
    );
  }
  if (source === "generic") {
    assumptions.push(
      "Your insurer/plan name did not match a named demo template, so a generic PPO table was used.",
    );
  } else if (source === "planType") {
    assumptions.push(
      `Matched a demo template from plan type ${request.profile.details.planType || "PPO"}, not from a named plan document.`,
    );
  }
  assumptions.push(
    "Facility fees, anesthesia, multiple same-day codes, prior authorization, and remaining deductible at claim time can all change the real bill.",
  );

  return {
    ok: true,
    procedure,
    geo,
    setting,
    inNetwork: true,
    allowed,
    patientPay: { low: low.patientPay, mid: mid.patientPay, high: high.patientPay },
    breakdown: mid,
    benefits,
    benefitSource: source,
    unknownRemainingDeductible,
    unknownRemainingOop,
    assumptions,
  };
}

export function parseOptionalMoney(raw: string): {
  value?: number;
  error?: string;
} {
  const trimmed = raw.trim().replace(/^[\$]/, "").replace(/,/g, "");
  if (!trimmed) return {};
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return { error: "Enter a dollar amount of 0 or more, or leave the field blank." };
  }
  return { value: roundMoney(n) };
}
