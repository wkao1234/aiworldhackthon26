# AI World Hackathon 2026 · Audit Pack Studio

Repository: https://github.com/wkao1234/aiworldhackthon26

This browser app builds a bank reconciliation working pack PDF and a summary XLSX from user-supplied structured data and attached source files. It loads the supplied PBC workbook as a **requirements catalog**, not as transaction evidence. The 10 PBC requests, 57 individual assurance statements, and 17 metadata fields remain visible in both exports.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. Run `npm test` for checks and export fixtures, then `npm run build` for typecheck and production build. Tests write synthetic QA exports to the gitignored `.qa/` directory. `python scripts/verify_exports.py` checks their PDF text/layout bounds and workbook contents when `pypdf`, `pdfplumber`, and `openpyxl` are available.

## Deploy to Vercel

Import this GitHub repository into Vercel. Use the Vite preset or set build command `npm run build` and output directory `dist`. The app is static; no server, database, environment variable, API key, or live connector is required. Deploy preview branches from pull requests before merging.

## Intake workflow

1. Download `inputs/Hackathon PBC & Metadata.xlsx` to see the original requirements, or read them in the app. Its SHA-256 is `c9a61aec6827be06d5c819bae863c61e7ba174ecac872b548174afbf85a4f011`.
2. Enter engagement, entity, period, currency, expected material accounts, account-population evidence ID, and all available metadata fields.
3. Download the JSON template in the app, fill it with actual reconciliation, bank, GL, outstanding-item, and other PBC data, then import a `.json` file or edit and apply the JSON intake. Import is validated as one transaction: errors leave the previous working pack and attachments intact.
4. Attach each actual source file to its registered evidence ID. The browser computes SHA-256 and records capture time; it does **not** parse PDF or other generic attachments. Imported/declared hashes are distinguished from computed attachment hashes.
5. Review the check ledger and PBC criteria. For nonbank criteria, record a separate human assessment for each statement with checker, date, source evidence IDs, and notes. A single whole-PBC assertion cannot mark all statements passed.
6. Download the PDF and XLSX from the same current pack snapshot. Any edit changes the shared pack ID and snapshot timestamp. Reviewer signoff fields remain blank until an actual reviewer fills them.

The optional synthetic demo is explicitly marked in the UI and both exports. **Clear demo** removes all demo working data and attachments.

## JSON import schema

The downloadable template contains every supported field. At the top level:

| Field | Meaning |
| --- | --- |
| `engagement`, `entity`, `period`, `currency` | Pack scope; period uses `YYYY-MM`. |
| `expectedAccounts` | Array of material in-scope bank account IDs; empty means completeness is unverified. |
| `expectedAccountEvidenceId` | PBC-002 evidence ID for the attached account-population report. |
| `staleDays` | Integer ageing cutoff, 0–3650 days, measured at the reconciliation period end. |
| `metadata` | Object keyed by the 17 exact names from `Audit pack metadata!A2:B18`. |
| `reconciliations` | Array of account reconciliations. Each has unique `id`, scope fields, source balance fields, dates, outstanding items, and separate `evidenceIds` for `reconciliation`, `bank`, and `gl`. |
| `evidence` | Array of source records, each with unique `id`, `kind`, `pbcCode`, source identity, report parameters, source people/dates, original file/version, extraction timestamp, optional declared hash, and limitations. Bank/GL records include `sourceBalance`. |
| `pbcAssessments` | Array keyed by `criterionId` such as `PBC-001.1`; result, named checker/date, evidence IDs, note, possible reason, owner, remediation, resolution, and review status. |
| `demo` | Boolean marker for synthetic example data. |

Each reconciliation includes `bankClosingBalance`, `bankAdjustments`, `adjustedBankBalance`, `glClosingBalance`, and `reconciliationBalance` as **decimal strings**. The linked bank and GL evidence records have their own `sourceBalance` strings. Those distinct imports are compared with the values transcribed in the reconciliation. Attachment contents are not parsed, so these amounts remain user-imported source claims.

`outstandingItems` must be explicitly present, even as `[]`. Set `outstandingPopulationConfirmed: true` only when the zero-item population is affirmatively supported. Each item has unique `id`, signed `amount`, `date` (`YYYY-MM-DD`), `support` description, and attached `evidenceId`. `reviewSignoffEvidenceId` points to a separate attached review signoff record.

The **sign convention** is: `bankClosingBalance + bankAdjustments = adjustedBankBalance`, and signed outstanding-item amounts sum to `bankAdjustments`. Positive amounts increase the bank balance; negative amounts decrease it. Comparisons use integer cents with **zero tolerance** and BigInt for intermediate sums. Blank is missing, never zero. Dates must be real calendar dates; extraction timestamps require ISO 8601 with timezone. Duplicate IDs, malformed amounts/dates, and linked source scope inconsistencies are rejected at import. Unexpected accounts and source disagreements are visible as check exceptions in the engine.

For a nonbank human Passed assessment, link actual attached evidence with complete provenance and matching PBC/entity/period/currency/account scope. Use the exact required source-system names listed in the PBC catalog; every required system must be represented. Unsubstantiated claims remain `Needs evidence`, and unassessed statements remain `Not assessed`.

## What the results mean

- **Passed:** the stated deterministic comparison or adequately documented criterion-level human assessment passed within the imported data.
- **Exception:** an imported value, scope, review sequence, or supporting claim conflicts with its rule.
- **Needs evidence:** a required value, source record, source file, provenance field, or assessment detail is missing.
- **Not assessed:** no criterion-level human assessment was entered.

Results are working-paper checks, **not an audit opinion**. Source identities, timestamps, preparer/reviewer names and dates, and balances are user-imported claims. An attached file hash proves only which bytes were selected in this browser session. The app does not authenticate identities, verify source-system extraction, parse bank/GL documents, confirm account-population completeness independently, or infer a reviewer signoff. A user-entered `Final status` such as “audit-ready” is displayed as a declaration and never overrides computed exceptions or missing evidence.

All processing stays in the browser tab. No evidence is transmitted to an app backend or stored across reloads. Export files contain the entered financial and identity data, so store/share them according to the engagement's sensitive-data treatment. Keep real evidence under gitignored `evidence/`, `exports/`, or `.local/`, not in Git.

## Team workflow

The orchestrator assigns requirements. The coder implements on feature branches and opens pull requests. The reviewer checks requirements and reports decisions in its chat; the orchestrator coordinates fixes. Coder and reviewer share the `wkao1234` GitHub account, so formal GitHub approval of that account's own PR is not used.
