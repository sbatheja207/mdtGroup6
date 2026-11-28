import { describe, it, expect } from "vitest";
import {
  benefitFields,
  emptyBenefits,
  extractBenefits,
  validateBenefits,
  missingBenefits,
  getEstimateInputs,
  demoBenefitText,
} from "./benefits";
import type { PlanDocument } from "./plan";
const doc = (text: string, id = "one"): PlanDocument => ({
  id,
  name: `${id}.pdf`,
  kind: "plan",
  mime: "application/pdf",
  size: text.length,
  blob: new Blob([text]),
  text,
  status: "ready",
});
function complete() {
  const b = emptyBenefits();
  b.scope = "individual";
  b.network = "in";
  b.periodStart = "2026-01-01";
  b.periodEnd = "2026-12-31";
  b.balancesAsOf = "2026-11-24";
  const result = extractBenefits([doc(demoBenefitText)], b);
  result.reviewed = true;
  return result;
}
describe("benefit discovery and required follow-up", () => {
  it("extracts labeled amounts with matching scope/network and stores source evidence", () => {
    const b = complete();
    expect(b.values.annualDeductible.value).toBe("1500");
    expect(b.values.remainingDeductible.value).toBe("600");
    expect(b.values.coinsuranceRate.value).toBe("20");
    expect(b.values.annualDeductible.source?.documentId).toBe("one");
    expect(validateBenefits(b)).toBeNull();
  });
  it("requires an answer when a card has no deductible", () => {
    const b = complete();
    b.values.annualDeductible = { value: "", unknown: false };
    expect(validateBenefits(b)).toContain("annual medical deductible");
    expect(getEstimateInputs(b).ready).toBe(false);
  });
  it("does not invent benefits from an insurer name or member ID", () => {
    const b = emptyBenefits();
    b.scope = "individual";
    b.network = "in";
    expect(
      extractBenefits([doc("Aetna\nID W123456789")], b).values.annualDeductible
        .value,
    ).toBe("");
  });
  it("accepts explicit unknowns for storage but blocks estimate readiness", () => {
    const b = complete();
    b.values.remainingDeductible = { value: "", unknown: true };
    expect(validateBenefits(b)).toBeNull();
    expect(getEstimateInputs(b).ready).toBe(false);
    expect(missingBenefits(b)).toContain("Deductible remaining");
  });
  it("keeps zero separate from unknown and converts percent for the estimator", () => {
    const b = complete();
    b.values.remainingDeductible = { value: "0", unknown: false };
    const result = getEstimateInputs(b);
    expect(result.ready).toBe(true);
    if (result.ready) {
      expect(result.remainingDeductible).toBe(0);
      expect(result.benefitOverrides.coinsuranceRate).toBe(0.2);
    }
  });
  it("allows reviewed individual out-of-network benefits for an illustrative estimate", () => {
    const b = complete();
    b.network = "out";
    const result = getEstimateInputs(b);
    expect(result.ready).toBe(true);
    if (result.ready) expect(result.network).toBe("out");
  });
  it("still blocks family benefits from the individual estimator", () => {
    const b = complete();
    b.scope = "family";
    const result = getEstimateInputs(b);
    expect(result.ready).toBe(false);
    if (!result.ready)
      expect(result.missing[0]).toContain("requires individual benefits");
  });
  it("does not mix in-network, out-of-network, individual or family limits", () => {
    const b = emptyBenefits();
    b.scope = "individual";
    b.network = "in";
    const result = extractBenefits(
      [
        doc(
          "Family in-network annual deductible: $3000\nIndividual out-of-network annual deductible: $9000\nIndividual in-network annual deductible: $1500",
        ),
      ],
      b,
    );
    expect(result.values.annualDeductible.value).toBe("1500");
  });
  it("falls back to questions for mixed tables, ranges and unlabeled scope", () => {
    const b = emptyBenefits();
    b.scope = "individual";
    b.network = "in";
    for (const text of [
      "Annual deductible: $500",
      "Individual / family in-network deductible: $500 / $1000",
      "Individual in-network deductible: $500 to $900",
      "Individual in-network deductible: -$500",
    ])
      expect(
        extractBenefits([doc(text)], b).values.annualDeductible.value,
      ).toBe("");
  });
  it("marks conflicts, including a document added after an earlier extraction", () => {
    const b = complete();
    const result = extractBenefits(
      [
        doc(demoBenefitText),
        doc("Individual in-network annual deductible: $4000", "two"),
      ],
      b,
    );
    expect(result.values.annualDeductible.value).toBe("");
    expect(result.values.annualDeductible.conflicts).toHaveLength(2);
  });
  it("preserves a manual correction", () => {
    const b = complete();
    b.values.annualDeductible = { value: "2000", unknown: false };
    expect(
      extractBenefits([doc(demoBenefitText)], b).values.annualDeductible.value,
    ).toBe("2000");
  });
  it("rejects negative values, percentages over 100, invalid dates and balances over totals", () => {
    const b = complete();
    b.values.coinsuranceRate.value = "101";
    expect(validateBenefits(b)).toContain("100");
    b.values.coinsuranceRate.value = "-1";
    expect(validateBenefits(b)).toContain("nonnegative");
    b.values.coinsuranceRate.value = "20";
    b.values.remainingDeductible.value = "9999";
    expect(validateBenefits(b)).toContain("exceed");
    b.values.remainingDeductible.value = "0";
    b.balancesAsOf = "2027-01-01";
    expect(validateBenefits(b)).toContain("period");
  });
  it("requires review and recognizes legacy profiles as incomplete", () => {
    const b = complete();
    b.reviewed = false;
    expect(validateBenefits(b)).toContain("Confirm");
    expect(getEstimateInputs(undefined).ready).toBe(false);
  });
  it("clears source-derived values when the source disappears", () => {
    const b = complete();
    const result = extractBenefits([], b);
    expect(benefitFields.every((f) => result.values[f.key].value === "")).toBe(
      true,
    );
  });
});
