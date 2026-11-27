import { describe, expect, it } from "vitest";
import {
  estimatePatientShare,
  parseOptionalMoney,
  parseOptionalPercent,
  searchProcedures,
} from "./estimate";

describe("searchProcedures", () => {
  it("matches aliases and CPT codes without returning any prices", () => {
    expect(searchProcedures("knee mri")[0]).toMatchObject({
      id: "mri-knee",
      cptCode: "73721",
    });
    expect(searchProcedures("73721")[0]?.id).toBe("mri-knee");
    expect(searchProcedures("knee mri")[0]).not.toHaveProperty("allowedTypical");
  });

  it("only identifies copay categories for procedures with matching saved benefits", () => {
    expect(searchProcedures("established office visit")[0]?.copayCategory).toBe(
      "primary",
    );
    expect(searchProcedures("emergency department")[0]?.copayCategory).toBe(
      "emergency",
    );
    expect(searchProcedures("knee MRI")[0]?.copayCategory).toBeUndefined();
  });
});

describe("estimatePatientShare", () => {
  it("calculates patient responsibility from a sourced negotiated amount", () => {
    expect(
      estimatePatientShare(1000, {
        remainingDeductible: 500,
        remainingOop: 6000,
        copay: 50,
        coinsuranceRate: 0.2,
      }),
    ).toEqual({
      negotiatedAmount: 1000,
      deductible: 500,
      copay: 50,
      coinsurance: 100,
      patientPay: 650,
    });
  });

  it("caps responsibility at the remaining out-of-pocket maximum", () => {
    expect(
      estimatePatientShare(1000, {
        remainingDeductible: 500,
        remainingOop: 520,
        copay: 50,
        coinsuranceRate: 0.2,
      }),
    ).toEqual({
      negotiatedAmount: 1000,
      deductible: 500,
      copay: 20,
      coinsurance: 0,
      patientPay: 520,
    });
  });

  it("does not apply copay or coinsurance if the negotiated price is fully deductible", () => {
    expect(
      estimatePatientShare(400, {
        remainingDeductible: 1000,
        remainingOop: 6000,
        copay: 50,
        coinsuranceRate: 0.2,
      }),
    ).toMatchObject({
      deductible: 400,
      copay: 0,
      coinsurance: 0,
      patientPay: 400,
    });
  });
});

describe("benefit input parsing", () => {
  it("accepts zero and currency-formatted amounts", () => {
    expect(parseOptionalMoney("$1,200.50").value).toBe(1200.5);
    expect(parseOptionalMoney("0").value).toBe(0);
    expect(parseOptionalMoney("-4").error).toBeTruthy();
  });

  it("parses a percentage into a rate and rejects values outside 0–100", () => {
    expect(parseOptionalPercent("20%").value).toBe(0.2);
    expect(parseOptionalPercent("0").value).toBe(0);
    expect(parseOptionalPercent("101").error).toBeTruthy();
  });
});
