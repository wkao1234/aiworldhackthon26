# Ledgerline synthetic demo dataset

SYNTHETIC DEMO - NOT AUDIT EVIDENCE

All identities, entities, balances, transactions, source exports and assessments are fictional.
The source workbook is a requirements catalog, not evidence. This dataset does not contain real customer data.

## Fast demo

Open Ledgerline and select **Explore synthetic demo**. The app loads this JSON and all 40 actual mock source files, hashes their bytes locally, and labels the pack synthetic. Export PDF and XLSX from the same snapshot. The final reviewer signoff remains blank.

For a manual import, choose demo-pack.json, then attach each file in sources/ to the evidence ID matching its filename. JSON import alone intentionally clears attachments. Reloading the browser clears working data.

## Expected walkthrough

1. OPERATING-001: bank 102,500 less outstanding check 2,500 equals GL 100,000. Matching source files, support and independent simulated review are present.
2. PAYROLL-002: bank 48,000 plus outstanding item 2,000 gives 50,000, compared with GL 49,900: a 100 difference. The item is dated 2025-10-01 (91 days before period end), lacks support, and the preparer is also the reviewer.
3. RESERVE-003: listed as material in the account roster but intentionally lacks a reconciliation.
4. PBC-009: fictional leaver DEMO-U002 left 2025-12-15 but access was removed 2026-01-04. Human assessment exceptions remain open.
5. Other nonbank PBC checks are explicitly simulated human assessments, not automated audit conclusions. All 17 metadata fields are populated.

Source evidence uses JSON for transparent inspection. The app does not parse arbitrary bank PDFs, authenticate source identities, connect to live systems or provide an audit opinion. Hashes establish byte consistency, not authenticity.

## Reproduce

Run python scripts/generate_demo.py. It regenerates the pack, source JSON files and ZIP deterministically. Final exports use their actual generation/capture time, separately from fictional source dates.
