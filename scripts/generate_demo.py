"""Rebuild the wholly fictional demo input and matching source artifacts."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "demo"
SOURCES = OUT / "sources"
SOURCES.mkdir(parents=True, exist_ok=True)
catalog = json.loads((ROOT / "inputs/workbook-extract.json").read_text(encoding="utf-8"))
cells = {c["cell"]: c["value"] for c in catalog["sheets"][0]["cells"]}
meta = {c["cell"]: c["value"] for c in catalog["sheets"][1]["cells"]}
marker = "SYNTHETIC DEMO - NOT AUDIT EVIDENCE"
pack = dict(engagement="DEMOCO | December 2025 audit readiness demo", entity="DEMOCO", period="2025-12", currency="USD", expectedAccounts=["OPERATING-001", "PAYROLL-002", "RESERVE-003"], expectedAccountEvidenceId="BANK-ROSTER", staleDays=30, metadata={}, reconciliations=[], evidence=[], pbcAssessments=[], demo=True)

def source(eid, kind, account, system, data, balance="", pbc="PBC-002", preparer="Alex Morgan (fictional)", reviewer="Taylor Chen (fictional)"):
    record = dict(id=eid, kind=kind, pbcCode=pbc, sourceSystem=system, originalFilename=f"{eid}.json", version="SYNTHETIC-v1", recordId=f"DEMO-{eid}-202512", reportParameters=f"{marker}; entity=DEMOCO; period=2025-12; currency=USD; account={account or 'ALL'}", entity="DEMOCO", account=account, currency="USD", period="2025-12", extractedAt="2026-01-08T10:00:00Z", sourcePreparer=preparer, sourcePreparedAt="2026-01-06", sourceReviewer=reviewer, sourceReviewedAt="2026-01-07", declaredSha256="", sourceBalance=balance, limitations="Wholly fictional source export and identities. No live system, authenticated approval, or real financial evidence.")
    if pbc != "PBC-002":
        record.update(sourcePreparedAt="2026-01-14", sourceReviewedAt="2026-01-15", extractedAt="2026-01-16T10:00:00Z")
    payload = dict(classification=marker, provenance={k:v for k,v in record.items() if k != "declaredSha256"}, data=data)
    raw = (json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    (SOURCES / record["originalFilename"]).write_bytes(raw)
    record["declaredSha256"] = hashlib.sha256(raw).hexdigest()
    pack["evidence"].append(record)
    return eid

source("BANK-ROSTER", "other", "", "Treasury management system", {"accounts":[{"account":a,"material":True,"status":"Active"} for a in pack["expectedAccounts"]], "intentional_gap":"RESERVE-003 reconciliation intentionally omitted to demonstrate completeness detection."})
for rid, account, bank, adjustment, adjusted, gl in [("REC-OP","OPERATING-001","102500.00","-2500.00","100000.00","100000.00"),("REC-PAY","PAYROLL-002","48000.00","2000.00","50000.00","49900.00")]:
    good = rid == "REC-OP"
    item = dict(id="OP-1" if good else "PAY-1", amount=adjustment, date="2025-12-20" if good else "2025-10-01", support="Check DEMO-1042 issued to fictional supplier; cleared 2026-01-03" if good else "", evidenceId="OP-SUPPORT" if good else "")
    rec = dict(id=rid, entity="DEMOCO", account=account, currency="USD", period="2025-12", reference=f"DEMO-{rid}", bankClosingBalance=bank, bankAdjustments=adjustment, adjustedBankBalance=adjusted, glClosingBalance=gl, reconciliationBalance=adjusted, outstandingItems=[item], outstandingPopulationConfirmed=True, evidenceIds={"reconciliation":f"{rid}-REC","bank":f"{rid}-BANK","gl":f"{rid}-GL"}, preparedBy="Alex Morgan (fictional)", preparedAt="2026-01-06", reviewedBy="Taylor Chen (fictional)" if good else "Alex Morgan (fictional)", reviewedAt="2026-01-07", reviewSignoffEvidenceId=f"{rid}-SIGNOFF", owner="Morgan Patel - Treasury (fictional)")
    pack["reconciliations"].append(rec)
    source(f"{rid}-REC", "reconciliation", account, "Treasury management system", rec, reviewer=rec["reviewedBy"])
    source(f"{rid}-BANK", "bank", account, "bank portal", {"institution":"Fictional Harbor Bank", "openingBalance":"95000.00" if good else "50000.00", "transactions":[{"date":"2025-12-10","reference":"DEMO-CUSTOMER-RECEIPTS","amount":"30000.00"},{"date":"2025-12-18","reference":"DEMO-SUPPLIER-PAYMENTS","amount":"-22500.00"}] if good else [{"date":"2025-12-15","reference":"DEMO-PAYMENT","amount":"-2000.00"}], "closingBalance":bank}, bank, preparer="Casey Rivera - Bank reporting (fictional)", reviewer="Jordan Lee - Bank control (fictional)")
    source(f"{rid}-GL", "gl", account, "ERP cash module", {"openingBalance":"95000.00" if good else "50000.00", "journals":[{"reference":"DEMO-JE-101","debit":"30000.00","credit":"0.00"},{"reference":"DEMO-JE-102","debit":"0.00","credit":"22500.00"},{"reference":"DEMO-JE-103","debit":"0.00","credit":"2500.00"}] if good else [{"reference":"DEMO-JE-201","debit":"0.00","credit":"100.00","description":"Fee adjustment omitted from reconciliation"}], "closingBalance":gl}, gl, preparer="Sam Ellis - GL accounting (fictional)", reviewer="Jamie Brooks - Controller (fictional)")
    source(f"{rid}-SIGNOFF", "other", account, "Treasury management system", {"reconciliation":rid,"preparedBy":rec["preparedBy"],"reviewedBy":rec["reviewedBy"],"reviewedAt":rec["reviewedAt"],"decision":"Simulated source review only; final audit pack signoff remains blank.","intentional_exception":not good}, reviewer=rec["reviewedBy"])
source("OP-SUPPORT", "other", "OPERATING-001", "Treasury management system", {"check":"DEMO-1042","payee":"Fictional Delta Supplies","amount":"2500.00","issued":"2025-12-20","cleared":"2026-01-03","periodEndStatus":"Outstanding"})

area_data = {
 "PBC-001":{"trialBalanceDebits":"1250000.00","trialBalanceCredits":"1250000.00","unmappedAccounts":0,"entities":["DEMOCO"],"reportingPack":"DEMO-FS-202512"},
 "PBC-003":{"asOf":"2025-12-31","glTotal":"85000.00","openInvoices":[{"id":"DEMO-AR-101","customer":"Fictional Acorn LLC","amount":"60000.00","due":"2026-01-15","receiptDate":"2026-01-10"},{"id":"DEMO-AR-102","customer":"Fictional Birch LLC","amount":"25000.00","due":"2025-12-15","receiptDate":"2026-01-12"}],"disputes":0},
 "PBC-004":{"glTotal":"42000.00","invoices":[{"id":"DEMO-AP-101","amount":"30000.00","goodsReceived":"2025-12-20","paid":"2026-01-08"},{"id":"DEMO-AP-102","amount":"12000.00","goodsReceived":"2025-12-28","paid":"2026-01-09"}],"duplicateInvoices":0,"unrecordedLiabilities":"0.00"},
 "PBC-005":{"openingCost":"200000.00","additions":"30000.00","disposals":"10000.00","closingCost":"220000.00","openingAccumulatedDepreciation":"80000.00","depreciationExpense":"2000.00","depreciationOnDisposals":"5000.00","closingAccumulatedDepreciation":"77000.00","netBookValue":"143000.00","method":"Straight line","additionInService":"2025-12-01"},
 "PBC-006":{"populationCount":3,"manualCount":3,"debits":"32500.00","credits":"32500.00","entries":[{"id":"DEMO-MJE-01","amount":"30000.00"},{"id":"DEMO-MJE-02","amount":"2000.00"},{"id":"DEMO-MJE-03","amount":"500.00"}],"lateEntries":0,"preparer":"Alex Morgan (fictional)","approver":"Taylor Chen (fictional)"},
 "PBC-007":{"runs":["DEMO-REG-12","DEMO-OFFCYCLE-12"],"grossPay":"70000.00","deductions":"20000.00","netPay":"50000.00","glPayrollCost":"70000.00","paymentControlTotal":"50000.00","sampleEmployeeIds":["DEMO-E001","DEMO-E002"],"personalData":"Fictional identifiers only; no dates of birth, bank details or real employees."},
 "PBC-008":{"revenueStreams":["Subscription","Implementation"],"glTotal":"180000.00","contracts":[{"id":"DEMO-CON-01","recognized":"120000.00","serviceEnd":"2025-12-31"},{"id":"DEMO-CON-02","recognized":"60000.00","acceptanceDate":"2025-12-20"}],"unassessedModifications":0,"unassessedCredits":0},
 "PBC-009":{"users":[{"id":"DEMO-U001","hrStatus":"Active","privileged":True},{"id":"DEMO-U002","hrStatus":"Terminated","terminationDate":"2025-12-15","removedDate":"2026-01-04","ticket":"DEMO-IAM-22"}],"exception":"A leaver retained access past termination; removal was late."},
 "PBC-010":{"changes":[{"id":"DEMO-CHG-101","approved":"2025-12-10","tested":"2025-12-11","deployed":"2025-12-12","rollback":"Restore fictional release 1.0","emergency":False}],"populationCount":1,"sourceCommit":"fictional-demo-commit","segregationConflicts":0}
}
for row in range(2,12):
    code = cells[f"A{row}"]
    if code == "PBC-002": continue
    ids=[]
    for index, system in enumerate(cells[f"D{row}"].split(";"), 1):
        ids.append(source(f"{code}-SOURCE-{index}", "other", "", system.strip(), {"area":cells[f"B{row}"],"scenario":area_data[code],"assuranceBasis":"Simulated human assessment for demonstration; no real review performed."}, pbc=code))
    for index, criterion in enumerate(cells[f"F{row}"].split(";"), 1):
        exception = code == "PBC-009" and index in [2,6]
        pack["pbcAssessments"].append(dict(criterionId=f"{code}.{index}",result="Exception" if exception else "Passed",checker="Taylor Chen - simulated assessor (fictional)",checkedAt="2026-01-17",evidenceIds=ids,note=("SYNTHETIC assessment: terminated user DEMO-U002 retained access until 2026-01-04." if exception else f"SYNTHETIC assessment only: {criterion.strip()}. See matching fictional source exports."),possibleReason="Hypothesis: delayed HR-to-IAM handoff." if exception else "",owner="Avery Quinn - IT controls (fictional)" if exception else "Demo process owner (fictional)",remediation="Investigate removal delay and validate deprovisioning control." if exception else "",resolution="Open - demonstration exception" if exception else "Simulated assessment recorded",reviewStatus="Pending final reviewer signoff"))

values=["DEMOCO; December 2025; USD; all 10 supplied PBC areas","Three material bank accounts; two reconciliations supplied; synthetic samples for other PBCs","Morgan Patel - Treasury (fictional)","Alex Morgan / Taylor Chen (fictional; payroll deliberately self-reviewed)","Fictional exports for the source-system categories in the PBC workbook","entity=DEMOCO; period=2025-12; currency=USD; synthetic v1","2026-01-08T10:00:00Z; source extraction claim, separate from browser capture","RESERVE-003 deliberately missing; all other sample populations described in source files","OPERATING-001 balances; PAYROLL-002 has a deliberate USD 100 difference","31 December 2025; payroll reconciling item is 91 days old","Evidence IDs map to named JSON files; SHA-256 hashes computed over actual mock bytes","Open: payroll difference, stale/unsupported item, self-review, missing reserve account, late leaver removal","All amounts, identities, entities and records are fictional","ledgerline-demo-dataset.zip; SYNTHETIC-v1","Prepared 2026-01-06; source reviewed 2026-01-07; simulated PBC assessments 2026-01-09","DEMO-PBC-001 through DEMO-PBC-010; no real audit working paper","DEMONSTRATION ONLY; exceptions open; final reviewer signoff intentionally blank"]
pack["metadata"] = {meta[f"A{r}"]:value for r,value in zip(range(2,19),values)}
pack["metadata"]["Extraction timestamp"] = "Bank sources: 2026-01-08T10:00:00Z; nonbank sources: 2026-01-16T10:00:00Z; separate from browser capture"
pack["metadata"]["Preparation and review dates"] = "Bank prepared/reviewed 2026-01-06/07; nonbank prepared/reviewed 2026-01-14/15; simulated assessments 2026-01-17"
# Compact formatting and remove repeated guidance already present in the README.
for assessment in pack["pbcAssessments"]:
    if assessment["result"] == "Passed":
        assessment["note"] = assessment["note"].replace("SYNTHETIC assessment only: ", "SIMULATED: ").replace(" See matching fictional source exports.", "")
pack_json = json.dumps(pack, separators=(",", ":"), ensure_ascii=False) + "\n"
if len(pack_json) >= 60_000 or len(pack_json.encode("utf-8")) >= 60_000:
    raise ValueError("Demo import JSON must remain below 60,000 characters and bytes.")
(OUT / "demo-pack.json").write_text(pack_json, encoding="utf-8", newline="\n")
readme = f"""# AuditPack synthetic demo dataset

