export type Procedure = {
  id: string;
  displayName: string;
  cptCode: string;
  aliases: string[];
  copayCategory?: "primary" | "specialist" | "emergency";
};

export type PatientBenefits = {
  remainingDeductible: number;
  remainingOop: number;
  copay: number;
  coinsuranceRate: number;
};

export type PatientShare = {
  negotiatedAmount: number;
  deductible: number;
  copay: number;
  coinsurance: number;
  patientPay: number;
};
