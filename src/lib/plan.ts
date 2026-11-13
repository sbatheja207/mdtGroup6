export type PlanDetails = {
  insurer: string; planName: string; memberName: string; memberId: string;
  groupNumber: string; policyNumber: string; planType: string;
  effectiveDate: string; endDate: string; network: string;
};
export type PlanDocument = {
  id: string; name: string; kind: 'card' | 'plan'; mime: string; size: number;
  blob: Blob; text: string; status: 'ready' | 'needs-review'; message?: string;
};
export type PlanProfile = {
  schemaVersion: 1; id: string; updatedAt: string; details: PlanDetails;
  documents: PlanDocument[]; reviewed: true; coverageVerified: false;
};
export const emptyDetails: PlanDetails = { insurer: '', planName: '', memberName: '', memberId: '', groupNumber: '', policyNumber: '', planType: '', effectiveDate: '', endDate: '', network: '' };
export function validateDetails(d: PlanDetails): string | null {
  if (!d.insurer.trim()) return 'Enter the insurance company name.';
  if (!d.memberId.trim()) return 'Enter the member ID printed on your card.';
  if (d.effectiveDate && d.endDate && d.effectiveDate > d.endDate) return 'Coverage end date must be on or after the start date.';
  return null;
}
// Conservative labeled-field extraction. Never infer benefits or overwrite reviewed values.
export function suggestDetails(text: string): Partial<PlanDetails> {
  const patterns: Partial<Record<keyof PlanDetails, RegExp>> = {
    memberId: /(?:member\s*(?:id|number|#)|subscriber\s*(?:id|number))\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,40})/i,
    groupNumber: /group\s*(?:number|no\.?|id|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{1,40})/i,
    policyNumber: /policy\s*(?:number|no\.?|id|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{1,40})/i,
    insurer: /(?:insurance company|insurer|carrier)\s*:\s*([^\n]{2,100})/i,
    planName: /plan name\s*:\s*([^\n]{2,100})/i,
    memberName: /member name\s*:\s*([^\n]{2,100})/i,
  };
  return Object.fromEntries(Object.entries(patterns).flatMap(([key, pattern]) => {
    const match = text.match(pattern); return match ? [[key, match[1].trim()]] : [];
  }));
}
export const demoDetails: PlanDetails = { ...emptyDetails, insurer: 'Example Health (fictional)', planName: 'Campus Care Plus', memberName: 'Alex Morgan', memberId: 'DEMO123456', groupNumber: 'DEMO006', policyNumber: 'DEMO2026', planType: 'PPO', network: 'Example Preferred Network', effectiveDate: '2026-08-01', endDate: '2027-07-31' };