{marker}

All identities, entities, balances, transactions, source exports and assessments are fictional.
The source workbook is a requirements catalog, not evidence. This dataset does not contain real customer data.

## Fast demo

Open AuditPack and select **Explore synthetic demo**. The app loads this JSON and all {len(pack['evidence'])} actual mock source files, hashes their bytes locally, and labels the pack synthetic. Export PDF and XLSX from the same snapshot. The final reviewer signoff remains blank.

For a manual import, choose demo-pack.json, then attach each file in sources/ to the evidence ID matching its filename. JSON import alone intentionally clears attachments. Reloading the browser clears working data.

demo-pack.json is compact JSON: {len(pack_json):,} characters, below the 60,000-character limit. All 40 source references, 51 simulated assessments, 17 metadata fields and deliberate exceptions remain included. The app formats it for reading after import.

## Expected walkthrough

1. OPERATING-001: bank 102,500 less outstanding check 2,500 equals GL 100,000. Matching source files, support and independent simulated review are present.
2. PAYROLL-002: bank 48,000 plus outstanding item 2,000 gives 50,000, compared with GL 49,900: a 100 difference. The item is dated 2025-10-01 (91 days before period end), lacks support, and the preparer is also the reviewer.
3. RESERVE-003: listed as material in the account roster but intentionally lacks a reconciliation.
4. PBC-009: fictional leaver DEMO-U002 left 2025-12-15 but access was removed 2026-01-04. Human assessment exceptions remain open.
5. Other nonbank PBC checks are explicitly simulated human assessments, not automated audit conclusions. All 17 metadata fields are populated.

