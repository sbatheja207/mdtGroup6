import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Calculator } from "lucide-react";
import type { PlanProfile } from "../lib/plan";
import {
  estimateCost,
  parseOptionalMoney,
  parseOptionalPercent,
  PROCEDURES,
  searchProcedures,
  SETTING_LABELS,
  type CareSetting,
  type CostEstimate,
} from "../lib/cost/estimate";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

type HospitalSearchResult = {
  hospitalId: string;
  hospitalName: string;
  location: string;
  procedureCode: string;
  procedureDescription: string;
  payer: string;
  planName: string;
  network: "in" | "out";
  grossCharge: number | null;
  cashPrice: number | null;
  negotiatedAmount: number | null;
  setting: "inpatient" | "outpatient";
  sourceUrl: string;
  lastUpdated: string | null;
};

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
  const [annualDeductible, setAnnualDeductible] = useState("");
  const [annualOopMax, setAnnualOopMax] = useState("");
  const [copay, setCopay] = useState("");
  const [coinsurance, setCoinsurance] = useState("");
  const [remainingDeductible, setRemainingDeductible] = useState("");
  const [remainingOop, setRemainingOop] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CostEstimate>();
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchSummary, setSearchSummary] = useState("");
  const [hospitals, setHospitals] = useState<HospitalSearchResult[]>([]);

  const matches = useMemo(() => searchProcedures(query), [query]);
  const selected = PROCEDURES.find((p) => p.id === procedureId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const deductible = parseOptionalMoney(remainingDeductible);
    const oop = parseOptionalMoney(remainingOop);
    const annualDeductibleValue = parseOptionalMoney(annualDeductible);
    const annualOopValue = parseOptionalMoney(annualOopMax);
    const copayValue = parseOptionalMoney(copay);
    const coinsuranceValue = parseOptionalPercent(coinsurance);
    const inputError =
      deductible.error ||
      oop.error ||
      annualDeductibleValue.error ||
      annualOopValue.error ||
      copayValue.error ||
      coinsuranceValue.error;
    if (inputError) {
      setError(inputError);
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
      benefitOverrides:
        annualDeductibleValue.value !== undefined ||
        annualOopValue.value !== undefined ||
        copayValue.value !== undefined ||
        coinsuranceValue.value !== undefined
          ? {
              annualDeductible: annualDeductibleValue.value,
              annualOopMax: annualOopValue.value,
              copay: copayValue.value,
              coinsuranceRate: coinsuranceValue.value,
            }
          : undefined,
    });
    if (!estimated.ok) {
      setError(estimated.error);
      setResult(undefined);
      return;
    }
    setProcedureId(chosen);
    setResult(estimated);

    setSearchError("");
    setSearchSummary("");
    setHospitals([]);
    if (!location.trim()) {
      setSearchError("Enter a city or ZIP to search for sourced hospital prices.");
      return;
    }

    const procedure = PROCEDURES.find((p) => p.id === chosen);
    if (!procedure) return;
    setSearching(true);
    try {
      const response = await fetch("/api/cost-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedureName: procedure.displayName,
          cptCode: procedure.cptCode,
          location: location.trim(),
          payer: profile.details.insurer,
          planName: profile.details.planName,
          planType: profile.details.planType,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Hospital search failed.");
      setHospitals(Array.isArray(payload.hospitals) ? payload.hospitals : []);
      setSearchSummary(
        typeof payload.summary === "string"
          ? payload.summary
          : "",
      );
      if (!Array.isArray(payload.hospitals) || payload.hospitals.length === 0) {
        setSearchError(
          "No reliably sourced negotiated prices were found. The demo estimate remains available above.",
        );
      }
    } catch (caught) {
      setSearchError(
        caught instanceof Error
          ? caught.message
          : "Could not complete the sourced hospital search.",
      );
    } finally {
      setSearching(false);
    }
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
              Annual deductible (optional)
              <input
                inputMode="decimal"
                value={annualDeductible}
                onChange={(e) => {
                  setAnnualDeductible(e.target.value);
                  setResult(undefined);
                }}
                placeholder="e.g. 1500"
              />
              <small>Replaces the demo plan’s deductible when entered.</small>
            </label>
            <label>
              Annual out-of-pocket max (optional)
              <input
                inputMode="decimal"
                value={annualOopMax}
                onChange={(e) => {
                  setAnnualOopMax(e.target.value);
                  setResult(undefined);
                }}
                placeholder="e.g. 6000"
              />
              <small>Replaces the demo plan’s annual maximum.</small>
            </label>
            <label>
              Copay (optional)
              <input
                inputMode="decimal"
                value={copay}
                onChange={(e) => {
                  setCopay(e.target.value);
                  setResult(undefined);
                }}
                placeholder="e.g. 50"
              />
              <small>Use when your plan specifies a flat procedure copay.</small>
            </label>
            <label>
              Coinsurance (optional)
              <input
                inputMode="decimal"
                value={coinsurance}
                onChange={(e) => {
                  setCoinsurance(e.target.value);
                  setResult(undefined);
                }}
                placeholder="e.g. 20%"
              />
              <small>Percentage paid by you after the deductible.</small>
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
      {(searching || searchError || searchSummary || hospitals.length > 0) && (
        <section className="panel cost-panel hospital-search" aria-live="polite">
          <div className="section-heading">
            <div>
              <div className="eyebrow">LIVE PUBLIC-PRICE SEARCH</div>
              <h2>Hospital pricing sources</h2>
            </div>
            {searching && <span className="saved-badge">Searching…</span>}
          </div>
          {searchSummary && <p className="cost-template">{searchSummary}</p>}
          {searchError && (
            <div role="status" className="context-note cost-disclaimer">
              {searchError}
            </div>
          )}
          {hospitals.length > 0 && (
            <div className="hospital-results">
              {hospitals.map((hospital) => (
                <article className="hospital-card" key={hospital.hospitalId}>
                  <div>
                    <span className="hospital-network">
                      {hospital.network === "in" ? "In-network evidence" : "Network unclear"}
                    </span>
                    <h3>{hospital.hospitalName}</h3>
                    <p>{hospital.location}</p>
                  </div>
                  <strong className="hospital-price">
                    {hospital.negotiatedAmount === null
                      ? "Price unavailable"
                      : money(hospital.negotiatedAmount)}
                  </strong>
                  <dl>
                    {hospital.grossCharge !== null && (
                      <>
                        <dt>Gross charge</dt>
                        <dd>{money(hospital.grossCharge)}</dd>
                      </>
                    )}
                    {hospital.cashPrice !== null && (
                      <>
                        <dt>Cash price</dt>
                        <dd>{money(hospital.cashPrice)}</dd>
                      </>
                    )}
                    <dt>Setting</dt>
                    <dd>{hospital.setting}</dd>
                    {hospital.lastUpdated && (
                      <>
                        <dt>Last updated</dt>
                        <dd>{hospital.lastUpdated}</dd>
                      </>
                    )}
                  </dl>
                  <a href={hospital.sourceUrl} target="_blank" rel="noreferrer">
                    View source
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
