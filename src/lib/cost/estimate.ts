import { PROCEDURES } from "./catalog";
import type { PatientBenefits, PatientShare, Procedure } from "./types";

export { PROCEDURES } from "./catalog";
export type { PatientBenefits, PatientShare, Procedure } from "./types";

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function searchProcedures(query: string): Procedure[] {
  const q = norm(query);
  if (!q) return PROCEDURES;
  return PROCEDURES.filter((procedure) => {
    const haystack = [
      procedure.displayName,
      procedure.cptCode,
      ...procedure.aliases,
    ]
      .map(norm)
      .join(" ");
    return (
      haystack.includes(q) ||
      q.split(" ").every((part) => haystack.includes(part))
    );
  });
}

export function estimatePatientShare(
  negotiatedAmount: number,
  benefits: PatientBenefits,
): PatientShare {
  const deductible = Math.min(
    negotiatedAmount,
    benefits.remainingDeductible,
    benefits.remainingOop,
  );
  const afterDeductible = Math.max(0, negotiatedAmount - deductible);
  const remainingOopAfterDeductible = Math.max(
    0,
    benefits.remainingOop - deductible,
  );
  const copay =
    afterDeductible > 0
      ? Math.min(benefits.copay, remainingOopAfterDeductible)
      : 0;
  const coinsurance = Math.min(
    afterDeductible * benefits.coinsuranceRate,
    Math.max(0, remainingOopAfterDeductible - copay),
  );

  return {
    negotiatedAmount: roundMoney(negotiatedAmount),
    deductible: roundMoney(deductible),
    copay: roundMoney(copay),
    coinsurance: roundMoney(coinsurance),
    patientPay: roundMoney(deductible + copay + coinsurance),
  };
}

export function parseOptionalMoney(raw: string): {
  value?: number;
  error?: string;
} {
  const trimmed = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!trimmed) return {};
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    return {
      error: "Enter a dollar amount of 0 or more, or leave the field blank.",
    };
  }
  return { value: roundMoney(value) };
}

export function parseOptionalPercent(raw: string): {
  value?: number;
  error?: string;
} {
  const trimmed = raw.trim().replace(/%$/, "");
  if (!trimmed) return {};
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return {
      error:
        "Enter a coinsurance percentage from 0 to 100, or leave the field blank.",
    };
  }
  return { value: roundMoney(value / 100) };
}
