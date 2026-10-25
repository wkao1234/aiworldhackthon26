# Audit pack application — implementation specification

## User outcome

Build an app that generates both a bank reconciliation audit pack PDF and an Excel summary workbook. The user's problem statement is:

> prepare a bank rec audit pack in pdf that Includes all of the elements stated in the pbc file, with timestamps, preparer and reviewer information from the reconciliation as well as the same information from the bank records and the GL account. each section of the pdf should have an evidence footprint from each of the specific systems that the data is being pulled from and then have a summary spreadsheet that documents what was checked, who checked it, what are the exceptions and what is the possible reason for the exception. leave room on this data pack for a reviewer sign off.

The user clarified: **Build the app that generates both deliverables.**

## Preserved source and interpretation

- Authoritative requirements input: `inputs/Hackathon PBC & Metadata.xlsx`, copied byte-for-byte from the user's Downloads folder.
- SHA-256: `c9a61aec6827be06d5c819bae863c61e7ba174ecac872b548174afbf85a4f011`.
- Machine-readable inspection: `inputs/workbook-extract.json`, produced by `scripts/inspect_workbook.py` without executing spreadsheet content.
- `PBC List!A1:F11` contains 10 audit use cases; `Audit pack metadata!A1:B18` contains 17 metadata requirements. This is requirements data, not actual bank/GL evidence, and cannot substantiate an audit conclusion.
- Focus automated financial checks on PBC-002 bank reconciliations. Include the entire supplied PBC catalog verbatim in coverage and the PDF/XLSX, with evidence and assessment intake for all areas. Other areas without supplied evidence remain Not started or Needs evidence; do not imply their assurance tests have passed.

## PBC coverage

Read the exact item names, audit areas, source systems, example evidence and assurance parameters from the source extract. Preserve row-level references. The catalog contains PBC-001 trial balance and mapping; PBC-002 bank reconciliations; PBC-003 AR; PBC-004 AP; PBC-005 fixed assets; PBC-006 journals; PBC-007 payroll; PBC-008 revenue; PBC-009 user access; PBC-010 change management.

PBC-002 (`PBC List!A3:F3`) specifically requires: all material accounts included; adjusted bank balance equals GL; reconciling items supported; stale items identified; account, currency and period consistent; independent review documented. Evidence includes December reconciliations, bank statements, GL cash detail, outstanding items and reviewer signoff. Source systems are treasury management system, ERP cash module and bank portal. Do not hardcode a current accounting period: source examples include December 2025 and January 2026 elsewhere.

## Application behavior

1. A polished, responsive, Vercel-compatible app with a clear intake → checks → evidence → exports flow, accessible labels and useful empty/error states.
2. The supplied workbook is retained in the project and loaded as its PBC catalog. Offer a visible source reference/download and full catalog coverage. Do not pretend the catalog itself is transactional evidence.
3. Let users enter engagement/entity/scope, population/sample, accounts/currency/period, owner, preparer, reviewer, preparation/review dates and auditor reference. Capture every metadata field in `Audit pack metadata!A2:B18`, including sensitive-data treatment, file versions and final status.
4. Accept actual reconciliation, bank and GL data through a documented structured import (JSON/CSV or XLSX) with a downloadable template, plus evidence file attachments. Explicitly explain supported formats. Do not pretend generic PDF attachments have been parsed or systems connected. In-browser processing is preferred for a practical MVP; no secret/API key is required for deterministic checks.
5. Model multiple in-scope bank accounts and an expected account list so completeness can be assessed. Distinguish missing values from actual numeric zero. Reject malformed amounts/dates, duplicates, inconsistent currencies/periods/accounts. Avoid floating-point tolerance mistakes; use cents/decimal arithmetic and documented reconciliation signs/tolerance.
6. Reconciliation entries carry bank statement closing balance, signed bank reconciling adjustments, adjusted bank balance, GL closing balance, reconciliation balance/reference and outstanding-item details (amount/date/support/evidence ID). Check arithmetic and GL agreement, source consistency, outstanding support, ageing (configurable cutoff), independent review and metadata completeness. Non-verifiable checks require explicit human assessment with named checker/date/evidence, or remain unverified.
7. Each reconciliation/bank/GL evidence record separately carries: source system, original filename/version, record/report ID and parameters, entity/account/currency/period, source extraction timestamp, source preparer/reviewer and dates, upload/capture time, file SHA-256, attachment reference and limitations. Source-provided fields are not verified identity. Do not substitute upload/generated time or OS file time for source extraction time.
8. A clearly labeled optional demo loads synthetic data with deliberate exceptions. Empty state must not look approved. Demo status/watermark must persist in both exports. Clearing demo resets the working data.
9. Results must distinguish Passed, Exception, Needs evidence and Not assessed. Each check has ID, PBC code, description, rule/expected value, observed value, checker (automated engine vs human), checked-at time, evidence IDs/source references, exception, possible reason labeled as a hypothesis, owner/remediation/resolution, review status. No unsupported assertion that the result is an audit opinion or verified live system extraction.
10. User edits/imports recompute results; exports match current state and share a pack ID/snapshot timestamp. Import validation errors must not silently discard evidence or mutate a valid prior state.

## PDF requirements

- Real downloadable PDF with engagement cover, report scope/limitations, provenance of requirements workbook, all 10 PBC coverage sections, bank reconciliation details by account, check results, evidence register and exceptions/remediation, and reviewer signoff space.
- Every PBC/account section has an evidence footprint: specific source-system names and evidence IDs/filenames, record parameters and extraction timestamps, preparer/reviewer with dates where supplied, hashes, plus explicit missing-field flags. A generic source label alone is insufficient.
- Include all 17 metadata fields, with clear missing labels. Show source identities separately from pack preparer/reviewer and automated checker.
- Full coverage text and long identifiers wrap/page-break correctly, repeated table headers/page numbers. No clipped rows, tiny unreadable text, or missing long content. Reviewer name/signature/date/decision/comment fields remain blank unless actual review data was supplied; export does not manufacture signoff.

## Summary XLSX requirements

- Real XLSX, not renamed CSV. Readable styled sheets for summary/check ledger, PBC coverage, evidence, metadata, exceptions and reviewer signoff.
- Checks include what was checked, who checked, check timestamp, result, exceptions and possible reasons, evidence references, owners and resolution. All 10 PBC items and 17 metadata fields represented.
- Numeric amounts must be numbers, dates consistently represented, explicit missing statuses. Escape untrusted formula-like strings; never execute workbook formulas/macros. Maintain traceability to the source PBC row and source evidence.

## Acceptance and verification

- Build/lint/typecheck as appropriate; meaningful tests for equal balances, mismatch, missing evidence versus zero, stale items, missing support, inconsistent account/currency/period, expected-account coverage, independent reviewer, malformed/duplicate imports, and demo marker.
- Generate both exports for realistic populated data and sparse/long-text edge cases. Parse PDF text and XLSX contents, and visually inspect PDF/UI at desktop and mobile. Verify every PBC and metadata field is included and signoff space present. No fake check completion.
- README covers install/run/test/deploy, import schema, sign convention, limitations and privacy behavior; no misleading live integration/AI claims.
- Preserve source workbook hash and `hello.txt`. Exclude secrets, node_modules and generated personal evidence from Git.
- Coder owns app edits and feature branch/PR. Reviewer reviews read-only against this source/spec and reports decision in chat (both use wkao1234). Orchestrator coordinates corrections and final validation. Do not merge until reviewed. GitHub Vercel deployment integration appears connected; access to the Vercel dashboard itself is currently blocked by a saved origin permission, so do not bypass that restriction.
