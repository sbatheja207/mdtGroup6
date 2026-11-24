import { describe, expect, it } from "vitest";
import { demoDetails, type PlanProfile } from "../plan";
import { GENERIC_PPO } from "./catalog";
import {
  allowedFor,
  estimateCost,
  matchGeo,
  parseOptionalMoney,
  patientShare,
  resolveBenefits,
  searchProcedures,
  parseOptionalPercent,
} from "./estimate";

const profile = (details = demoDetails): PlanProfile => ({
  schemaVersion: 1,
  id: "demo",
  updatedAt: "2026-01-01T00:00:00.000Z",
  details,
  documents: [],
  reviewed: true,
  coverageVerified: false,
});

describe("searchProcedures", () => {
  it("matches aliases and CPT codes", () => {
    expect(searchProcedures("knee mri")[0]?.id).toBe("mri-knee");
    expect(searchProcedures("73721")[0]?.id).toBe("mri-knee");
  });
});

describe("matchGeo", () => {
  it("maps ZIP prefixes and city aliases", () => {
    expect(matchGeo("10001").geo.id).toBe("large-metro");
    expect(matchGeo("Pittsburgh, PA").geo.id).toBe("typical");
    expect(matchGeo("rural Montana").geo.id).toBe("lower-cost");
  });
  it("assumes typical metro when location is empty or unknown", () => {
    expect(matchGeo("").assumed).toBe(true);
    expect(matchGeo("Narnia").geo.id).toBe("typical");
  });
});

describe("resolveBenefits", () => {
  it("uses the Campus Care Plus demo template for the sample plan", () => {
    const { benefits, source } = resolveBenefits(demoDetails);
    expect(source).toBe("named");
    expect(benefits.id).toBe("campus-care-plus");
    expect(benefits.annualDeductible).toBe(1500);
  });
  it("falls back from plan type, then to generic PPO", () => {
    expect(
      resolveBenefits({ ...demoDetails, insurer: "Other", planName: "", planType: "HDHP" })
        .benefits.id,
    ).toBe("generic-hdhp");
    expect(
      resolveBenefits({ ...demoDetails, insurer: "Other", planName: "", planType: "" })
        .benefits.id,
    ).toBe("generic-ppo");
  });
});

describe("patientShare", () => {
  const coinsurance = {
    kind: "coinsurance" as const,
    coinsuranceRate: 0.2,
    subjectToDeductible: true,
  };
  const copay = {
    kind: "copay" as const,
    copay: 30,
    subjectToDeductible: false,
  };

  it("applies the full allowed amount toward an unmet deductible, then coinsurance", () => {
    const share = patientShare(1000, 1500, 6000, coinsurance);
    expect(share.appliedToDeductible).toBe(1000);
    expect(share.coinsurance).toBe(0);
    expect(share.patientPay).toBe(1000);
  });

  it("charges only coinsurance after the deductible is met", () => {
    const share = patientShare(1000, 0, 6000, coinsurance);
    expect(share.appliedToDeductible).toBe(0);
    expect(share.coinsurance).toBe(200);
    expect(share.patientPay).toBe(200);
  });

  it("caps patient pay at the remaining out-of-pocket maximum", () => {
    const share = patientShare(4000, 0, 50, coinsurance);
    expect(share.patientPay).toBe(50);
    expect(
      share.appliedToDeductible + share.copay + share.coinsurance,
    ).toBeCloseTo(50);
  });

  it("uses a flat copay and ignores remaining deductible for office visits", () => {
    const share = patientShare(128, 1500, 6000, copay);
    expect(share.patientPay).toBe(30);
    expect(share.appliedToDeductible).toBe(0);
  });

  it("charges an emergency copay only after the deductible is satisfied", () => {
    const ed = {
      kind: "copay" as const,
      copay: 150,
      subjectToDeductible: true,
    };
    expect(patientShare(400, 1500, 6000, ed).patientPay).toBe(400);
    expect(patientShare(1280, 0, 6000, ed).patientPay).toBe(150);
  });

  it("combines deductible, coinsurance, and copay", () => {
    const combined = {
      kind: "copayAndCoinsurance" as const,
      copay: 50,
      coinsuranceRate: 0.2,
      subjectToDeductible: true,
    };
    expect(patientShare(1000, 500, 6000, combined)).toEqual({
      allowed: 1000,
      appliedToDeductible: 500,
      copay: 50,
      coinsurance: 100,
      patientPay: 650,
    });
  });
});

