import type { PlanProfile } from "../plan";

export type CareSetting =
  | "office"
  | "imagingCenter"
  | "ambulatorySurgery"
  | "outpatientHospital"
  | "emergency";

export type ServiceClass =
  | "preventive"
  | "officeVisit"
  | "imaging"
  | "procedure"
  | "emergency"
  | "lab";

export type CostShareRule =
  | { kind: "free"; subjectToDeductible: false }
  | { kind: "copay"; copay: number; subjectToDeductible: boolean }
  | {
      kind: "coinsurance";
      coinsuranceRate: number;
      subjectToDeductible: boolean;
    };

export type AllowedRange = {
  p25: number;
  p50: number;
  p75: number;
};

export type Procedure = {
  id: string;
  displayName: string;
  cptCode: string;
  aliases: string[];
  serviceClass: ServiceClass;
  defaultSetting: CareSetting;
  /** Typical allowed amount at a mid-cost geography in the default setting. */
  allowedTypical: AllowedRange;
};

export type GeoBucket = {
  id: string;
  label: string;
  aliases: string[];
  zipPrefixes: string[];
  multiplier: number;
};

export type PlanBenefitTemplate = {
  id: string;
  label: string;
  insurerIncludes?: string[];
  planNameIncludes?: string[];
  planTypes?: string[];
  annualDeductible: number;
  annualOopMax: number;
  classes: Record<ServiceClass, CostShareRule>;
};

export type BenefitMatchSource = "named" | "planType" | "generic";

export type EstimateRequest = {
  profile: PlanProfile;
  procedureId: string;
  locationQuery: string;
  setting?: CareSetting;
  remainingDeductible?: number;
  remainingOop?: number;
};

export type ShareBreakdown = {
  allowed: number;
  appliedToDeductible: number;
  copay: number;
  coinsurance: number;
  patientPay: number;
};

export type CostEstimate = {
  ok: true;
  procedure: Procedure;
  geo: GeoBucket;
  setting: CareSetting;
  inNetwork: true;
  allowed: AllowedRange;
  patientPay: { low: number; mid: number; high: number };
  breakdown: ShareBreakdown;
  benefits: PlanBenefitTemplate;
  benefitSource: BenefitMatchSource;
  unknownRemainingDeductible: boolean;
  unknownRemainingOop: boolean;
  assumptions: string[];
};

export type CostEstimateResult =
  | CostEstimate
  | { ok: false; error: string };