Source evidence uses JSON for transparent inspection. The app does not parse arbitrary bank PDFs, authenticate source identities, connect to live systems or provide an audit opinion. Hashes establish byte consistency, not authenticity.

## Reproduce

Run python scripts/generate_demo.py. It regenerates the pack, source JSON files and ZIP deterministically. Final exports use their actual generation/capture time, separately from fictional source dates.
"""
(OUT / "README.md").write_text(readme,encoding="utf-8",newline="\n")
manifest={r["id"]:{"file":f"sources/{r['originalFilename']}","sha256":r["declaredSha256"]} for r in pack["evidence"]}
(OUT / "manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8",newline="\n")
from zipfile import ZipInfo
with ZipFile(OUT / "ledgerline-demo-dataset.zip", "w", ZIP_DEFLATED) as archive:
    paths=[OUT / "README.md",OUT / "demo-pack.json",OUT / "manifest.json"]+[SOURCES / r["originalFilename"] for r in pack["evidence"]]
    for path in paths:
        info=ZipInfo(path.relative_to(OUT).as_posix(), (2026,1,17,12,0,0))
        info.compress_type=ZIP_DEFLATED
        archive.writestr(info,path.read_bytes())
print(f"Generated {len(pack['evidence'])} source files, {len(pack['pbcAssessments'])} simulated assessments, {len(pack_json):,}-character import JSON and demo ZIP.")
