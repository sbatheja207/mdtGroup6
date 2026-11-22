import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Calculator } from "lucide-react";
import type { PlanProfile } from "../lib/plan";
import {
  estimateCost,
  parseOptionalMoney,
  PROCEDURES,
  searchProcedures,
  SETTING_LABELS,
  type CareSetting,
  type CostEstimate,
} from "../lib/cost/estimate";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function CostEstimator({
  profile,
  onBack,
}: {
  profile: PlanProfile | undefined;
  onBack: () => void;
}) {
  if (!profile) {
    return (
      <section className="panel coming-soon">
        <Calculator size={36} />
        <span className="pill">COST ESTIMATE</span>
        <h2>Add your insurance first.</h2>
        <p>
          Estimates use your saved plan as context, plus a demo price and
          benefit catalog. Your card alone is not enough to price a visit.
        </p>
        <button className="primary" onClick={onBack}>
          Back to my insurance
          <ArrowRight size={17} />
        </button>
      </section>
    );
  }
  return <CostEstimatorForm profile={profile} onBack={onBack} />;
}

function CostEstimatorForm({
  profile,
  onBack,
}: {
  profile: PlanProfile;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [location, setLocation] = useState("");
  const [setting, setSetting] = useState<CareSetting | "">("");
  const [remainingDeductible, setRemainingDeductible] = useState("");
  const [remainingOop, setRemainingOop] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CostEstimate>();

  const matches = useMemo(() => searchProcedures(query), [query]);
  const selected = PROCEDURES.find((p) => p.id === procedureId);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const deductible = parseOptionalMoney(remainingDeductible);
    const oop = parseOptionalMoney(remainingOop);
    if (deductible.error || oop.error) {
      setError(deductible.error || oop.error || "");
      setResult(undefined);
      return;
    }
    const chosen =
      procedureId ||
      (matches.length === 1 ? matches[0].id : "") ||
      PROCEDURES.find(
        (p) => p.displayName.toLowerCase() === query.trim().toLowerCase(),
      )?.id;
    if (!chosen) {
      setError("Choose a procedure from the list.");
      setResult(undefined);
      return;
    }
    const estimated = estimateCost({
      profile,
      procedureId: chosen,
      locationQuery: location,
      setting: setting || undefined,
      remainingDeductible: deductible.value,
      remainingOop: oop.value,
    });
    if (!estimated.ok) {
      setError(estimated.error);
      setResult(undefined);
      return;
    }
    setProcedureId(chosen);
    setResult(estimated);
  }

  return (
    <div className="cost-layout">
      <section className="panel cost-panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">BEFORE CARE</div>
            <h2>Estimate a procedure</h2>
            <p>
              {`Using ${[profile.details.insurer, profile.details.planName, profile.details.planType]
                .filter(Boolean)
                .join(" · ")}. Coverage is not verified.`}
            </p>
          </div>
        </div>
        <form className="cost-form" onSubmit={submit}>
          <div className="fields">
            <label className="cost-span-2">
              Procedure
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setProcedureId("");
                  setResult(undefined);
                }}
                placeholder="e.g. MRI of the knee, colonoscopy, ER visit"
                aria-autocomplete="list"
              />
              <small>
                {selected
                  ? `Selected: ${selected.displayName} (CPT ${selected.cptCode})`
                  : "Pick a match below. This catalog is a small demo list."}
              </small>
            </label>
          </div>
          <ul className="cost-suggestions" role="listbox" aria-label="Procedures">
            {(query ? matches : PROCEDURES).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={
                    procedureId === p.id
                      ? "cost-suggestion active"
                      : "cost-suggestion"
                  }
                  onClick={() => {
                    setProcedureId(p.id);
                    setQuery(p.displayName);
                    setSetting("");
                    setResult(undefined);
                  }}
                >
                  <strong>{p.displayName}</strong>
                  <span>CPT {p.cptCode}</span>
                </button>
              </li>
            ))}
            {query && matches.length === 0 && (
              <li className="cost-empty">No demo procedures match that search.</li>
            )}
          </ul>
          <div className="fields">
            <label>
              Location
              <input
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setResult(undefined);
                }}
                placeholder="City or ZIP, e.g. Pittsburgh or 10001"
              />
              <small>Used to pick a demo price region, not a specific hospital.</small>
            </label>
            <label>
              Care setting
              <select
                value={setting}
                onChange={(e) => {
                  setSetting(e.target.value as CareSetting | "");
                  setResult(undefined);
                }}
              >
                <option value="">
                  Typical for this procedure
                  {selected ? ` (${SETTING_LABELS[selected.defaultSetting]})` : ""}
                </option>
                {(Object.keys(SETTING_LABELS) as CareSetting[]).map((key) => (
                  <option key={key} value={key}>
                    {SETTING_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Remaining deductible (optional)
              <input
                inputMode="decimal"
                value={remainingDeductible}
                onChange={(e) => {
                  setRemainingDeductible(e.target.value);
                  setResult(undefined);
                }}
                placeholder="Leave blank if you don’t know"
              />
              <small>
                If blank, the range assumes $0 through the full plan-year
                deductible.
              </small>
            </label>
            <label>
              Remaining out-of-pocket max (optional)
              <input
                inputMode="decimal"
                value={remainingOop}
                onChange={(e) => {
                  setRemainingOop(e.target.value);
                  setResult(undefined);
                }}
                placeholder="Leave blank if you don’t know"
              />
              <small>
                If blank, the full plan-year out-of-pocket maximum is assumed
                still available.
              </small>
            </label>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <div className="step-footer">
            <button type="button" className="text-button" onClick={onBack}>
              <ArrowLeft size={16} />
              Back to my insurance
            </button>
            <button className="primary" type="submit">
              Estimate
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
      </section>
      {result && (
        <section className="panel cost-panel" aria-live="polite">
          <div className="section-heading">
            <div>
              <div className="eyebrow">ESTIMATED YOU-PAY</div>
              <h2>
                {money(result.patientPay.low)}
                {result.patientPay.low !== result.patientPay.high
                  ? ` – ${money(result.patientPay.high)}`
                  : ""}
              </h2>
              <p>
                {`${result.procedure.displayName} · ${result.geo.label} · ${SETTING_LABELS[result.setting]}. Midpoint ${money(result.patientPay.mid)}.`}
              </p>
            </div>
            <span className="saved-badge">Not a guarantee</span>
          </div>
          <div className="summary-grid cost-breakdown">
            <div>
              <span>Typical allowed amount</span>
              <strong>{money(result.breakdown.allowed)}</strong>
            </div>
            <div>
              <span>Applied to deductible</span>
              <strong>{money(result.breakdown.appliedToDeductible)}</strong>
            </div>
            <div>
              <span>Copay</span>
              <strong>{money(result.breakdown.copay)}</strong>
            </div>
            <div>
              <span>Coinsurance</span>
              <strong>{money(result.breakdown.coinsurance)}</strong>
            </div>
          </div>
          <p className="cost-template">
            {`Benefit table: ${result.benefits.label}. Annual deductible ${money(result.benefits.annualDeductible)}, out-of-pocket max ${money(result.benefits.annualOopMax)}.${result.unknownRemainingDeductible ? " Remaining deductible was assumed." : ""}${result.unknownRemainingOop ? " Remaining out-of-pocket max was assumed." : ""}`}
          </p>
          <div className="context-note cost-disclaimer">
            This is a practice estimate from a fictional catalog. It is not a
            quote, prior authorization, or explanation of benefits. Member IDs
            are not sent anywhere.
          </div>
          <ul className="cost-assumptions">
            {result.assumptions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
