# PayerPrice API Documentation

PayerPrice's healthcare price transparency APIs give you access to negotiated rates, provider information, and market benchmarks across the United States. Use them to power reimbursement analytics, build provider directories, and retrieve fee schedules.

## Quickstart

1. Copy your API key from the account bar at the top of the API Doc page. If no key is assigned, email [support@payerprice.com](mailto:support@payerprice.com).
2. Send the key as a Bearer token over HTTPS. Make a first request to list available payers and data periods:

```bash
curl https://api.payerprice.com/api/v1/payers \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

3. The response is an array of objects with a `payer` name and `yearMonths` entries. Use a returned payer and period when building a pricing request. [See the payer endpoint](/api/doc#tag/payer-apis/GET/api/v1/payers).
4. Next, [get market benchmarks](/api/doc#tag/pricing-apis/POST/api/v1/market/benchmarks) for a comparable market or [get provider rates](/api/doc#tag/pricing-apis/POST/api/v1/provider/rates) for a specific NPI, TIN, or CCN.

Keep your API key private. Never commit it to source control or share it publicly.

## Credits and pricing

- Requests made with an API key spend your organization's API/MCP credit, the same balance MCP tool calls use. Trial accounts start with API/MCP trial credit, counted in calls. Signed-in members of paid organizations see each endpoint's price at the top of its description.
- **Test Request** sends a real request and uses credit. Nothing is sent until you click that button.
- A request without enough credit returns `402`. Check your balance and add credits from the account bar, and track spending in the [usage dashboard](https://app.payerprice.com/app/profile?tab=api-usage).

## Integration essentials

- A missing or invalid key returns `401`; a forbidden request returns `403`. Invalid filters can return `400`.
- Rate limiting returns `429`; back off before retrying. Retry reads after transient failures, but do not blindly repeat create, update, or delete requests.
- Pagination and asynchronous processing vary by endpoint. Follow each operation's request and response fields. Report creation can finish after the initial request; use its documented status and data-retrieval workflow.
- API paths use `/api/v1`. The OpenAPI version describes this contract; payer `yearMonths` describe available source-data periods. These are separate versions.

## Resources

- [Download the OpenAPI specification](/api/doc/openapi.json) using a signed-in browser session or an `Authorization: Bearer YOUR_API_KEY` header. Credentials are never embedded in the response.
- [Read Markdown docs](/api/doc.md) or [the API index for agents](/llms.txt).
- [Read the MCP documentation](/mcp/doc) to connect AI assistants and agents to PayerPrice data.

## Authentication

All requests must include an API key as a Bearer token in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

## Base URL

`https://api.payerprice.com`

## Payer APIs

Retrieve payer-level metadata — supported payers, available data periods, and plan names for a given insurance payer.

### GET /api/v1/payers {#get-apiv1payers}

Retrieve supported payers and available year/month source-data periods. A listed period means data is available for that payer; it does not establish a contract effective date for any returned rate.

#### Responses

- **200**: Array of payer availability objects
- **401**: Missing or invalid API key.
- **402**: Insufficient API credit for an API-key request.
- **403**: The API key cannot access this endpoint.
- **429**: Request rate limit exceeded; retry after backing off.

---

### POST /api/v1/payer/plans {#post-apiv1payerplans}

Retrieve the list of normalized plan names for a given payer, ordered by frequency (most common first).

#### Request Body

- `payer` **(required)**: Payer enum: BCBS, United, Aetna, Cigna, FirstHealth, BannerHealth, MeritainHealth, Centene, Fidelis, Ambetter... - 
- `sort`: array of objects - Sort order as a list holding one `{field, direction}` entry: orders plan names alphabetically instead of most common first. Only one sort entry is supported; a request with more than one returns 400.
  - `field` **(required)**: string (planName) - 
  - `direction`: string (asc, desc) - Defaults to `desc`.

#### Example: Query BCBS plan names

```json
{
  "payer": "BCBS"
}
```

#### Responses

- **200**: Array of payer plan objects
- **400**: Invalid payer
- **401**: Missing or invalid API key.
- **402**: Not enough API credit for this request.
- **403**: The API key cannot access this endpoint.
- **429**: Request rate limit exceeded; retry after backing off.

---

## Provider APIs

Look up and search for healthcare providers by NPI, TIN, name, location, taxonomy, entity type, in-network payers, or affiliations. Supports both direct lookups and fuzzy search — suited for building provider directories and network analysis.

### POST /api/v1/npis {#post-apiv1npis}

Retrieve provider information for one or more National Provider Identifiers (NPIs).

#### Request Body

- `npis` **(required)**: array - Array of NPI numbers to query
- `includeFields`: array - List of fields to include in the response. `ccns`, `taxonomies`, `relatedNpis`, `practiceAddress`, `mailingAddress`, `otherNames`, and `topCodes` are the values `POST /api/v1/npiSearch` returns, and are absent for an NPI the provider directory has not indexed.
- `taxonomies`: all of the provider's taxonomy codes; `primaryTaxonomyCode` is the primary one.
- `ccns`: CMS Certification Numbers linked to the NPI.
- `topCodes`: up to 20 codes the provider bills most, as `{code, type}` entries (for example `{"code": "99213", "type": "CPT"}`), ranked by Medicare, Medicaid, and commercial claim volume, or the specialty's most billed codes when the provider has no claims. Requires a signed-in user or API key.
- `medicareClaimInfo`: Medicare fee-for-service services and payments by HCPCS code, place of service, and year. Requires a signed-in user or API key.
- `medicaidClaimInfo`: Medicaid claims, beneficiaries, and payments by HCPCS code and year. Requires a signed-in user or API key.
- `quality`: CMS Doctors and Clinicians quality data: MIPS final score and categories, procedure volume, Medicare services, and affiliated facilities. Absent when CMS publishes none for the NPI.
- `registry`: the NPI's CMS NPPES registry record: legal name, authorized official, mailing and practice addresses, taxonomies with licenses, other names and identifiers, health information exchange endpoints, and enumeration, update, and deactivation dates. At most 10 NPIs per request. Requires a signed-in user or API key.

Each field is returned only when requested.

#### Example 1: Query NPI information

```json
{
  "npis": [
    1073502985
  ],
  "includeFields": [
    "npi",
    "name",
    "credentials",
    "state",
    "counties",
    "entityType",
    "payers",
    "tins",
    "primaryTaxonomyCode"
  ]
}
```

#### Example 2: Get an organization's CCNs, addresses, related NPIs, and most billed codes

```json
{
  "npis": [
    1841266194
  ],
  "includeFields": [
    "npi",
    "ccns",
    "taxonomies",
    "relatedNpis",
    "practiceAddress",
    "mailingAddress",
    "otherNames",
    "topCodes"
  ]
}
```

#### Responses

- **200**: Array of NPI information objects
- **400**: Invalid request parameters
- **401**: A claim field, `topCodes`, or `registry` was requested without a signed-in user or API key
- **402**: Not enough API credit for this request.
- **429**: Request rate limit exceeded; retry after backing off.

---

### POST /api/v1/npiSearch {#post-apiv1npiSearch}

Fuzzy search for NPIs by name or NPI. Optionally filter results by taxonomy, state, county, or entity type.

#### Request Body

