# Implementation Plan: AI-Powered Medical Procedure Cost Estimator

## 1. Project Overview

Build an AI-powered application that helps users compare estimated out-of-pocket costs for medical procedures across hospitals based on their insurance coverage.

The application will use:

- **LLM (OpenAI API):** Understands user questions, interprets search results, and generates responses.
- **Web Search API:** Searches the internet for hospital pricing information and retrieves relevant sources.
- **Hospital Price Transparency Files (MRFs):** Provide publicly available negotiated prices for different insurance payers and plans.
- **User Insurance Benefits:** Provide deductible, copay, coinsurance, and out-of-pocket maximum information.
- **Backend Cost Calculator:** Calculates estimated patient responsibility using retrieved prices and insurance benefits.

**Architecture:** The application will use LLM + Web Search rather than maintaining its own hospital pricing database or building a dedicated MRF ingestion pipeline.

---

## 2. System Architecture

1. User enters a procedure, location, and insurance information.
2. LLM identifies the relevant procedure code (CPT/HCPCS) and search parameters.
3. LLM invokes a web search tool to find hospital pricing information.
4. Web search retrieves relevant hospital websites, pricing files, and documents.
5. LLM interprets retrieved information to identify negotiated rates matching the user's insurance payer and plan.
6. Backend validates the retrieved pricing information and matches it against the user's insurance benefits.
7. Backend cost calculator estimates the patient's out-of-pocket responsibility.
8. LLM explains and presents hospital cost comparisons with source citations.

---

## 3. Implementation Phases

### Phase 1: LLM and Web Search Integration

**Objective:** Enable the AI model to retrieve hospital pricing information from the internet.

**Tasks:**

1. Integrate the OpenAI API using the Responses API.
2. Integrate a web search tool/API that allows the model to search external websites.
3. Configure the model to search for:
   - Hospital Machine-Readable Files (MRFs).
   - Hospital procedure pricing information.
   - CPT/HCPCS-specific negotiated rates.
   - Insurance payer and plan-specific pricing.
4. Have the model identify relevant sources and extract pricing information.
5. Require the model to provide source URLs and pricing file update dates when available.
6. Instruct the model not to invent prices when information cannot be found.

**Deliverable:** An AI assistant capable of searching the internet for hospital procedure prices and returning sourced results.

### Phase 2: Hospital Price Retrieval

**Objective:** Extract negotiated hospital prices from publicly available pricing information.

**Tasks:**

1. Search for hospital MRFs using the hospital name and location.
2. Retrieve relevant pricing files or webpages.
3. Identify the requested CPT/HCPCS procedure code.
4. Extract:
   - Hospital name and location.
   - Procedure code and description.
   - Insurance payer.
   - Specific insurance plan.
   - Negotiated rate.
   - Gross charge and cash price, when available.
   - Inpatient/outpatient setting.
   - Source URL and last-updated date.
5. Verify that the retrieved rate corresponds to the requested insurance plan.
6. Handle missing, outdated, ambiguous, or unavailable pricing information.
7. Return structured pricing results to the application.

**Deliverable:** Hospital pricing information retrieved and organized into a standardized response format.

### Phase 3: Insurance Benefits Collection

**Objective:** Obtain the user's insurance benefits to estimate personalized costs.

Hospital MRFs provide negotiated prices but generally do not include individual patient responsibility.

**Tasks:**

1. Allow users to enter their insurance provider and specific plan.
2. Collect relevant insurance benefits:
   - Total annual deductible.
   - Remaining deductible.
   - Copay.
   - Coinsurance percentage.
   - Annual out-of-pocket maximum.
   - Remaining out-of-pocket maximum.
3. Initially allow users to enter these values manually.
4. Explore insurance provider integrations or supported APIs for automatic benefit retrieval.
5. Validate that the hospital's negotiated rate matches the user's insurance plan and network.

**Deliverable:** Structured insurance benefit information available for cost calculations.

### Phase 4: Personalized Cost Calculation

**Objective:** Calculate estimated patient responsibility using retrieved hospital prices and insurance benefits.

**Tasks:**

1. Create a deterministic backend cost calculation service.
2. Determine whether the procedure is covered and whether the negotiated rate applies.
3. Calculate the deductible amount.
4. Apply copay and coinsurance according to the user's plan rules.
5. Account for the remaining out-of-pocket maximum.
6. Handle special insurance rules, including separate deductibles, exclusions, and in-network versus out-of-network coverage.
7. Return an estimated patient responsibility with a detailed calculation breakdown.

**Example:**

Assume:

- Negotiated hospital rate: $1,000.
- Remaining deductible: $500.
- Coinsurance: 20%.
- Copay: $50, additionally applicable.