describe("estimateCost", () => {
  it("returns an error for an unknown procedure", () => {
    expect(
      estimateCost({
        profile: profile(),
        procedureId: "nope",
        locationQuery: "Pittsburgh",
      }),
    ).toEqual({ ok: false, error: "Choose a procedure from the list." });
  });

  it("widens the range when remaining deductible is unknown", () => {
    const unknown = estimateCost({
      profile: profile(),
      procedureId: "mri-knee",
      locationQuery: "Pittsburgh",
    });
    const known = estimateCost({
      profile: profile(),
      procedureId: "mri-knee",
      locationQuery: "Pittsburgh",
      remainingDeductible: 0,
    });
    if (!unknown.ok || !known.ok) throw new Error("expected estimates");
    expect(unknown.unknownRemainingDeductible).toBe(true);
    expect(unknown.patientPay.low).toBeLessThan(unknown.patientPay.high);
    expect(unknown.patientPay.high - unknown.patientPay.low).toBeGreaterThan(
      known.patientPay.high - known.patientPay.low,
    );
    expect(known.patientPay.mid).toBeLessThan(unknown.patientPay.high);
  });

  it("uses entered remaining deductible and OOP instead of plan-year defaults", () => {
    const result = estimateCost({
      profile: profile(),
      procedureId: "mri-knee",
      locationQuery: "Pittsburgh",
      remainingDeductible: 0,
      remainingOop: 40,
    });
    if (!result.ok) throw new Error("expected estimate");
    expect(result.unknownRemainingDeductible).toBe(false);
    expect(result.patientPay.low).toBe(40);
    expect(result.patientPay.mid).toBe(40);
    expect(result.patientPay.high).toBe(40);
  });

  it("prices preventive care at $0 for the demo PPO template", () => {
    const result = estimateCost({
      profile: profile(),
      procedureId: "preventive-physical",
      locationQuery: "15213",
    });
    if (!result.ok) throw new Error("expected estimate");
    expect(result.patientPay).toEqual({ low: 0, mid: 0, high: 0 });
  });

  it("scales allowed amounts by geography", () => {
    const typical = allowedFor(
      searchProcedures("mri knee")[0],
      matchGeo("Pittsburgh").geo,
      "imagingCenter",
    );
    const metro = allowedFor(
      searchProcedures("mri knee")[0],
      matchGeo("NYC").geo,
      "imagingCenter",
    );
    expect(metro.p50).toBeGreaterThan(typical.p50);
  });

  it("uses user-entered annual benefit overrides", () => {
    const result = estimateCost({
      profile: profile(),
      procedureId: "mri-knee",
      locationQuery: "Pittsburgh",
      remainingDeductible: 0,
      remainingOop: 500,
      benefitOverrides: {
        annualDeductible: 1000,
        annualOopMax: 500,
        coinsuranceRate: 0.3,
      },
    });
    if (!result.ok) throw new Error("expected estimate");
    expect(result.benefits.annualDeductible).toBe(1000);
    expect(result.benefits.annualOopMax).toBe(500);
    expect(result.patientPay.low).toBe(114);
  });
});

describe("parseOptionalMoney", () => {
  it("treats blank as omitted and rejects negatives", () => {
    expect(parseOptionalMoney("")).toEqual({});
    expect(parseOptionalMoney("$1,200.50").value).toBe(1200.5);
    expect(parseOptionalMoney("-4").error).toBeTruthy();
  });
});

describe("parseOptionalPercent", () => {
  it("parses percentages and rejects values outside 0–100", () => {
    expect(parseOptionalPercent("")).toEqual({});
    expect(parseOptionalPercent("20%").value).toBe(0.2);
    expect(parseOptionalPercent("101").error).toBeTruthy();
  });
});

describe("generic fallback", () => {
  it("keeps a generic PPO table for unmatched plans", () => {
    expect(GENERIC_PPO.classes.officeVisit.kind).toBe("copay");
  });
});