- `cmsCodes`: array - CPT or HCPCS codes, for example `["95004", "95024"]`. Keeps providers with Medicare or Medicaid volume in any of them, and adds `cmsVolume` (all codes) and `cmsCodeVolumes` (each requested code's volume) to every result. Volume is Medicare services plus Medicaid claims over every loaded year. A provider's index entry holds its 100 highest-volume codes, so a code it bills rarely may not match, and CMS omits low-volume rows. Requires a signed-in user or API key (401 otherwise). Returns 503 while the search index does not yet hold CMS volume.
- `sort`: array of objects - Sort order as a list holding one `{field, direction}` entry. Only one sort entry is supported; a request with more than one returns 400.
  - `field` **(required)**: string (cmsVolume) - Order by CMS volume (Medicare services plus Medicaid claims, all loaded years): volume in `cmsCodes` when given, otherwise total volume. Medicare counts services, so each billing unit of a drug (a J code) or lab test counts as one and drug- or lab-heavy providers rank high on total volume. Providers without volume come last. Not allowed with `near`. Returns 503 while the search index does not yet hold CMS volume. Not available to trial accounts (403) or unauthenticated requests (401).
  - `direction`: string (asc, desc) - Defaults to `desc`, highest first.
- `searchTerm`: string - Search term to match against provider names or NPIs.
- `matchFields`: array - Fields used for text matching. Defaults to displayName, ccns, otherNames, and tins.
- `includeFields`: array - List of fields to include in the response. `npi`, `displayName`, and `state` are always returned.
- `taxonomies`: the provider's taxonomy codes.
- `ccns`: CMS Certification Numbers linked to the NPI.
- `practiceAddress`, `mailingAddress`: NPPES addresses.
- `topCodes`: up to 20 codes the provider bills most, as `{code, type}` entries (for example `{"code": "99213", "type": "CPT"}`), ranked by Medicare, Medicaid, and commercial claim volume, or the specialty's most billed codes when the provider has no claims. Requires a signed-in user or API key.
- `taxonomyCodes`: array - List of taxonomy codes to filter by
- `states`: array of State enum: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA... - List of two-letter state codes to filter by
- `counties`: array - List of county names to filter by
- `entityTypes`: array - Filter by provider entity types
- `inNetworkPayers`: array of Payer enum: BCBS, United, Aetna, Cigna, FirstHealth, BannerHealth, MeritainHealth, Centene, Fidelis, Ambetter... - Restrict results to entries whose inNetworkPayers contains at least one of the given payers.
- `limit`: number - Maximum number of results to return. Defaults to 100; a value above 3,000 returns 400.

#### Example 1: Search for NPI by name

```json
{
  "searchTerm": "Chu Chen",
  "includeFields": [
    "npi",
    "displayName",
    "credentials",
    "state",
    "counties",
    "taxonomies",
    "inNetworkPayers",
    "tins",
    "topCodes"
  ],
  "states": [
    "MA"
  ],
  "limit": 50
}
```

#### Example 2: Find an organization NPI with its addresses, CCNs, and related NPIs

```json
{
  "searchTerm": "Massachusetts General Hospital",
  "entityTypes": [
    "group"
  ],
  "includeFields": [
    "npi",
    "displayName",
    "entityType",
    "ccns",
    "relatedNpis",
    "practiceAddress",
    "mailingAddress",
    "otherNames"
  ],
  "states": [
    "MA"
  ],
  "limit": 10
}
```

#### Responses

- **200**: List of matching providers
- **400**: Invalid request parameters
- **401**: `sort` or `cmsCodes` without a signed-in user or API key
- **402**: Not enough API credit for this request.
- **403**: `sort` from a trial account
- **429**: Request rate limit exceeded; retry after backing off.
- **503**: `cmsCodes` or `sort` field `cmsVolume` while the search index does not yet hold CMS volume

---

### POST /api/v1/ccns {#post-apiv1ccns}

Retrieve hospitals and other Medicare-certified facilities by CMS Certification Number (CCN). The response is a list with one entry per facility found, in request order. A CCN with no facility record is left out.

Every result includes `ccn`, `name`, `city`, `state`, and `npi` (the facility's organization NPI, when known). Add `includeFields` values for more details. A five-digit CCN missing its leading zero, such as `50690`, is looked up as `050690`; any other malformed CCN fails the request with 400. An empty `ccns` array or an empty filter array returns `[]`.

To find a CCN by name, location, or facility type, use `POST /api/v1/ccnSearch`.

#### Request Body

- `ccns` **(required)**: array - CMS Certification Numbers: six characters, such as `050454` or `21T101`. Five-digit forms missing the leading zero are accepted. Duplicates are removed.
- `ccnCategories`: array of CcnCategory enum: Psychiatric Unit in Critical Access Hospital, Rehabilitation Unit in Critical Access Hospital, Psychiatric Unit, Rehabilitation Unit, Swing-Bed Hospital Designation for Short-Term Hospitals, Swing-Bed Hospital Designation for Long Term Care Hospitals, Swing-Bed Hospital Designation for Rehabilitation Hospitals,  - Return only facilities with one of these CMS unit designations. Include `null` to keep facilities without one.
- `ccnFacilityTypes`: array of CcnFacilityType enum: Short-term (General and Specialty) Hospitals, Critical Access Hospitals, Children's Hospitals (Excluded from PPS), Psychiatric Hospitals (Excluded from PPS), Rehabilitation Hospitals (Excluded from PPS), Long-Term Hospitals (Excluded from PPS),  - Return only facilities with one of these CMS hospital categories. Include `null` to keep facilities without one.
- `includeFields`: array - Sections to add to each result. `ccn`, `name`, `city`, `state`, and `npi` (the facility's organization NPI) are always returned. An unknown value fails the request with 400.
- `street`, `zipCode`, `phone`: address and phone.
- `providerType`: CMS provider type, such as `Short Term Acute Care Hospital` or `Critical Access Hospital`.
- `ownership`, `bedCount`, `affiliatedHealthSystem`, `clinicalServices`.
- `careQuality`: CMS overall star rating.
- `imageUrls`: up to five photos (`imageUrl1` to `imageUrl5`) with their credits in `imageCredits`.
- `quality`: CMS quality results by care setting: the star rating, the headline measures, and every measure CMS reports with state averages, national ranks, and value-based program history.
- `inNetworkPayers`: payers that list the facility's NPI in network.
- `payerTins`: Tax IDs that payers list for the facility in their price files, with the payers and NPIs under each.
- `financials`: the latest Medicare cost report, as `summary` (CMS Hospital Provider Cost Report headline figures) and `detail` (HCRIS financial statements). Null when CMS has neither.
- `cmsProfile`: CMS Provider of Services data: accreditation, ownership, staffing, and service area. Null when CMS has no record.
- `medicareServices`: every Medicare inpatient DRG and outpatient APC CMS publishes for the facility, with volume and payments, most volume first, plus the hospital's CMS Inpatient Prospective Payment System (IPPS) Impact File figures such as case mix index and designations. Null when CMS has no record.
- `clinicians`: the number of clinicians CMS lists as affiliated with the facility, their top specialties, and up to 24 of them by name.
- `contractInfo`: negotiated-rate summaries by payer and service category, with the state average for comparison.
- `relatedHospitals`: up to four nearby hospitals of the same provider type.

Each section is returned only when requested.

#### Example: Look up two hospitals with address, type, services, photos, and in-network payers

```json
{
  "ccns": [
    "240010",
    "050454"
  ],
  "includeFields": [
    "street",
    "zipCode",
    "phone",
    "providerType",
    "ownership",
    "bedCount",
    "careQuality",
    "affiliatedHealthSystem",
    "clinicalServices",
    "inNetworkPayers",
    "imageUrls"
  ]
}
```

#### Example: Get CMS quality results and payer-listed Tax IDs for one hospital

```json
{
  "ccns": [
    "240010"
  ],
  "includeFields": [
    "quality",
    "payerTins"
  ]
}
```

#### Responses

- **200**: One entry per facility found, in request order. A CCN with no facility record is left out.
- **400**: Invalid request body or CCN
- **401**: Missing or invalid API key.
- **402**: Not enough API credit for this request.
- **403**: The API key cannot access this endpoint.
- **429**: Request rate limit exceeded; retry after backing off.

---

### POST /api/v1/ccnSearch {#post-apiv1ccnSearch}

Search hospitals and other Medicare-certified facilities by name, CCN, state, and facility type. Results are ordered by match quality: the facility's own name first, then its other names, then names it shares with another site, then by name.

Each `searchTerms` entry matches anywhere in the CCN, the facility's names and aliases, its health system, city, or state. Words within one term must appear in that order (`Mayo Rochester` matches `Mayo Clinic Hospital Rochester`), and a facility matching any term is returned. Without `searchTerms` or `ccn`, only facilities with six-digit CCNs are returned. A request with no search term, CCN, state, or type filter returns an empty list.

Several results can share one CCN when a hospital has more than one site; `facilityId` tells them apart. Organizations limited to certain states see facilities in those states only.

#### Request Body

- `sort`: array of objects - Sort order as a list holding one `{field, direction}` entry. Only one sort entry is supported; a request with more than one returns 400.
  - `field` **(required)**: string (bedCount, careQuality) - Order matches by licensed beds (`bedCount`) or by the CMS overall star rating (`careQuality`) instead of by name match. Facilities without the value come last. Each facility type is rated by its own CMS program (hospital, nursing home, dialysis, home health, and hospice star ratings differ), so filter `facilityTypes` to one type before ranking on `careQuality`. Ignored with `suggestionsOnly`. Not available to trial accounts (403) or unauthenticated requests (401).
  - `direction`: string (asc, desc) - Defaults to `desc`, highest first.
- `searchTerms`: array - Names, name words, cities, or CCN digits to match. A facility matching any term is returned.
- `ccn`: string - Exact CCN to match: six characters, or five digits missing the leading zero.
- `states`: array of State enum: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA... - Return facilities in any of these states.
- `facilityTypes`: array of FacilityType enum: HOSPITAL, NURSING_HOME, HOME_HEALTH, HOSPICE, DIALYSIS, ASC, HEALTH_CENTER, CLINIC, LONG_TERM_CARE, OTHER_CARE... - Return only facilities in these broad categories, such as `HOSPITAL`, `DIALYSIS`, or `ASC`.
- `ccnFacilityTypes`: array of CcnFacilityType enum: Short-term (General and Specialty) Hospitals, Critical Access Hospitals, Children's Hospitals (Excluded from PPS), Psychiatric Hospitals (Excluded from PPS), Rehabilitation Hospitals (Excluded from PPS), Long-Term Hospitals (Excluded from PPS),  - Return only facilities with one of these CMS hospital categories. Include `null` to keep facilities without one.
- `ccnCategories`: array of CcnCategory enum: Psychiatric Unit in Critical Access Hospital, Rehabilitation Unit in Critical Access Hospital, Psychiatric Unit, Rehabilitation Unit, Swing-Bed Hospital Designation for Short-Term Hospitals, Swing-Bed Hospital Designation for Long Term Care Hospitals, Swing-Bed Hospital Designation for Rehabilitation Hospitals,  - Return only facilities with one of these CMS unit designations. Include `null` to keep facilities without one.
- `inNetworkPayers`: array of Payer enum: BCBS, United, Aetna, Cigna, FirstHealth, BannerHealth, MeritainHealth, Centene, Fidelis, Ambetter... - Restrict results to facilities in network with at least one of the given payers, the payers `POST /api/v1/ccns` returns as `inNetworkPayers`. `BCBS` matches every Blue plan. It narrows another filter and is not a search on its own: a request with only `inNetworkPayers` returns no results. An unknown payer returns 400.
- `includeFields`: array - Optional fields to add to each result. `ccn`, `name`, `city`, `state`, and `affiliatedHealthSystem` are always returned. `careQuality` is the CMS overall star rating; `quality` adds CMS quality results by care setting.
- `limit`: integer - Maximum number of results to return. A value above 10,000 returns 400.
- `suggestionsOnly`: boolean - Return up to 10 lightweight prefix suggestions for one term. Identifiers require 3 digits; text requires 2 characters. Response fields and limit are fixed.

#### Example: Find a hospital by name in one state, with contact details and quality results

```json
{
  "searchTerms": [
    "Mayo Rochester"
  ],
  "states": [
    "MN"
  ],
  "facilityTypes": [
    "HOSPITAL"
  ],
  "includeFields": [
    "street",
    "zipCode",
    "phone",
    "providerType",
    "quality",
    "npi"
  ],
  "limit": 5
}
```

#### Example: List critical access hospitals in a state

```json
{
  "states": [
    "MT"
  ],
  "ccnFacilityTypes": [
    "Critical Access Hospitals"
  ],
  "includeFields": [
    "ownership",
    "bedCount",
    "careQuality"
  ],
  "limit": 100
}
```

#### Responses

- **200**: Matching facilities, at most the requested limit.
- **400**: Invalid request body, state, or CCN
- **401**: `sort` without a signed-in user or API key
- **402**: Not enough API credit for this request.
- **403**: `sort` from a trial account
- **429**: Request rate limit exceeded; retry after backing off.

---

### POST /api/v1/tins {#post-apiv1tins}

Retrieve provider information for one or more Taxpayer Identification Numbers (TINs). Note: CMS allows insurers to report provider TINs using either an NPI or Employer Identification Number (EIN).

The response is a list with one entry per Tax ID found, in request order; each entry carries its `tin`. A Tax ID absent from the data is left out.

#### Request Body

- `tins` **(required)**: array - Array of TIN numbers to query
- `includeFields`: array - List of fields to include in the response. Use numNpis for the number of NPIs billing under each TIN, primaryTaxonomyCodes for their primary taxonomy codes, and sampleOrganizationNpis for a sample of organization NPIs billing under each TIN, as `{npi, name}` entries.

`tinType`, `tinAddress`, `inNetworkPayers`, `sampleIndividualNpis`, and `topCodes` are the values `POST /api/v1/tinSearch` returns, and are absent for a TIN the provider directory has not indexed.
- `tinType`: `ein` or `npi`.
- `sampleIndividualNpis`: sample individual NPIs billing under the TIN, as `{npi, name}` entries.
- `topCodes`: up to 20 codes the TIN bills most, as `{code, type}` entries (for example `{"code": "99213", "type": "CPT"}`). Requires a signed-in user or API key.

#### Example 1: Query TIN information

```json
{
  "tins": [
    42103590,
    42484572,
    42774441
  ],
  "includeFields": [
    "tinName",
    "numNpis",
    "states",
    "primaryTaxonomyCodes",
    "sampleOrganizationNpis"
  ]
}
```

#### Example 2: Get a TIN's type, address, in-network payers, individual NPIs, and most billed codes

```json
{
  "tins": [
    42103590
  ],
  "includeFields": [
    "tinType",
    "tinAddress",
    "inNetworkPayers",
    "sampleIndividualNpis",
    "topCodes"
  ]
}
```

#### Responses

- **200**: Successfully retrieved TIN information
- **400**: Invalid request parameters
- **401**: Missing or invalid API key.
- **402**: Not enough API credit for this request.
- **403**: The API key cannot access this endpoint.
- **429**: Request rate limit exceeded; retry after backing off.

---

### POST /api/v1/tinSearch {#post-apiv1tinSearch}

Search TINs by name or exact TIN value, with optional provider taxonomy, state, or TIN type (ein/npi) filters.

#### Request Body

- `cmsCodes`: array - CPT or HCPCS codes, for example `["95004", "95024"]`. Keeps providers with Medicare or Medicaid volume in any of them, and adds `cmsVolume` (all codes) and `cmsCodeVolumes` (each requested code's volume) to every result. Volume is Medicare services plus Medicaid claims over every loaded year. A provider's index entry holds its 100 highest-volume codes, so a code it bills rarely may not match, and CMS omits low-volume rows. Requires a signed-in user or API key (401 otherwise). Returns 503 while the search index does not yet hold CMS volume.
- `sort`: array of objects - Sort order as a list holding one `{field, direction}` entry. Only one sort entry is supported; a request with more than one returns 400.
  - `field` **(required)**: string (npiCount, cmsVolume) - `npiCount` orders by the number of NPIs under the Tax ID (`tinSize`), largest first, instead of by name match; it requires `states` or `taxonomyCodes`, returns at most 100 Tax IDs (a `limit` above 100 returns 400), adds `tinSize` to each result, and returns 400 when too many very large Tax IDs match to rank. `cmsVolume` orders by CMS volume (Medicare services plus Medicaid claims, all loaded years): volume in `cmsCodes` when given, otherwise total volume. Medicare counts services, so each billing unit of a drug (a J code) or lab test counts as one and drug- or lab-heavy groups rank high on total volume. A Tax ID's volume credits the full volume of every NPI linked to it (connection score 70 or higher), and an NPI linked to several Tax IDs counts in each, so Tax ID volumes overlap and must not be summed; it is not limited to the searched state. Returns 503 while the search index does not yet hold CMS volume. Not available to trial accounts (403) or unauthenticated requests (401).
  - `direction`: string (asc, desc) - Applies to `cmsVolume` only; returns 400 with `npiCount`. Defaults to `desc`, highest first.
- `searchTerm`: string - Term to match against organization names (fuzzy match). Provide either `searchTerm` (single) or `searchTerms` (multiple).
- `searchTerms`: array - Multiple terms to match against organization names. Use instead of `searchTerm` when querying several names at once.
- `tins`: array - Exact TIN values to include, as numbers.
- `matchFields`: array - Fields used for text matching. Defaults to tinName and tinValue.
- `taxonomyCodes`: array - Taxonomy codes to filter by (optional).
- `states`: array of State enum: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA... - Two-letter state codes to filter by (optional).
- `tinTypes`: array - TIN type filter. `ein` = Employer Identification Number, `npi` = National Provider Identifier.
- `inNetworkPayers`: array of Payer enum: BCBS, United, Aetna, Cigna, FirstHealth, BannerHealth, MeritainHealth, Centene, Fidelis, Ambetter... - Restrict results to entries whose inNetworkPayers contains at least one of the given payers. `BCBS` matches every Blue plan. It narrows another filter and is not a search on its own: a request with only `inNetworkPayers` returns no results. An unknown payer returns 400. API keys may send one payer per request.
- `limit`: number - Maximum number of results to return. Defaults to 100; a value above 3,000 returns 400.
- `includeFields`: array - Fields to include in the response. `tinValue`, `tinType`, `tinName`, `tinState`, and `tinTaxonomyCodes` are always returned.
- `tinSize`: number of providers billing under the TIN.
- `sampleIndividualNpis`, `sampleOrganizationNpis`: sample individual and organization NPIs billing under the TIN, as `{npi, name}` entries.
- `topCodes`: up to 20 codes the TIN bills most, as `{code, type}` entries (for example `{"code": "99213", "type": "CPT"}`). Requires a signed-in user or API key.

#### Example 1: Search for TIN by name, type and state

```json
{
  "searchTerm": "Medical Group",
  "tinTypes": [
    "ein"
  ],
  "states": [
    "CA"
  ],
  "includeFields": [
    "tinValue",
    "tinType",
    "tinName",
    "tinState",
    "tinAddress",
    "tinTaxonomyCodes",
    "tinSize"
  ],
  "limit": 50
}
```

#### Example 2: Get a TIN's in-network payers, sample NPIs, and most billed codes

```json
{
  "searchTerm": "Mass General Physicians Organization",
  "states": [
    "MA"
  ],
  "includeFields": [
    "tinValue",
    "tinName",
    "inNetworkPayers",
    "sampleIndividualNpis",
    "sampleOrganizationNpis",
    "topCodes"
  ],
  "limit": 5
}
```

#### Responses

- **200**: List of matching TINs
- **400**: Invalid request parameters
- **401**: `sort` or `cmsCodes` without a signed-in user or API key
- **402**: Not enough API credit for this request.
- **403**: `sort` from a trial account
- **429**: Request rate limit exceeded; retry after backing off.
- **503**: `cmsCodes` or `sort` field `cmsVolume` while the search index does not yet hold CMS volume

---

## Billing Code APIs

Search billing codes by code or description, with the taxonomies that bill each code most. Suited for code pickers and for finding the codes to pass to the pricing APIs.

### POST /api/v1/billingCode/search {#post-apiv1billingCodesearch}

Find billing codes by code or by words in their description, ranked for autocomplete.

Each entry in `searchTerms` is matched separately, and a code is returned when it matches any of them:
- A code, or the start of one (`9921`), matches codes that begin with it.
- Words match codes whose description or category contains every word (`office visit`). A term with fewer than three letters is matched as a code only.
- A code type in a term (`99213 CPT`) limits the results to that type.

If your organization's plan is limited to certain billing codes, only those codes are returned.

#### Request Body

- `searchTerms` **(required)**: array - Codes, partial codes, or description words. Each term is matched separately and a code is returned when it matches any term. Only the first 40 characters of each term are used.
- `codeTypes`: array - Only return codes of these types. Defaults to every type. Each returned `{code, type}` can be sent as-is in `billingCodeAndTypes` on the rate endpoints.
- `limit`: integer - Maximum number of codes to return.
- `includeFields`: array - Optional fields to add to each result.
- `topTaxonomies`: taxonomy codes of the providers that bill the code most, highest first. Absent when no ranking is available for the code.

#### Example 1: Search CPT and HCPCS codes by description

```json
{
  "searchTerms": [
    "office visit"
  ],
  "codeTypes": [
    "CPT",
    "HCPCS"
  ],
  "limit": 10,
  "includeFields": [
    "topTaxonomies"
  ]
}
```

#### Example 2: Search by the start of a code

```json
{
  "searchTerms": [
    "9921",
    "9922"
  ],
  "limit": 20,
  "includeFields": [
    "topTaxonomies"
  ]
}
```

#### Responses

- **200**: Matching billing codes, best match first
- **400**: Invalid request parameters
- **401**: Missing or invalid API key.
- **402**: Not enough API credit for this request.
- **403**: The API key cannot access this endpoint.
- **429**: Request rate limit exceeded; retry after backing off.

---

## Pricing APIs

Retrieve negotiated rates and market statistics. Includes market-wide benchmarks (percentiles, averages, min/max), provider-specific rates (by NPI, TIN, or CCN), individual rate records across a market segment, and hospital-published rates from price transparency files.

### POST /api/v1/market/benchmarks {#post-apiv1marketbenchmarks}

Search for market-level aggregate statistics and benchmarks. Results summarize published rates in the selected payer, geography, taxonomy, billing-code, and period cohort; they are not prices for a specific provider or a guarantee of claim payment. Published rates of $0 (bundled or not paid separately) are left out of the statistics. Keep billing class, service code, modifier, and negotiated type comparable when interpreting percentiles. An empty result may reflect an overly narrow filter or missing published data.

#### Request Body

- `limit`: integer - Maximum number of groups to return. A group is one combination of the `groupBy` values and always keeps all of its metric rows, so the response can hold more rows than `limit`. API-key requests default to 1,000 groups; a value above 10,000 returns 400. When a limit applies, groups without a `sort` are ordered by their group values so pages are stable, and the response headers `X-Total-Count` (matching groups) and `X-Has-More` (`true` or `false`) say whether more remain.
- `offset`: integer - Number of groups to skip before the page starts.
- `sort`: array of objects - Sort order as a list holding one `{field, direction}` entry. Only one sort entry is supported; a request with more than one returns 400.
  - `field` **(required)**: string (avg_rate, median_rate, max_rate, min_rate, num_distinct_rates, num_distinct_npis, num_distinct_tins, num_entries, percentile_1, percentile_2...) - Order the groups by one of the requested `metrics.aggregations` (for example `percentile_50`). A group's rows stay together; groups with the same value are ordered by their group fields, and groups without the value come last. The groups are ordered after the query runs. Returns 400 when the value is not among the requested aggregations. Not available to trial accounts (403) or unauthenticated requests (401).
  - `direction`: string (asc, desc) - Defaults to `desc`, highest first.
- `filters` **(required)**: object - 
  - `states` **(required)**: array of State enum: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA... - Array of US state codes to filter by (required for market benchmarks).
  - `zipCodes`: array - 5-digit US ZIP codes to filter results by provider location (e.g., 02451, 90210).
  - `counties`: array of objects - Counties providers must be located in, as state and county pairs (e.g., [{"state": "VA", "county": "Fairfax County"}]). Narrows states; each county's state must also be in states.
    - `state` **(required)**: State enum: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA... - Two-letter state code of the county. It must also be listed in states.
    - `county` **(required)**: string - Census county name, e.g. Fairfax County, Fairfax city, or Orleans Parish. Case, accents, and Saint/St. are ignored; the suffix may be omitted when only one county in the state has that name.
  - `metroAreaMsaCodes`: array - Metropolitan Statistical Areas providers must be located in, as five-digit metropolitan CBSA codes (e.g., 47900 for Washington-Arlington-Alexandria). Use the metro area code, not a metropolitan division code such as 47894. Narrows states, which must include at least one of the metro area's states.
  - `taxonomyCodes` **(required)**: array of TaxonomyCode enum: 193200000X, 193400000X, 207K00000X, 207KA0200X, 207KI0005X, 207L00000X, 207LA0401X, 207LC0200X, 207LH0002X, 207LP2900X... - Array of provider taxonomy codes (required for market benchmarks).
  - `payers` **(required)**: array of Payer enum: BCBS, United, Aetna, Cigna, FirstHealth, BannerHealth, MeritainHealth, Centene, Fidelis, Ambetter... - Array of payer identifiers (required).
  - `billingCodeAndTypes` **(required)**: array of objects - Specific billing codes to search for (required).
    - `code` **(required)**: string - Billing code (e.g., 99213)
    - `type` **(required)**: BillingCodeType enum: CPT, HCPCS, RC, MS-DRG, APR-DRG, AP-DRG, DRG, NDC, CDT, APC... - 
  - `entityTypes`: array of EntityType enum: individual, group - Individual or group practice filter (optional)
  - `billingClasses`: array of BillingClass enum: professional, institutional - Professional vs institutional (optional). Rates a payer published for `both` classes are returned under either.
  - `serviceCodes`: array of ServiceCode enum: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10... - Place of service codes (e.g., office, hospital, telehealth) to search for (optional) Rates published with no place of service or `CSTM-00` apply at every place of service and are always returned; group by `serviceCode` to tell them apart.
  - `billingCodeModifiers`: array of BillingCodeModifier enum: none, TC, 26 - CPT modifiers to search for (optional)
  - `negotiatedTypeGroups`: array of NegotiatedTypeGroup enum: dollar, derived, per diem, percentage - Rate type groups to search for (optional), e.g. ["dollar"]. Prefer this to negotiatedTypes. 'dollar' covers negotiated, fee schedule, and every other dollar type; 'per diem' and 'percentage' values are not dollars per service.
  - `negotiatedTypes`: array of NegotiatedType enum: negotiated, derived, fee schedule, percentage, per diem - Raw rate negotiation types to search for (optional); prefer negotiatedTypeGroups unless negotiated and fee schedule rates must be separated. When both are set, a rate must match both.
  - `yearMonths`: array of   - `year` **(required)**: integer - 4-digit year (e.g., 2024, 2025).
  - `month` **(required)**: integer - Month number, 1-12 (1=January, 12=December). - Year/month periods to filter by (optional). Leave empty to query the latest available data; supply specific periods only when comparing rates across time.
  - `planNames`: array - Normalized plan names to narrow results to specific insurance plans (optional).
  - `networks`: array - Individual (un-normalized) network names to narrow results to specific networks, exactly as reported in the payer transparency file (optional).
- `metrics` **(required)**: object - 
  - `aggregations` **(required)**: array - Statistical metrics to calculate (required for market benchmarks)
  - `comparedTo`: string (none, medicare_2026, medicare_2025, medicare_2024, medicare_2023, medicare_2022, medicare_2021, medicare_2020) - Optional. `medicare_<year>` returns every rate statistic as a percent of the national non-facility Medicare Physician Fee Schedule amount for that year (145 means 145%). Omit or use `none` for dollar values.
- `groupBy`: array of GroupByField enum: payer, npiState, taxonomyCode, entityType, negotiatedType, negotiatedTypeGroup, billingClass, billingCodeType, billingCode, billingCodeGroup... - Fields to group results by (optional). Including network returns a separate benchmark group for each individual network name.

#### Example: Market Benchmarks for Office Visits

```json
{
  "filters": {
    "states": [
      "MA"
    ],
    "taxonomyCodes": [
      "208000000X"
    ],
    "payers": [
      "United",
      "Cigna"
    ],
    "billingCodeAndTypes": [
      {
        "code": "99213",
        "type": "CPT"
      },
      {
        "code": "99214",
        "type": "CPT"
      }
    ],
    "serviceCodes": [
      "11"
    ],
    "negotiatedTypeGroups": [
      "dollar"
    ],
    "billingClasses": [
      "professional"
    ]
  },
  "metrics": {
    "aggregations": [
      "percentile_50",
      "percentile_75",
      "percentile_90",
      "percentile_95"
    ]
  },
  "groupBy": [
    "payer",
    "billingCode"
  ]
}
```

#### Responses

- **200**: Array of market benchmark results.
- **400**: Invalid request parameters or query limits exceeded.
- **401**: User not authenticated or invalid API key
- **402**: Not enough API credit for this request.
- **403**: User does not have permission to access this endpoint
- **429**: Request rate limit exceeded; retry after backing off.

---

### POST /api/v1/provider/rates {#post-apiv1providerrates}

Search for published provider-specific negotiated rates by NPI, TIN, or CCN. Preserve the matched provider identifier, payer, plan or network, billing code and type, billing class, service code, modifier, negotiated type, and source period when comparing rows. Multiple rows for one payer and code may represent different contracts or contexts. A published rate does not by itself establish a claim's allowed or paid amount. For cursor pagination, send `pagination: {}` (default page size 1,000), then repeat the same request with `pagination.cursor` set to the returned `nextCursor` until it is null. Each page is billed separately. The organization's configured maximum can be lower or higher than 1,000, up to 10,000. Without `pagination`, the legacy array response is unchanged.

#### Request Body

- `sort`: array of objects - Sort order as a list holding one `{field, direction}` entry. Only one sort entry is supported; a request with more than one returns 400.
  - `field` **(required)**: string (negotiatedRate) - Order rows by rate instead of by provider and group fields; rows with the same rate keep the provider and group order, and rows without a rate come last. Applied before pagination; a cursor is valid only for the same sort. Not available to trial accounts (403) or unauthenticated requests (401).
  - `direction`: string (asc, desc) - Defaults to `desc`, highest first.
- `providers` **(required)**: object - Provider identifiers to query rates for. At least one provider identifier (NPI, TIN, or CCN) must be specified.
  - `npis`: array - NPIs to query negotiated rates for (optional, specify at least one of npis, tins, or ccns)
  - `tins`: array - TINs to query negotiated rates for (optional, specify at least one of npis, tins, or ccns)
  - `ccns`: array - CCNs to query negotiated rates for (optional, specify at least one of npis, tins, or ccns)
- `payers` **(required)**: array of Payer enum: BCBS, United, Aetna, Cigna, FirstHealth, BannerHealth, MeritainHealth, Centene, Fidelis, Ambetter... - Array of payer identifiers (required)
- `billingCodeAndTypes` **(required)**: array of objects - Specific billing codes to search for (required)
  - `code` **(required)**: string - Billing code (e.g., 99213)
  - `type` **(required)**: BillingCodeType enum: CPT, HCPCS, RC, MS-DRG, APR-DRG, AP-DRG, DRG, NDC, CDT, APC... - 
- `billingClasses`: array of BillingClass enum: professional, institutional - Professional vs institutional (optional). Rates a payer published for `both` classes are returned under either.
- `serviceCodes`: array of ServiceCode enum: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10... - Place of service codes to filter by (optional) Rates published with no place of service or `CSTM-00` apply at every place of service and are always returned; group by `serviceCode` to tell them apart.
- `billingCodeModifiers`: array of BillingCodeModifier enum: none, TC, 26 - Billing code modifiers to filter by (optional)
- `negotiatedTypeGroups`: array of NegotiatedTypeGroup enum: dollar, derived, per diem, percentage - Rate type groups to search for (optional), e.g. ["dollar"]. Prefer this to negotiatedTypes. 'dollar' covers negotiated, fee schedule, and every other dollar type; 'per diem' and 'percentage' values are not dollars per service.
- `negotiatedTypes`: array of NegotiatedType enum: negotiated, derived, fee schedule, percentage, per diem - Raw rate negotiation types to search for (optional); prefer negotiatedTypeGroups unless negotiated and fee schedule rates must be separated. When both are set, a rate must match both.
- `yearMonths`: array of - `year` **(required)**: integer - 4-digit year (e.g., 2024, 2025).
- `month` **(required)**: integer - Month number, 1-12 (1=January, 12=December). - Year/month periods to filter by (optional). Leave empty to query the latest available data; supply specific periods only when comparing rates across time.
- `planNames`: array - Normalized plan names to narrow results to specific insurance plans (optional).
- `networks`: array - Individual (un-normalized) network names to narrow results to specific networks, exactly as reported in the payer transparency file (optional).
- `groupBy`: array of ProviderGroupByField enum: payer, npiState, taxonomyCode, entityType, negotiatedType, negotiatedTypeGroup, billingClass, billingCodeType, billingCode, billingCodeGroup... - Fields to group results by (optional). Including network or planName adds the corresponding deduplicated array without splitting otherwise-identical provider-rate groups. planName arrays are sorted and limited to at most 30 names.
- `pagination`: object - Opt in to cursor pagination. Omit for the legacy array response.
  - `pageSize`: integer - Rows per page. Limited by the organization's configured maximum; defaults to the smaller of 1,000 and that maximum.
  - `cursor`: string - Opaque nextCursor from the preceding page. Keep every other request field unchanged.

#### Example 1: Rates for Specific Provider (NPI)

```json
{
  "providers": {
    "npis": [
      1073502985
    ]
  },
  "payers": [
    "United"
  ],
  "billingCodeAndTypes": [
    {
      "code": "99213",
      "type": "CPT"
    },
    {
      "code": "99214",
      "type": "CPT"
    }
  ],
  "serviceCodes": [
    "11"
  ],
  "negotiatedTypeGroups": [
    "dollar"
  ],
  "billingClasses": [
    "professional"
  ],
  "groupBy": [
    "payer",
    "billingCode",
    "serviceCode",
    "billingCodeModifier"
  ]
}
```

#### Example 2: Rates for Provider Group (TIN)

```json
{
  "providers": {
    "tins": [
      123456789
    ]
  },
  "payers": [
    "United",
    "Cigna"
  ],
  "billingCodeAndTypes": [
    {
      "code": "99211",
      "type": "CPT"
    },
    {
      "code": "99213",
      "type": "CPT"
    },
    {
      "code": "99214",
      "type": "CPT"
    },
    {
      "code": "99215",
      "type": "CPT"
    }
  ],
  "billingClasses": [
    "professional"
  ],
  "groupBy": [
    "payer",
    "billingCode"
  ]
}
```

#### Responses

- **200**: Legacy array response, or {data, sourceMonths, nextCursor} when pagination is supplied.
- **400**: Invalid request parameters or query limits exceeded.
- **401**: User not authenticated or invalid API key
- **402**: Not enough API credit for this request.
- **403**: User does not have permission to access this endpoint
- **429**: Request rate limit exceeded; retry after backing off.

---

### POST /api/v1/market/rates {#post-apiv1marketrates}

Search for provider-level negotiated rates by taxonomy and location. This endpoint returns individual rate records grouped by TIN, billing code, and payer. Use this endpoint to analyze rate distributions and identify specific rate values across a market segment. For cursor pagination, send `pagination: {}` (default page size 1,000), then repeat the same request with `pagination.cursor` set to the returned `nextCursor` until it is null. Each page is billed separately. The organization's configured maximum can be lower or higher than 1,000, up to 10,000. Do not combine `pagination` with legacy `limit`; without `pagination`, the legacy array response is unchanged.

#### Request Body

- `filters` **(required)**: object - 
  - `states` **(required)**: array of State enum: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA... - Array of US state codes to filter by (required).
  - `zipCodes`: array - 5-digit US ZIP codes to filter results by provider location (e.g., 02451, 90210).
  - `counties`: array of objects - Counties providers must be located in, as state and county pairs (e.g., [{"state": "VA", "county": "Fairfax County"}]). Narrows states; each county's state must also be in states.
    - `state` **(required)**: State enum: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA... - Two-letter state code of the county. It must also be listed in states.
    - `county` **(required)**: string - Census county name, e.g. Fairfax County, Fairfax city, or Orleans Parish. Case, accents, and Saint/St. are ignored; the suffix may be omitted when only one county in the state has that name.
  - `metroAreaMsaCodes`: array - Metropolitan Statistical Areas providers must be located in, as five-digit metropolitan CBSA codes (e.g., 47900 for Washington-Arlington-Alexandria). Use the metro area code, not a metropolitan division code such as 47894. Narrows states, which must include at least one of the metro area's states.
  - `taxonomyCodes` **(required)**: array of TaxonomyCode enum: 193200000X, 193400000X, 207K00000X, 207KA0200X, 207KI0005X, 207L00000X, 207LA0401X, 207LC0200X, 207LH0002X, 207LP2900X... - Array of provider taxonomy codes (required).
  - `entityTypes`: array - Provider entity types to search for.
  - `payers` **(required)**: array of Payer enum: BCBS, United, Aetna, Cigna, FirstHealth, BannerHealth, MeritainHealth, Centene, Fidelis, Ambetter... - Array of payer identifiers (required).
  - `billingCodeAndTypes` **(required)**: array of objects - Specific billing codes to search for. At least one entry is required.
    - `code` **(required)**: string - Billing code (e.g., 99213)
    - `type` **(required)**: BillingCodeType enum: CPT, HCPCS, RC, MS-DRG, APR-DRG, AP-DRG, DRG, NDC, CDT, APC... - 
  - `billingClasses`: array of BillingClass enum: professional, institutional - Array of billing classes (professional/institutional). Rates a payer published for `both` classes are returned under either filter; each row keeps its own `billingClass`, so those rows read `both`.
  - `serviceCodes`: array - Array of place of service codes (e.g., 11 for office, 21 for hospital). Rates published with no place of service or `CSTM-00` apply at every place of service and are always returned. `serviceCode` is aggregated by default, so one row can read "11, CSTM-00"; leave `serviceCode` out of `aggregatedColumns` to get one row per place of service.
  - `billingCodeModifiers`: array - Array of CPT modifiers to filter by.
  - `negotiatedTypeGroups`: array of NegotiatedTypeGroup enum: dollar, derived, per diem, percentage - Rate type groups to search for (optional), e.g. ["dollar"]. Prefer this to negotiatedTypes. 'dollar' covers negotiated, fee schedule, and every other dollar type; 'per diem' and 'percentage' values are not dollars per service.
  - `negotiatedTypes`: array of NegotiatedType enum: negotiated, derived, fee schedule, percentage, per diem - Raw rate negotiation types to search for (optional); prefer negotiatedTypeGroups unless negotiated and fee schedule rates must be separated. When both are set, a rate must match both.
  - `yearMonths`: array of   - `year` **(required)**: integer - 4-digit year (e.g., 2024, 2025).
  - `month` **(required)**: integer - Month number, 1-12 (1=January, 12=December). - Array of year-month periods to search.
  - `planNames`: array - Normalized plan names to narrow results to specific insurance plans (optional).
  - `networks`: array - Individual (un-normalized) network names to narrow results to specific networks, exactly as reported in the payer transparency file (optional).
- `aggregatedColumns`: array - Optional columns to aggregate into delimited lists. Defaults to serviceCode, billingCodeModifier, and reportingEntity. Include network only when network output is needed because it resolves network_names_arr.
- `rateAggregation`: string (maximum, minimum, average, median) - Method used to aggregate negotiated rates.
- `sort`: array of objects - Sort order as a list holding one `{field, direction}` entry, applied before pagination. Only one sort entry is supported; a request with more than one returns 400. Omit to order by `npi` ascending.
  - `field` **(required)**: string (payer, tin, billingTypeCode, negotiatedType, billingClass, negotiatedRate, npi, serviceCode, billingCodeModifier) - 
  - `direction`: string (asc, desc) - Defaults to `desc`, highest first.
- `limit`: integer - Offset pagination: number of rows to return. A value above 100 returns 400. Do not combine with `pagination`.
- `offset`: integer - Offset pagination: number of rows to skip before the page starts. Do not combine with `pagination`.
- `pagination`: object - Opt in to cursor pagination. Do not combine with `limit` or `offset`.
  - `pageSize`: integer - Rows per page. Limited by the organization's configured maximum; defaults to the smaller of 1,000 and that maximum.
  - `cursor`: string - Opaque nextCursor from the preceding page. Keep every other request field unchanged.

#### Example: Market Rates for Office Visits

```json
{
  "filters": {
    "states": [
      "MA"
    ],
    "taxonomyCodes": [
      "208000000X"
    ],
    "payers": [
      "United",
      "Cigna"
    ],
    "billingCodeAndTypes": [
      {
        "code": "99213",
        "type": "CPT"
      },
      {
        "code": "99214",
        "type": "CPT"
      }
    ],
    "serviceCodes": [
      "11"
    ],
    "negotiatedTypeGroups": [
      "dollar"
    ],
    "billingClasses": [
      "professional"
    ]
  },
  "limit": 10
}
```

#### Responses

- **200**: Legacy array response, or {data, nextCursor} when pagination is supplied.
- **400**: Invalid request parameters or query limits exceeded.
- **401**: User not authenticated or invalid API key
- **402**: Not enough API credit for this request.
- **403**: User does not have permission to access this endpoint
- **429**: Request rate limit exceeded; retry after backing off.

---

### POST /api/v1/hospital/provider/rates {#post-apiv1hospitalproviderrates}

The standard charges specific hospitals publish in their own hospital price transparency files: gross charge, discounted cash price, minimum and maximum, and each payer's negotiated dollar amount, percentage, or estimated amount with its methodology. These are what the hospital publishes, apart from the payers' negotiated-rate files (`/provider/rates`).

One row per distinct published charge; its plans are listed in `plan`. Without `yearMonths`, each hospital's (by CCN) newest file among the latest two months is used, whatever the other filters match; `year` and `month` say which.

#### Request Body

- `providers` **(required)**: object - Hospitals to return charges for. Provide at least one of `npis`, `tins`, or `ccns`; an empty list is allowed beside another identifier.
  - `npis`: array - Hospital NPIs.
  - `tins`: array - Hospital TINs as integers without dashes.
  - `ccns`: array - Hospital CCNs (6 characters).
- `payers` **(required)**: array of Payer enum: BCBS, United, Aetna, Cigna, FirstHealth, BannerHealth, MeritainHealth, Centene, Fidelis, Ambetter... - Required. Payer identifiers. A payer also matches the hospital's Medicare Advantage and Medicaid plans of that payer; every Blue identifier reads the hospital's BCBS rates.
- `billingCodeAndTypes`: array of objects - Exact billing codes and their code system.
  - `code` **(required)**: string - Billing code (e.g., 99213)
  - `type` **(required)**: BillingCodeType enum: CPT, HCPCS, RC, MS-DRG, APR-DRG, AP-DRG, DRG, NDC, CDT, APC... - 
- `settings`: array - Care settings the hospital published the charge for. `inpatient` or `outpatient` also returns charges published for both settings or with no setting stated; `both` alone returns only charges published for both.
- `billingClasses`: array - `institutional` (facility) or `professional` charges. Either also returns charges published for `both`, and `institutional` returns charges with no billing class stated, which are facility charges; `both` alone returns only charges published for both.
- `methodologies`: array - How the payer-specific charge is paid, as the hospital published it.
- `yearMonths`: array of - `year` **(required)**: integer - 4-digit year (e.g., 2024, 2025).
- `month` **(required)**: integer - Month number, 1-12 (1=January, 12=December). - Hospital file months to search, at most 12. Omit to use each hospital's newest file among the latest two months, whatever the other filters match.
- `sort`: array of objects - Sort order as a list holding one `{field, direction}` entry; more than one returns 400. Not available to trial accounts (403).
  - `field` **(required)**: string (negotiatedDollar, negotiatedPercentage, estimatedAmount, standardChargeGross, standardChargeDiscountedCash) - Charge or rate field to order rows by. Rows without the value come last.
  - `direction`: string (asc, desc) - Defaults to `desc`, highest first.
- `limit`: integer - Rows to return, at most 1,000. A larger value returns 400.
- `offset`: integer - Rows to skip before the page starts.

#### Example 1: One hospital's charges for two codes

```json
{
  "providers": {
    "ccns": [
      "100154"
    ]
  },
  "payers": [
    "Aetna"
  ],
  "billingCodeAndTypes": [
    {
      "code": "71045",
      "type": "CPT"
    },
    {
      "code": "77067",
      "type": "CPT"
    }
  ]
}
```

#### Example 2: Highest negotiated dollar amounts first

```json
{
  "providers": {
    "ccns": [
      "370113"
    ]
  },
  "payers": [
    "United"
  ],
  "billingCodeAndTypes": [
    {
      "code": "871",
      "type": "MS-DRG"
    }
  ],
  "sort": [
    {
      "field": "negotiatedDollar",
      "direction": "desc"
    }
  ],
  "limit": 50
}
```

#### Responses

- **200**: One page of hospital-published charges.
- **400**: Invalid request parameters or query limits exceeded.
- **401**: User not authenticated or invalid API key
- **402**: Not enough API credit for this request.
- **403**: User does not have permission to access this endpoint
- **429**: Request rate limit exceeded; retry after backing off.

---

### POST /api/v1/hospital/market/rates {#post-apiv1hospitalmarketrates}

The charges every hospital in the given states publishes in its hospital price transparency file, for the payers and codes you specify. Use `/hospital/market/benchmarks` for typical values.

Without `yearMonths`, each hospital's (by CCN) newest file among the latest two months is used, whatever the other filters match. States outside the organization's state restrictions, or more states than the account allows, are rejected.

#### Request Body

- `filters` **(required)**: object - 
  - `states` **(required)**: array of State enum: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA... - Required. States of the hospitals.
  - `payers` **(required)**: array of Payer enum: BCBS, United, Aetna, Cigna, FirstHealth, BannerHealth, MeritainHealth, Centene, Fidelis, Ambetter... - Required. Payer identifiers. A payer also matches the hospital's Medicare Advantage and Medicaid plans of that payer; every Blue identifier reads the hospital's BCBS rates.
  - `billingCodeAndTypes`: array of objects - Exact billing codes and their code system.
    - `code` **(required)**: string - Billing code (e.g., 99213)
    - `type` **(required)**: BillingCodeType enum: CPT, HCPCS, RC, MS-DRG, APR-DRG, AP-DRG, DRG, NDC, CDT, APC... - 
  - `settings`: array - Care settings the hospital published the charge for. `inpatient` or `outpatient` also returns charges published for both settings or with no setting stated; `both` alone returns only charges published for both.
  - `billingClasses`: array - `institutional` (facility) or `professional` charges. Either also returns charges published for `both`, and `institutional` returns charges with no billing class stated, which are facility charges; `both` alone returns only charges published for both.
  - `methodologies`: array - How the payer-specific charge is paid, as the hospital published it.
  - `yearMonths`: array of   - `year` **(required)**: integer - 4-digit year (e.g., 2024, 2025).
  - `month` **(required)**: integer - Month number, 1-12 (1=January, 12=December). - Hospital file months to search, at most 12. Omit to use each hospital's newest file among the latest two months, whatever the other filters match.
- `sort`: array of objects - Sort order as a list holding one `{field, direction}` entry; more than one returns 400. Not available to trial accounts (403).
  - `field` **(required)**: string (negotiatedDollar, negotiatedPercentage, estimatedAmount, standardChargeGross, standardChargeDiscountedCash) - Charge or rate field to order rows by. Rows without the value come last.
  - `direction`: string (asc, desc) - Defaults to `desc`, highest first.
- `limit`: integer - Rows to return, at most 1,000. A larger value returns 400.
- `offset`: integer - Rows to skip before the page starts.

#### Example 1: A state's hospital charges for one code

```json
{
  "filters": {
    "states": [
      "TX"
    ],
    "payers": [
      "Aetna"
    ],
    "billingCodeAndTypes": [
      {
        "code": "74177",
        "type": "CPT"
      }
    ],
    "settings": [
      "outpatient"
    ]
  },
  "limit": 100
}
```

#### Responses

- **200**: One page of hospital-published charges.
- **400**: Invalid request parameters or query limits exceeded.
- **401**: User not authenticated or invalid API key
- **402**: Not enough API credit for this request.
- **403**: User does not have permission to access this endpoint
- **429**: Request rate limit exceeded; retry after backing off.

---

### POST /api/v1/hospital/market/benchmarks {#post-apiv1hospitalmarketbenchmarks}

Statistics over the charges hospitals in the given states publish in their hospital price transparency files. `metrics.field` picks the value; each hospital counts once per group, at its highest value. One row per `groupBy` combination, holding the `groupBy` values and each requested statistic under its own name: `billingCode` returns the code and `billingCodeType` you requested, combining the CPT and HCPCS labels and the 3- and 4-digit DRG and revenue code forms hospitals publish; `methodology` returns its public name (`feeSchedule`, `caseRate`, ...) when known; `ccn` returns one row per hospital, with its `hospitalName`. A request that matches nothing returns no rows (`total` 0).

Mixed rates: without `payer` and `methodology` in `groupBy`, one group mixes commercial, Medicare Advantage, and Medicaid rates, and fee-schedule, per-diem, and case-rate dollars, so its statistics describe no single contract type. Group by `payer` and `methodology` (or filter `methodologies`), and by `billingCode` and `setting` unless the filters fix them, before comparing values.

Without `yearMonths`, each hospital's (by CCN) newest file among the latest two months is used, whatever the other filters match. States outside the organization's state restrictions, or more states than the account allows, are rejected.

#### Request Body

- `filters` **(required)**: object - 
  - `states` **(required)**: array of State enum: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA... - Required. States of the hospitals.
  - `payers` **(required)**: array of Payer enum: BCBS, United, Aetna, Cigna, FirstHealth, BannerHealth, MeritainHealth, Centene, Fidelis, Ambetter... - Required. Payer identifiers. A payer also matches the hospital's Medicare Advantage and Medicaid plans of that payer; every Blue identifier reads the hospital's BCBS rates.
  - `billingCodeAndTypes`: array of objects - Exact billing codes and their code system.
    - `code` **(required)**: string - Billing code (e.g., 99213)
    - `type` **(required)**: BillingCodeType enum: CPT, HCPCS, RC, MS-DRG, APR-DRG, AP-DRG, DRG, NDC, CDT, APC... - 
  - `settings`: array - Care settings the hospital published the charge for. `inpatient` or `outpatient` also returns charges published for both settings or with no setting stated; `both` alone returns only charges published for both.
  - `billingClasses`: array - `institutional` (facility) or `professional` charges. Either also returns charges published for `both`, and `institutional` returns charges with no billing class stated, which are facility charges; `both` alone returns only charges published for both.
  - `methodologies`: array - How the payer-specific charge is paid, as the hospital published it.
  - `yearMonths`: array of   - `year` **(required)**: integer - 4-digit year (e.g., 2024, 2025).
  - `month` **(required)**: integer - Month number, 1-12 (1=January, 12=December). - Hospital file months to search, at most 12. Omit to use each hospital's newest file among the latest two months, whatever the other filters match.
- `metrics` **(required)**: object - 
  - `field`: string (negotiatedDollar, negotiatedPercentage, estimatedAmount, standardChargeGross, standardChargeDiscountedCash) - Value to compute statistics over.
  - `aggregations` **(required)**: array - Statistics to return. `num_hospitals` is the sample size.
- `groupBy` **(required)**: array - Dimensions to return one row per combination of. Include `payer` and `methodology` unless the filters fix them; without them a group mixes payer types and payment methodologies.
- `sort`: array of objects - Sort order as a list holding one `{field, direction}` entry; more than one returns 400. Not available to trial accounts (403).
  - `field` **(required)**: string (avg_rate, median_rate, min_rate, max_rate, percentile_1, percentile_5, percentile_10, percentile_15, percentile_20, percentile_25...) - One of the requested aggregations. Groups without the value come last.
  - `direction`: string (asc, desc) - Defaults to `desc`, highest first.
- `limit`: integer - Groups to return, at most 10,000. A larger value returns 400.
- `offset`: integer - Groups to skip before the page starts.

#### Example 1: Typical negotiated amounts for an MS-DRG by payer

```json
{
  "filters": {
    "states": [
      "TX"
    ],
    "payers": [
      "Aetna",
      "United"
    ],
    "billingCodeAndTypes": [
      {
        "code": "871",
        "type": "MS-DRG"
      }
    ]
  },
  "metrics": {
    "field": "negotiatedDollar",
    "aggregations": [
      "percentile_25",
      "percentile_50",
      "percentile_75",
      "num_hospitals"
    ]
  },
  "groupBy": [
    "payer",
    "billingCode"
  ]
}
```

#### Responses

- **200**: One page of benchmark groups.
- **400**: Invalid request parameters or query limits exceeded.
- **401**: User not authenticated or invalid API key
- **402**: Not enough API credit for this request.
- **403**: User does not have permission to access this endpoint
- **429**: Request rate limit exceeded; retry after backing off.

---

## Reference API

Retrieve CMS Medicare reference amounts across physician, drug, inpatient, anesthesia, and clinical laboratory schedules, and state Medicaid fee-for-service schedules. Medicare is available to every API key; Medicaid follows the organization's endpoint policy.

### POST /api/v1/price/medicare {#post-apiv1pricemedicare}

Retrieve CMS Medicare reference amounts for physician fee schedules, drug average sales prices, MS-DRG weights, anesthesia conversion factors, or clinical laboratory fee schedules. Available to every API key.

#### Request Body

- `medicareType` **(required)**: string (physician_ffs, drug_asp, anesthesia_conversion_factor, msdrg_weight, clinical_lab) - CMS fee schedule or reference dataset to query.
- `codes`: array - Optional HCPCS/CPT or MS-DRG codes to retrieve. For `anesthesia_conversion_factor`, codes are anesthesia CPT codes (00100-01999): each row then carries one code with its base units, and a code outside the anesthesia schedule returns no rows.
- `month`: integer - Optional release month filter.
- `years`: array - Optional release year filters. History reaches back to 2002 for `physician_ffs`, 2005 for `drug_asp`, 2006 for `anesthesia_conversion_factor`, FY2008 for `msdrg_weight` and 2001 for `clinical_lab`.
- `states`: array - Optional state filters for physician fee schedule, DMEPOS and anesthesia results. Use `national` for the physician national locality; for anesthesia, `national` returns the national factor alongside every locality.
- `limit`: integer - Maximum rows to return. Defaults to 100.
- `offset`: integer - Rows to skip before the page starts. Defaults to 0.
- `sort`: array of objects - Sort order as a list holding one `{field, direction}` entry, placed ahead of the schedule's default order (newest first). Only one sort entry is supported; a request with more than one returns 400.
  - `field` **(required)**: string (code, year) - `code` requires `codes` when `medicareType` is `anesthesia_conversion_factor`, whose rows otherwise carry no code.
  - `direction`: string (asc, desc) - Defaults to `desc`.

#### Example: Physician fees for two CPT codes in Massachusetts

```json
{
  "medicareType": "physician_ffs",
  "codes": [
    "99213",
    "99214"
  ],
  "years": [
    2026
  ],
  "states": [
    "MA"
  ],
  "limit": 100,
  "offset": 0
}
```

#### Example: MS-DRG relative weights

```json
{
  "medicareType": "msdrg_weight",
  "codes": [
    "470"
  ],
  "years": [
    2026
  ]
}
```

#### Responses

- **200**: Medicare reference results with the total row count.
- **400**: Invalid request body or an empty codes array.
- **401**: The API key is missing or invalid.
- **402**: The account does not have enough API credits.
- **403**: The caller lacks permission for this operation.
- **405**: Only POST is supported.
- **429**: The request exceeded the applicable rate limit.

---