| Component                            |   Amount |
| ------------------------------------ | -------: |
| Deductible                           |     $500 |
| Coinsurance                          |     $100 |
| Copay                                |      $50 |
| **Estimated patient responsibility** | **$650** |

_Illustrative calculation; actual plan rules determine how these amounts apply._

**Deliverable:** A backend service that calculates estimated out-of-pocket costs independently of the LLM.

### Phase 5: Frontend Development

**Objective:** Create an intuitive interface for searching and comparing procedure costs.

**Tasks:**

1. Build a procedure search interface.
2. Allow users to enter procedure names or CPT codes, location, and insurance information.
3. Create an interface for entering insurance benefits.
4. Display hospital search results and pricing comparisons.
5. Show:
   - Hospital name and location.
   - Negotiated procedure price.
   - Insurance plan match.
   - Estimated out-of-pocket cost.
   - Deductible, copay, and coinsurance breakdown.
   - Pricing source and last-updated date.
6. Integrate an AI chatbot for follow-up questions and explanations.

**Deliverable:** A user-facing application that compares estimated procedure costs across hospitals.

### Phase 6: Testing and Validation

**Objective:** Ensure retrieved pricing information and cost estimates are accurate.

**Tasks:**

1. Test web searches across different hospital websites.
2. Verify extracted CPT/HCPCS codes and negotiated rates against original MRFs.
3. Test insurance payer and plan matching.
4. Validate cost calculations against manually calculated examples.
5. Test missing or outdated pricing information.
6. Test ambiguous insurance plan matches.
7. Verify that the LLM does not fabricate prices or insurance benefits.
8. Ensure every displayed price has an identifiable source.
9. Clearly communicate when an estimate cannot be reliably calculated.

**Deliverable:** A tested application that provides transparent, sourced hospital price comparisons.

---

## 4. Proposed Data Models

### ProcedurePrice

```typescript
type ProcedurePrice = {
  hospitalId: string;
  procedureCode: string;
  procedureDescription: string;

  payer: string;
  planName: string;
  network: "in" | "out";

  grossCharge?: number;
  cashPrice?: number;
  negotiatedAmount?: number;

  setting: "inpatient" | "outpatient";

  sourceUrl: string;
  lastUpdated?: string;
};
```

### PlanBenefits

```typescript
type PlanBenefits = {
  planId: string;

  deductibleRemaining: number;
  coinsuranceRate: number;
  copay: number;

  outOfPocketMaximum: number;
  outOfPocketRemaining: number;

  network: "in" | "out";
};
```

These structures can be used to standardize the information returned by web searches and user-provided insurance benefits. They do not require a persistent pricing database.

---

## 5. Recommended Technology Stack

| Component        | Technology                                            |
| ---------------- | ----------------------------------------------------- |
| Frontend         | React / Next.js                                       |
| Backend          | Node.js / TypeScript                                  |
| AI Model         | OpenAI API (Responses API)                            |
| Web Search       | OpenAI web search tool or external search API         |
| Pricing Sources  | Hospital MRFs and hospital websites                   |
| Cost Calculation | Custom deterministic backend service                  |

---

## 6. MVP Scope and Future Improvements

### MVP

1. Support a limited geographic area and set of hospitals.
2. Integrate an LLM with web search.
3. Retrieve hospital MRFs and procedure-specific negotiated rates.
4. Support CPT/HCPCS procedure searches.
5. Allow manual entry of insurance benefits.
6. Match retrieved prices to insurance payer and plan.
7. Calculate estimated out-of-pocket costs.
8. Display hospital comparisons with source citations.

---

## 7. Important Considerations

- **LLM reliability:** LLMs can misinterpret pricing information. Validate extracted prices against original sources whenever possible.
- **MRF accessibility:** Some hospital pricing files are extremely large and may not be fully indexed or accessible through ordinary web search. A separate file retrieval and parsing mechanism may be necessary.
- **Exact insurance matching:** Matching only the insurance company is insufficient. Verify the specific plan and network.
- **Negotiated price vs. patient responsibility:** These are different values and must be calculated separately.
- **Insurance benefit accuracy:** User-provided benefits may be incomplete or outdated.
- **Additional procedure costs:** A single CPT code may not include all facility, surgeon, anesthesia, or ancillary charges.
- **Estimates are not guarantees:** Actual patient responsibility depends on coverage rules, claim adjudication, and the user's insurance status.

## 8. Expected Outcome

Users can enter a medical procedure, location, and insurance information to receive a comparison of estimated out-of-pocket costs across hospitals.

The application will use an LLM with web search to find publicly available hospital pricing information, combine the retrieved negotiated rates with individual insurance benefits, and use deterministic backend calculations to estimate patient responsibility.

The MVP will not require a centralized hospital pricing database or a dedicated MRF ingestion pipeline.
