# Before using real information

This prototype is intentionally for fictional data. Browser-local storage is not an authenticated patient data system, and the project makes no compliance claim.

Before a real pilot, decide and implement:

- User authentication, session security, per-user authorization, and authorization tests on every record/file access.
- An appropriate backend and storage design, encryption/key management, retention, deletion (including backups), and audit events that avoid logging identifiers or document content.
- Server-side file signature/content validation, malicious-file handling, request limits, and safe extraction resource limits. Browser MIME/size checks here improve UX but are not a server security boundary.
- Consent and a reviewed data-flow policy for every vendor. Evaluate the actual provider terms and contractual obligations before sending health-related information to any model or service.
- Same-origin hosted OCR assets, suitable content-security policy and security headers, and removal/review of third-party fonts/CDN dependencies. Current Google Fonts requests and OCR asset downloads are external network requests, even though document bytes are processed locally.
- Accurate document/version matching, coverage-period handling, user correction, retrieval citations, and controls for missing or conflicting evidence. Never equate user review with insurer verification.
- Error monitoring that excludes document text and personal data, dependency maintenance, accessibility testing, and an incident response process.

Today: one profile per browser origin, no user accounts, no server, no AI calls, no insurer integration, no cross-device syncing, no application-level encryption. Clearing site data removes the local plan. Anyone with access to this browser profile may access saved information. Private browsing and storage quotas may prevent persistence.
