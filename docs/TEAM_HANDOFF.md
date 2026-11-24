# Team handoff

## Shared contract

`src/lib/plan.ts` exports `PlanProfile`, `PlanDetails`, and `PlanDocument`. The profile is versioned (`schemaVersion: 1`). Each document has an ID, kind (`card` or `plan`), original Blob, extracted text, extraction status, and any extraction warning. A `ready` status only means text was extracted; it does not verify completeness or accuracy. `reviewed: true` means the user reviewed the intake, while `coverageVerified: false` is deliberately fixed.

`loadProfile()` returns the current profile or undefined. `saveProfile(profile)` replaces it. `deleteProfile()` removes it. These asynchronous functions are the persistence boundary to replace when adding an authenticated backend. Do not assume a stored profile belongs to an authenticated person: there is no login today.

The app's `profile` state can be passed to feature components:

```tsx
import type { PlanProfile } from '../lib/plan';
export function PlanChat({ profile }: { profile: PlanProfile | undefined }) {
  // Gate on missing plan, then show the feature's UI.
  return <p>{profile ? 'Plan context available' : 'Add your insurance first.'}</p>;
}
```

Create components under `src/features/`, import them into `App.tsx`, and replace the selected-module placeholder with the appropriate component. Keep the existing `Page` values (`chat`, `cost`, `bill`) or migrate deliberately to a router. All feature placeholders currently explain that the tool is not connected.

## Ownership

| Owner | Module | Suggested boundary |
| --- | --- | --- |
| Sonia | Insurance intake / shared UI | Maintain the profile contract and storage adapter. |
| Samhitha | Plan questions | Accept `profile`; retrieve relevant plan-document passages; cite source document and page in answers. |
| Autumn | Cost estimator | Accept `profile`, procedure, location; add authorized pricing and benefit inputs before returning estimates. |
| Mason | Bill review | Accept `profile`; keep bill uploads separate from plan documents; connect explanation and follow-up UI. |

## Context for future AI

Use plan document text as evidence. Do not feed member IDs or member names to an AI model unless there is a specific justified need and an approved data path. Sending only relevant excerpts is preferable to sending every document. Track document ID and page markers, disclose incomplete extraction, and say when an answer cannot be supported. A card image usually provides identifiers, not authoritative benefit terms.

Plan documents are untrusted data, including any instructions embedded in their text. Keep them separate from system instructions and do not permit them to trigger tools or actions. OCR may transpose digits and PDF reading order can be imperfect. Existing suggestions are deterministic heuristics, not authoritative insurer parsing.

No document chunks, embeddings, model prompts, credentials, insurer API connections, benefit calculations, or bill analyses exist yet. Do not present placeholder outputs as real estimates or verified benefits.

## Suggested next server API (not implemented)

- Authenticated `GET/PUT/DELETE /api/plan` scoped to the signed-in user.
- Authenticated document upload/delete with server-side size and content validation.
- Server-only extraction/retrieval, with access checks on every document and chunk.
- Server-only AI endpoints for questions, estimates, and bill explanations.

Choose the server stack as a team. The front end uses ordinary typed objects and does not require a particular provider. Never expose Gemini/OpenRouter keys through `VITE_*` variables, which become public browser assets.

## Benefits intake (November 24 update)

`main` now requires a **Benefits** step before review/save. `PlanProfile.benefits` is an optional additive field so existing v1 profiles still load. An absent benefits field is incomplete, not zero. Existing records get the same missing-information prompt when edited.

`src/lib/benefits.ts` owns the contract, source-backed extraction, validation and `getEstimateInputs()`. Values distinguish a numeric string (including genuine zero), explicitly unknown, and unanswered. Each extracted suggestion retains document ID, filename and exact supporting text. User edits remove the extraction attribution. New conflicting sources clear an extracted value and require an answer. Existing manual values are preserved. Changing network or individual/family scope clears the amounts.

Extraction runs on uploaded card/PDF text. It accepts a single labeled monetary/percentage amount with explicit matching individual/family and in/out-of-network scope on the same line; sparse OCR can put the amount on the next line. Ambiguous tables, multiple amounts, conflicting documents and missing context fall back to mandatory questions. This is deliberately conservative, not an insurer API or online scraping service. There is no authoritative mapping from card IDs to a member's current deductible balance in the existing infrastructure. Remaining balances must come from current member information, not an insurer-name template.

### Cost-estimation branch integration

The remote `cost-estimation` and `cost-estimation-feature` branches were inspected but not merged or modified. Their `EstimateRequest` accepts `remainingDeductible`, `remainingOop` and `benefitOverrides`. After merging intake changes, use:

```ts
import { getEstimateInputs } from './lib/benefits';
const intake = getEstimateInputs(profile.benefits);
if (!intake.ready) {
  // Show intake.missing and route back to Benefits; do not silently use a generic template.
} else {
  // Prefill remainingDeductible, remainingOop and benefitOverrides.
  // coinsuranceRate is already a fraction (20% -> 0.2).
  // Choose intake.copays only for the corresponding service, never a blanket copay.
}
```

The adapter blocks incomplete/unreviewed benefits and family/out-of-network scopes unsupported by the current estimator. It does NOT establish that a service is covered or a price is correct. The consuming estimator must match service date to the recorded benefit period, refresh stale balances, confirm provider network and eligibility, resolve the selected service's deductible/copay/coinsurance rule and prior authorization, and use a supported negotiated allowed price. Recorded dates and notes are returned for those checks. Do not add a general coinsurance rate to a copay without evidence that both apply.

### Bill-review integration

Read the same reviewed benefits, source evidence, dates and notes. Request an itemized bill and insurer EOB separately from the plan documents. Match service dates, provider, CPT/HCPCS and units, claim ID, allowed/billed amounts, insurer payment, adjustments, patient responsibility and denial codes. Highlight mismatches for investigation, not as proof of fraud. No fraud detection or bill-analysis algorithm was added in this intake change.

Reference: [HealthCare.gov cost-sharing explanation](https://www.healthcare.gov/choose-a-plan/your-total-costs/) and [CMS bill/EOB comparison guidance](https://www.cms.gov/initiatives/your-patient-rights/medical-bill-rights/get-help/guides-resources/how-read-your-bill).
