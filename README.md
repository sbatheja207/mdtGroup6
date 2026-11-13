# ClearCover · Group 6

A welcoming insurance intake prototype. Add insurance cards and plan documents, review extracted details, and save a local plan profile that future care tools can use.

**Student demo: use fictional information only.** This is not a production patient portal. It has no accounts, encrypted application storage, insurer connection, or AI integration.

## Run it for the first time

1. Install Node.js 22.12+ (Node 22 LTS recommended) and Git.
2. Open Terminal and run:

```sh
git clone https://github.com/sbatheja207/mdtGroup6.git
cd mdtGroup6
npm ci
npm run dev
```

3. Open the local URL printed by Vite (normally http://localhost:5173).
4. Click **Try a sample plan** for a fictional example. Review the fields, continue, check the acknowledgment, and save.
5. Stop the development server with **Ctrl+C**.

Already cloned? Open a terminal in that folder, run `git pull`, then `npm ci` and `npm run dev`. Do not clone inside an existing checkout. If port 5173 is occupied, Vite prints another available port.

For npm cache permission errors, use `npm ci --cache .npm-cache` and add `.npm-cache/` to your local ignore file. No API keys, paid accounts, or database setup are needed.

## What works

- Responsive sidebar/workspace and three-step insurance intake.
- Multiple card images (front/back) and PDF plan documents; up to six files, 10 MB each.
- English image OCR using Tesseract.js, on the user's device. The first image read downloads OCR worker/core/language assets from the library's default CDNs; it requires internet access. Images are not submitted to an OCR API.
- Text extraction from text-based PDFs using PDF.js, up to 100 pages per PDF. Scanned PDFs are retained but clearly flagged for manual entry; PDF OCR is not implemented.
- Conservative suggestions for labeled member ID, group/policy number, insurer, plan name, and member name. Blank fields stay blank when no match exists. Suggestions only fill blank fields and must be reviewed. Removing a document does not erase previously suggested fields; correct them on the details step.
- Manual entry for insurer, plan name, name on card, member ID, group/policy number, plan type, network, and coverage dates. Insurer and member ID are required; group and policy number are optional because not every plan supplies them.
- IndexedDB persistence of one reviewed profile, original file blobs, and extracted text. Edit, reload, and delete are supported. Unsaved changes are held in memory and lost on reload.
- Clearly labeled future modules for chat, cost estimates, and bill review.

## Test and build

```sh
npm test          # intake validation, identifier extraction, persistence/deletion
npm run build    # TypeScript check + production bundle
npm run preview  # serve the production build locally
```

An optional CI template is included at `docs/github-actions-template.yml`. To enable automatic checks, a teammate with GitHub workflow permission can copy it to `.github/workflows/ci.yml` and commit it. The current GitHub authorization does not allow creating workflows.

### Manual smoke test

1. Use the sample plan, review and save it. Reload: the profile should remain.
2. Edit a field and save again; reload and check it. Cancel an edit to restore the saved profile.
3. Delete the local plan, reload, and confirm the fresh intake appears.
4. Upload a fictional JPG/PNG card. Wait for extraction, expand the extracted text, and verify/correct the suggested IDs.
5. Upload a text-based PDF, then a scanned, locked, or corrupt PDF. Unreadable files should show a useful message and allow manual entry.
6. Try unsupported/empty/over-10-MB files and more than six files. They should be rejected.
7. Try empty required fields and an end date before the start date. Saving should be blocked.
8. Navigate using keyboard only and at phone width. Check the help and delete dialogs.

## How the app fits together

```text
src/
  App.tsx             workspace, intake, review, future-module placeholders
  styles.css          responsive design system
  main.tsx            React entry
  lib/
    plan.ts           shared PlanProfile contract, validation, extraction suggestions
    extract.ts        PDF text extraction, image OCR, upload limits
    storage.ts        local IndexedDB adapter: loadProfile/saveProfile/deleteProfile
    *.test.ts         meaningful validation and storage tests
```

See [the team handoff](docs/TEAM_HANDOFF.md) for integration boundaries and [production readiness](docs/PRODUCTION_READINESS.md) before moving beyond fictional data.

## Work together without overwriting each other

Start from the latest main branch and make a feature branch:

```sh
git switch main
git pull
git switch -c feature/plan-chat
# edit files, run tests and build
git add src docs
git commit -m "Add plan chat interface"
git push -u origin feature/plan-chat
```

Open a pull request on GitHub and have a teammate review it. Use separate feature components rather than putting all team code into `App.tsx`. Keep dependency lockfile changes in the same PR as dependency changes. Never commit uploaded documents, real member IDs, credentials, or API keys.

## What this app cannot tell you yet

An insurance card identifies a member and plan; it is not a complete benefits document. Member IDs, group numbers, and policy numbers alone do not grant API access to an insurer or prove eligibility. Coverage questions need the applicable plan documents and, eventually, an authorized source of current eligibility/benefits. The current app never marks coverage as verified.

No Gemini or OpenRouter models are connected. Add model calls behind an authenticated server, with agreed privacy controls, rather than placing keys in browser code.

## Library references

- [Tesseract.js worker API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md)
- [PDF.js examples](https://mozilla.github.io/pdf.js/examples/index.html)
- [Vite guide](https://vite.dev/guide/)
