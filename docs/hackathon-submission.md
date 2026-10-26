# AuditPack submission draft

Live demo: https://aiworldhackthon26.vercel.app/

Repository: https://github.com/wkao1234/aiworldhackthon26

Access: no account, password, API key, or local installation required. Use the built-in synthetic scenarios. Work lives in the browser tab and is cleared on reload; download the deliverables before leaving.

## What did you build?

AuditPack turns structured reconciliation data and attached source evidence into a bank reconciliation working-paper PDF and a summary spreadsheet. It preserves the supplied PBC workbook's ten requests, 57 assurance criteria, and 17 metadata fields. Each result remains linked to its source records, people, dates, evidence IDs, and locally computed file hashes. Final reviewer signoff is left blank.

## Who has this problem?

The primary user is an accounting preparer assembling a period-end reconciliation pack for a controller or audit reviewer. The preparer must bring together reconciliation records, bank exports, GL records, outstanding-item support, and review evidence, then explain differences and missing support. The reviewer needs to trace a conclusion back to the right file and source context.

Our supplied PBC workbook defines this concrete workflow. We hypothesize that repeated period-end evidence assembly is useful beyond this single example, but we have not completed customer interviews, measured market demand, or established willingness to pay.

## How does your app solve it?

Before: gather files, manually compare balances and scope, maintain a separate exception list, and reformat the same evidence into multiple deliverables.

With AuditPack: validate a structured input, attach and hash evidence, inspect deterministic bank checks and criterion-level human assessments, then generate PDF and XLSX from the same snapshot. Missing values stay missing. A self-review, an unexplained difference, or a missing source remains visible instead of becoming a clean conclusion. The intended benefit is less repeated assembly and easier review; time savings have not yet been measured.

Demo journey:

1. Load the exception scenario. Inspect the USD 100 payroll difference, self-review, 91-day-old item, missing reserve reconciliation, and late access removal. Follow the check ledger into the source records.
2. Load the clean scenario. Verify three accounts, 45 attached mock files, 57 criteria, and 156 passing checks. These include 51 explicitly simulated human assessments. Passing checks do not constitute an audit opinion.
3. Export the PDF and XLSX. Inspect source footprints, named preparers/reviewers, timestamps, exceptions/reasons, and blank final reviewer signoff. Both downloads carry the same pack snapshot ID and synthetic marker.

The design difference is the link from an individual PBC criterion to a check, its evidence, and both exported deliverables. This is a demonstrable implementation choice, not a claim that competitors cannot reproduce it.

## How did you build it?

Codex agents helped turn the workbook into a specification, implement the application, review changes, and run verification. The app uses React, TypeScript, and Vite, with SHA-256 through the browser's Web Crypto API, jsPDF for PDF, and ExcelJS for XLSX. GitHub and Vercel provide version control and deployment. Export libraries load on demand.

The strongest part is traceability and repeatability: the original workbook remains intact, monetary comparisons use integer cents, evidence hashes are calculated from actual attached bytes, and one snapshot drives both exports. Tests cover valid, missing, inconsistent, malformed, and tampered inputs, including both complete demo scenarios.

AI use is in the development workflow. The deployed app does not call a language model, connect to live bank/GL systems, authenticate source identities, or parse generic bank PDFs. Nonbank conclusions are entered as human assessments. These limitations are disclosed in the interface and documentation.

Next, we would run a bounded pilot with a preparer and an independent reviewer to measure assembly time, review time, missed issues, and false alarms. Then we would evaluate authorized source connectors and a server-side, evidence-citing AI assistant that proposes explanations for human review. A model must not change deterministic balances, manufacture evidence, or sign off an audit. Production access controls, retention, monitoring, and recovery also remain future work.

## Evidence to accompany the submission

- Production app and GitHub repository above.
- [Photographed rubric extraction and implementation map](judging-requirements.md).
- Existing reproducible checks: `npm test`, `npm run build`, and `python scripts/verify_exports.py` with the required Python libraries.
- [Exception scenario ZIP](https://aiworldhackthon26.vercel.app/demo/ledgerline-demo-dataset.zip) and [clean scenario ZIP](https://aiworldhackthon26.vercel.app/demo/clean/auditpack-clean-dataset.zip), each containing a compact input JSON, source files, hash manifest, and instructions.

This is a draft for the team's submission. It does not assert a judging score, customer validation, measured ROI, or completed submission to the judging service.
