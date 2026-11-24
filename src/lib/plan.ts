import type { PlanBenefits } from "./benefits";
export type PlanDetails = {
  insurer: string;
  planName: string;
  memberName: string;
  memberId: string;
  groupNumber: string;
  policyNumber: string;
  planType: string;
  effectiveDate: string;
  endDate: string;
  network: string;
};
export type PlanDocument = {
  id: string;
  name: string;
  kind: "card" | "plan";
  mime: string;
  size: number;
  blob: Blob;
  text: string;
  status: "ready" | "needs-review";
  message?: string;
};
export type PlanProfile = {
  schemaVersion: 1;
  id: string;
  updatedAt: string;
  details: PlanDetails;
  documents: PlanDocument[];
  reviewed: true;
  coverageVerified: false;
  benefits?: PlanBenefits; // Additive v1 field: old profiles remain readable.
};
export const emptyDetails: PlanDetails = {
  insurer: "",
  planName: "",
  memberName: "",
  memberId: "",
  groupNumber: "",
  policyNumber: "",
  planType: "",
  effectiveDate: "",
  endDate: "",
  network: "",
};
export function validateDetails(d: PlanDetails): string | null {
  if (!d.insurer.trim()) return "Enter the insurance company name.";
  if (!d.memberId.trim()) return "Enter the member ID printed on your card.";
  if (d.effectiveDate && d.endDate && d.effectiveDate > d.endDate)
    return "Coverage end date must be on or after the start date.";
  return null;
}
// Suggestions are evidence-based candidates, never verified benefits.
export function suggestDetails(text: string): Partial<PlanDetails> {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const result: Partial<PlanDetails> = {};
  const labeled = (label: RegExp) => {
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(label);
      if (match)
        return (match[1]?.trim() || lines[i + 1] || "")
          .split(/\s{2,}|\bPCP\s*:/i)[0]
          .trim();
    }
    return "";
  };
  const identifier = (value: string) => {
    // Stop at another field. Require a digit; never consume a label as an ID.
    const candidate = value
      .split(/\b(?:group|policy|name|rx|pcp|plan)\b/i)[0]
      .trim();
    return /^(?=.*\d)[A-Z0-9][A-Z0-9 -]{1,40}$/i.test(candidate)
      ? candidate.replace(/\s/g, "")
      : "";
  };
  const identifiers: [keyof PlanDetails, RegExp][] = [
    [
      "memberId",
      /^(?:member\s*(?:id|number|no\.?|#)|subscriber\s*(?:id|number)|identification\s*(?:number|no\.?)|id)\b[ \t:#-]*(.*)$/i,
    ],
    [
      "groupNumber",
      /^(?:group(?:\s*(?:number|no\.?|id|#))?|grp|ghp)\b[ \t:#-]*(.*)$/i,
    ],
    ["policyNumber", /^policy\s*(?:number|no\.?|id|#)\b[ \t:#-]*(.*)$/i],
  ];
  for (const [key, pattern] of identifiers) {
    const value = identifier(labeled(pattern));
    if (value) result[key] = value;
  }
  const insurer = labeled(
    /^(?:insurance company|insurer|carrier)\s*:[ \t]*(.*)$/i,
  );
  if (insurer) result.insurer = insurer;
  else {
    const brands: [RegExp, string][] = [
      [/\baetna\b/i, "Aetna"],
      [/\bcigna\b/i, "Cigna"],
      [/\bunited\s*healthcare\b/i, "UnitedHealthcare"],
      [/\bhumana\b/i, "Humana"],
      [
        /\bblue cross(?:\s+(?:and|&)?)?\s+blue shield\b/i,
        "Blue Cross Blue Shield",
      ],
      [/\bkaiser permanente\b/i, "Kaiser Permanente"],
    ];
    // Match brand text, not arbitrary near-spellings of a logo.
    const matched = brands.filter(([pattern]) => pattern.test(text));
    if (matched.length === 1) result.insurer = matched[0][1];
  }
  const name = labeled(/^(?:member name|subscriber name|name)\s*:[ \t]*(.*)$/i)
    .replace(/^[0-9@®©øØ]{1,3}[ \t]+/, "")
    .trim();
  if (
    /^[A-Za-z][A-Za-z .'-]{2,70}$/.test(name) &&
    !/^(?:member|group|policy|pcp|rx|plan)\b/i.test(name)
  )
    result.memberName = name;
  const plan = labeled(/^plan name\s*:[ \t]*(.*)$/i);
  if (plan) result.planName = plan;
  else {
    const start = lines.findIndex((l) => /^Managed Choice\b/i.test(l));
    if (start >= 0) {
      const continuation = lines
        .slice(start + 1, start + 4)
        .find((l) => /^Access\b/i.test(l));
      result.planName = [lines[start], continuation].filter(Boolean).join(" ");
    }
  }
  const type = text.match(/\b(HMO|PPO|EPO|POS|HDHP)\b/i);
  if (type) result.planType = type[1].toUpperCase();
  return result;
}
export const demoDetails: PlanDetails = {
  ...emptyDetails,
  insurer: "Example Health (fictional)",
  planName: "Campus Care Plus",
  memberName: "Alex Morgan",
  memberId: "DEMO123456",
  groupNumber: "DEMO006",
  policyNumber: "DEMO2026",
  planType: "PPO",
  network: "Example Preferred Network",
  effectiveDate: "2026-08-01",
  endDate: "2027-07-31",
};
