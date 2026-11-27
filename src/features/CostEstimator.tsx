import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Calculator } from "lucide-react";
import { BenefitsSummary } from "./BenefitsIntake";
import { getEstimateInputs } from "../lib/benefits";
import type { PlanProfile } from "../lib/plan";
import {
  estimatePatientShare,
  PROCEDURES,
  searchProcedures,
  type PatientBenefits,
  type PatientShare,
} from "../lib/cost/estimate";

type HospitalSearchResult = {
  hospitalId: string;
  hospitalName: string;
  location: string;
  procedureCode: string;
  procedureDescription: string;
  payer: string;
  planName: string;
  planMatch: "exact" | "payer_only" | "unclear";
  network: "in" | "out" | "unknown";
  grossCharge: number | null;
  cashPrice: number | null;
  negotiatedAmount: number | null;
  setting: "inpatient" | "outpatient";
  sourceUrl: string;
  lastUpdated: string | null;
};

const money = (amount: number) =>
  amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

function isHospitalSearchResult(value: unknown): value is HospitalSearchResult {
  if (!value || typeof value !== "object") return false;
  const hospital = value as Record<string, unknown>;
  return (
    typeof hospital.hospitalId === "string" &&
    typeof hospital.hospitalName === "string" &&
    typeof hospital.location === "string" &&
    typeof hospital.procedureCode === "string" &&
    typeof hospital.procedureDescription === "string" &&
    typeof hospital.payer === "string" &&
    typeof hospital.planName === "string" &&
    ["exact", "payer_only", "unclear"].includes(String(hospital.planMatch)) &&
    ["in", "out", "unknown"].includes(String(hospital.network)) &&
    (hospital.negotiatedAmount === null ||
      (typeof hospital.negotiatedAmount === "number" &&
        Number.isFinite(hospital.negotiatedAmount) &&
        hospital.negotiatedAmount >= 0)) &&
    (hospital.grossCharge === null || typeof hospital.grossCharge === "number") &&
    (hospital.cashPrice === null || typeof hospital.cashPrice === "number") &&
    ["inpatient", "outpatient"].includes(String(hospital.setting)) &&
    typeof hospital.sourceUrl === "string" &&
    /^https?:\/\//i.test(hospital.sourceUrl) &&
    (hospital.lastUpdated === null || typeof hospital.lastUpdated === "string")
  );
}

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
          Hospital price search uses the payer and plan on your saved profile.
          It does not infer benefits from your insurance card.
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
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchSummary, setSearchSummary] = useState("");
  const [hospitals, setHospitals] = useState<HospitalSearchResult[]>([]);

  const matches = useMemo(() => searchProcedures(query), [query]);
  const selected = PROCEDURES.find((procedure) => procedure.id === procedureId);
  const estimateInputs = getEstimateInputs(profile.benefits);
  const benefits: PatientBenefits | undefined =
    estimateInputs.ready && selected?.copayCategory
      ? {
          remainingDeductible: estimateInputs.remainingDeductible,
          remainingOop: estimateInputs.remainingOop,
          copay: estimateInputs.copays[selected.copayCategory],
          coinsuranceRate: estimateInputs.benefitOverrides.coinsuranceRate,
        }
      : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSearchError("");
    setSearchSummary("");
    setHospitals([]);

    if (!selected) {
      setSearchError("Choose a procedure from the list.");
      return;
    }
    if (!location.trim()) {
      setSearchError("Enter a city or ZIP code to search hospital prices.");
      return;
    }

    setSearching(true);
    try {
      const response = await fetch("/api/cost-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedureName: selected.displayName,
          cptCode: selected.cptCode,
          location: location.trim(),
          payer: profile.details.insurer,
          planName: profile.details.planName,
          planType: profile.details.planType,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "Hospital search failed.";
        throw new Error(message);
      }
      if (
        !payload ||
        typeof payload !== "object" ||
        !("hospitals" in payload) ||
        !Array.isArray(payload.hospitals) ||
        !payload.hospitals.every(isHospitalSearchResult)
      ) {
        throw new Error("Hospital search returned invalid pricing data.");
      }
      setHospitals(payload.hospitals);
      setSearchSummary(
        "Prices below are sourced from public hospital pricing information. They are not quotes or verified benefits.",
      );
      if (payload.hospitals.length === 0) {
        setSearchError(
          "No reliable, procedure-specific hospital negotiated rates were found. No price estimate was generated.",
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

  function patientEstimate(hospital: HospitalSearchResult): PatientShare | undefined {
    if (
      !benefits ||
      hospital.negotiatedAmount === null ||
      hospital.planMatch !== "exact" ||
      hospital.network !== "in"
    ) {
      return undefined;
    }
    return estimatePatientShare(hospital.negotiatedAmount, benefits);
  }

  return (
    <div className="cost-layout">
      <section className="panel cost-panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">BEFORE CARE</div>
            <h2>Search hospital prices</h2>
            <p>
              {`Searching for ${[profile.details.insurer, profile.details.planName]
                .filter(Boolean)
                .join(" · ") || "your plan"}. Member IDs are not sent.`}
            </p>
          </div>
        </div>
        <form className="cost-form" onSubmit={submit}>
          <div className="fields">
            <label className="cost-span-2">
              Procedure
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setProcedureId("");
                  setHospitals([]);
                }}
                placeholder="e.g. MRI of the knee, colonoscopy, ER visit"
                aria-autocomplete="list"
              />
              <small>
                {selected
                  ? `Selected: ${selected.displayName} (CPT ${selected.cptCode})`
                  : "Select a procedure and code to search."}
              </small>
            </label>
          </div>
          <ul className="cost-suggestions" role="listbox" aria-label="Procedures">
            {(query ? matches : PROCEDURES).map((procedure) => (
              <li key={procedure.id}>
                <button
                  type="button"
                  className={
                    procedureId === procedure.id
                      ? "cost-suggestion active"
                      : "cost-suggestion"
                  }
                  onClick={() => {
                    setProcedureId(procedure.id);
                    setQuery(procedure.displayName);
                    setHospitals([]);
                  }}
                >
                  <strong>{procedure.displayName}</strong>
                  <span>CPT {procedure.cptCode}</span>
                </button>
              </li>
            ))}
            {query && matches.length === 0 && (
              <li className="cost-empty">No matching procedure in the search list.</li>
            )}
          </ul>
          <div className="fields">
            <label className="cost-span-2">
              Location
              <input
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  setHospitals([]);
                }}
                placeholder="City or ZIP, e.g. Pittsburgh or 10001"
              />
              <small>Used to search for hospitals and their published rates.</small>
            </label>
          </div>
          <div className="context-note cost-benefit-note">
            Patient responsibility uses the reviewed benefits saved in My
            Insurance. It is calculated only when those benefits are complete,
            individual in-network, and include a copay category that matches
            the selected procedure.
          </div>
          <BenefitsSummary value={profile.benefits} />
          {!estimateInputs.ready && (
            <div className="context-note cost-benefit-note">
              <strong>Patient estimates unavailable</strong>
              <ul>
                {estimateInputs.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <button type="button" className="text-button" onClick={onBack}>
                Update benefits in My Insurance
              </button>
            </div>
          )}
          <p className="cost-template">
            The saved primary-care copay is used for established office visits,
            and the emergency copay for emergency-department visits. Other
            procedures need a matching service-specific copay rule before a
            patient estimate can be calculated.
          </p>
          {searchError && (
            <div role="alert" className="error">
              {searchError}
            </div>
          )}
          <div className="step-footer">
            <button type="button" className="text-button" onClick={onBack}>
              <ArrowLeft size={16} />
              Back to my insurance
            </button>
            <button className="primary" type="submit" disabled={searching}>
              {searching ? "Searching…" : "Search hospital prices"}
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
      </section>
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
          {hospitals.length > 0 && (
            <div className="hospital-results">
              {hospitals.map((hospital) => {
                const estimate = patientEstimate(hospital);
                return (
                  <article className="hospital-card" key={hospital.hospitalId}>
                    <div>
                      <span className="hospital-network">
                        {hospital.network === "in"
                          ? hospital.planMatch === "exact"
                            ? "Exact plan · in-network evidence"
                            : "In-network; exact plan not confirmed"
                          : hospital.network === "out"
                            ? "Out-of-network evidence"
                            : "Network status unclear"}
                      </span>
                      <h3>{hospital.hospitalName}</h3>
                      <p>{hospital.location}</p>
                    </div>
                    <strong className="hospital-price">
                      {hospital.negotiatedAmount === null
                        ? "No negotiated rate sourced"
                        : money(hospital.negotiatedAmount)}
                    </strong>
                    {hospital.negotiatedAmount !== null && (
                      <span className="hospital-price-label">
                        Published negotiated rate
                      </span>
                    )}
                    {estimate ? (
                      <div className="hospital-estimate">
                        <span>Estimated patient responsibility</span>
                        <strong>{money(estimate.patientPay)}</strong>
                        <small>
                          Deductible {money(estimate.deductible)} · Copay{" "}
                          {money(estimate.copay)} · Coinsurance{" "}
                          {money(estimate.coinsurance)}
                        </small>
                      </div>
                    ) : (
                      <p className="hospital-estimate-note">
                        {hospital.negotiatedAmount === null
                          ? "A patient estimate is unavailable without a sourced negotiated rate."
                          : hospital.planMatch !== "exact"
                            ? "A patient estimate is unavailable because the exact plan match is not supported."
                            : hospital.network !== "in"
                              ? "A patient estimate is unavailable because in-network status is not confirmed."
                              : !estimateInputs.ready
                                ? "Complete the saved benefits in My Insurance before calculating patient responsibility."
                                : !selected?.copayCategory
                                  ? "No matching service-specific copay is saved for this procedure, so no patient estimate was generated."
                                  : benefits
                                    ? "No patient estimate was calculated for this rate."
                                    : "Saved benefits are unavailable for this estimate."}
                      </p>
                    )}
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
                      View pricing source
                    </a>
                  </article>
                );
              })}
            </div>
          )}
          <div className="context-note cost-disclaimer">
            Estimates are informational only, not a quote, prior authorization,
            or explanation of benefits. Actual responsibility depends on plan
            rules, claim adjudication, and other services billed.
          </div>
        </section>
      )}
    </div>
  );
}
