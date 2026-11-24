import { useEffect } from "react";
import {
  benefitFields,
  emptyBenefits,
  extractBenefits,
  missingBenefits,
  type PlanBenefits,
} from "../lib/benefits";
import type { PlanDocument } from "../lib/plan";

export function BenefitsIntake({
  value,
  onChange,
  documents,
  onUpload,
  insurer,
}: {
  value: PlanBenefits;
  onChange: React.Dispatch<React.SetStateAction<PlanBenefits>>;
  documents: PlanDocument[];
  onUpload: () => void;
  insurer: string;
}) {
  useEffect(() => {
    onChange((current) => {
      const cleaned = structuredClone(current);
      for (const field of benefitFields) {
        const source = cleaned.values[field.key].source;
        if (source && !documents.some((d) => d.id === source.documentId))
          cleaned.values[field.key] = { value: "", unknown: false };
      }
      return extractBenefits(documents, cleaned);
    });
  }, [documents, value.scope, value.network, onChange]);
  const found = benefitFields.filter((f) => value.values[f.key].source).length;
  const portal = /aetna/i.test(insurer)
    ? "https://www.aetna.com/individuals-families.html"
    : /cigna/i.test(insurer)
      ? "https://www.cigna.com/individuals-families/"
      : /unitedhealthcare/i.test(insurer)
        ? "https://www.uhc.com/member-resources"
        : undefined;
  return (
    <section className="benefits-intake">
      <h2>What does your plan ask you to pay?</h2>
      <p>
        We check the text in your uploaded card and plan documents for benefit
        amounts. Your member ID alone cannot retrieve your personal deductible
        balance.
      </p>
      <div className="benefit-status" role="status">
        <strong>
          {found
            ? `${found} benefit amounts found — review the evidence below.`
            : "We couldn’t identify your deductible and cost-sharing amounts yet."}
        </strong>
        <p>
          {found
            ? "Missing or conflicting values still need an answer. These suggestions are not verified by your insurer."
            : "You must enter the amounts below or explicitly choose “I don’t know”. Unknown amounts stay missing and block estimate-ready status."}
        </p>
      </div>
      <div className="benefit-help">
        <strong>Where to find the numbers</strong>
        <p>
          Use your Summary of Benefits and Coverage for annual limits and visit
          costs. Use your insurer’s member portal or a recent Explanation of
          Benefits for remaining balances. Choose the correct plan year and
          network.
        </p>
        <button type="button" className="secondary" onClick={onUpload}>
          Add a benefits document
        </button>
        {portal && (
          <a href={portal} target="_blank" rel="noreferrer">
            Open {insurer} member resources
          </a>
        )}
        <p>
          Online benefit lookup is not connected. We never guess your deductible
          from an insurer name or send member IDs to a public search engine.
        </p>
      </div>
      <div className="fields">
        <label>
          Whose benefit limits? *
          <select
            required
            value={value.scope}
            onChange={(e) =>
              onChange((current) => ({
                ...emptyBenefits(),
                periodStart: current.periodStart,
                periodEnd: current.periodEnd,
                balancesAsOf: current.balancesAsOf,
                network: current.network,
                scope: e.target.value as PlanBenefits["scope"],
              }))
            }
          >
            <option value="">Choose individual or family</option>
            <option value="individual">Individual member</option>
            <option value="family">Family aggregate</option>
          </select>
          <small>
            Changing scope clears these amounts so individual and family limits
            aren’t mixed.
          </small>
        </label>
        <label>
          Benefit network *
          <select
            required
            value={value.network}
            onChange={(e) =>
              onChange((current) => ({
                ...emptyBenefits(),
                periodStart: current.periodStart,
                periodEnd: current.periodEnd,
                balancesAsOf: current.balancesAsOf,
                scope: current.scope,
                network: e.target.value as PlanBenefits["network"],
              }))
            }
          >
            <option value="">Choose a network</option>
            <option value="in">In-network</option>
            <option value="out">Out-of-network</option>
          </select>
          <small>
            Changing network clears these amounts. This does not verify a
            specific provider’s network status.
          </small>
        </label>
        {(["periodStart", "periodEnd", "balancesAsOf"] as const).map(
          (key, i) => (
            <label key={key}>
              {
                [
                  "Benefit period starts",
                  "Benefit period ends",
                  "Remaining balances checked on",
                ][i]
              }{" "}
              *
              <input
                aria-label={
                  [
                    "Benefit period starts",
                    "Benefit period ends",
                    "Remaining balances checked on",
                  ][i]
                }
                type="date"
                required
                value={value[key]}
                onInput={(e) => {
                  const date = e.currentTarget.value;
                  onChange((current) => ({
                    ...current,
                    [key]: date,
                    reviewed: false,
                  }));
                }}
                onChange={(e) => {
                  const date = e.currentTarget.value;
                  onChange((current) => ({
                    ...current,
                    [key]: date,
                    reviewed: false,
                  }));
                }}
              />
            </label>
          ),
        )}
      </div>
      <div className="benefit-field-list">
        {benefitFields.map((f) => {
          const v = value.values[f.key];
          return (
            <div className="benefit-field" key={f.key}>
              <label htmlFor={f.key}>
                {f.label} ({f.unit}) *
              </label>
              <p id={`${f.key}-help`}>{f.help}</p>
              <input
                id={f.key}
                aria-describedby={`${f.key}-help`}
                type="number"
                inputMode="decimal"
                min="0"
                max={f.unit === "%" ? 100 : undefined}
                step="0.01"
                required={!v.unknown}
                disabled={v.unknown || !value.scope || !value.network}
                placeholder={
                  v.unknown ? "Unknown — no assumption made" : "Enter amount"
                }
                value={v.value}
                onChange={(e) =>
                  onChange((current) => ({
                    ...current,
                    reviewed: false,
                    values: {
                      ...current.values,
                      [f.key]: { value: e.target.value, unknown: false },
                    },
                  }))
                }
              />
              <label className="unknown-choice">
                <input
                  type="checkbox"
                  checked={v.unknown}
                  disabled={!value.scope || !value.network}
                  onChange={(e) =>
                    onChange((current) => ({
                      ...current,
                      reviewed: false,
                      values: {
                        ...current.values,
                        [f.key]: { value: "", unknown: e.target.checked },
                      },
                    }))
                  }
                />
                I don’t know {f.label.toLowerCase()}
              </label>
              {v.source && (
                <details>
                  <summary>Suggested from {v.source.name}</summary>
                  <blockquote>{v.source.quote}</blockquote>
                  <p>
                    Confirm this is for the correct benefit year and person.
                    Edit the amount if needed.
                  </p>
                </details>
              )}
              {!!v.conflicts?.length && (
                <div className="benefit-conflict">
                  Different amounts found. Check the correct document and enter
                  the value manually.
                  <ul>
                    {v.conflicts.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <label className="benefit-notes">
        Service rules and exceptions
        <textarea
          value={value.notes}
          maxLength={4000}
          placeholder="For example: primary care copay before deductible; separate drug deductible; referrals; prior authorization; family embedded limits."
          onChange={(e) =>
            onChange((current) => ({
              ...current,
              notes: e.target.value,
              reviewed: false,
            }))
          }
        />
      </label>
      <div className="benefit-help">
        <strong>For estimates and bill checks</strong>
        <p>
          We’ll also need the procedure/CPT code, service date,
          provider/facility, location, network status, and negotiated allowed
          amount. Bill review additionally needs the itemized bill and insurer’s
          EOB (claim ID, payments, adjustments and denial codes). A discrepancy
          is a question to investigate, not proof of fraud.
        </p>
      </div>
      <label className="consent">
        <input
          type="checkbox"
          checked={value.reviewed}
          onChange={(e) =>
            onChange((current) => ({ ...current, reviewed: e.target.checked }))
          }
        />
        <span>
          I checked these values against my plan for the selected person,
          network and benefit period, and explicitly marked anything I don’t
          know.
        </span>
      </label>
    </section>
  );
}
export function BenefitsSummary({ value }: { value?: PlanBenefits }) {
  const missing = missingBenefits(value);
  return (
    <section className="benefits-summary">
      <h3>Benefits for estimates & bill review</h3>
      <p className={missing.length ? "benefit-incomplete" : "benefit-complete"}>
        {missing.length
          ? "More information needed — do not calculate using assumed benefits."
          : "Benefits recorded. Service-specific rules, prices and current eligibility still need confirmation."}
      </p>
      {value && (
        <>
          <p>
            {value.scope || "Unspecified scope"} ·{" "}
            {value.network === "in"
              ? "in-network"
              : value.network === "out"
                ? "out-of-network"
                : "network not set"}{" "}
            · {value.periodStart || "?"} to {value.periodEnd || "?"} · Balances
            checked {value.balancesAsOf || "?"}
          </p>
          <dl>
            {benefitFields.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>
                  {value.values[f.key].unknown ||
                  value.values[f.key].value === ""
                    ? "Unknown — needed"
                    : f.unit === "%"
                      ? `${value.values[f.key].value}%`
                      : `$${Number(value.values[f.key].value).toLocaleString("en-US")}`}
                </dd>
              </div>
            ))}
          </dl>
          {value.notes && <p>Rules to check: {value.notes}</p>}
        </>
      )}
    </section>
  );
}
