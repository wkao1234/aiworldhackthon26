"""Create a second synthetic scenario with complete evidence and no exceptions."""
import copy
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "public/demo"
OUT = BASE / "clean"
SOURCES = OUT / "sources"
SOURCES.mkdir(parents=True, exist_ok=True)
pack = json.loads((BASE / "demo-pack.json").read_text(encoding="utf-8"))
records = {record["id"]: record for record in pack["evidence"]}
payloads = {key: json.loads((BASE / "sources" / record["originalFilename"]).read_text(encoding="utf-8"))["data"] for key, record in records.items()}

def add_source(template, eid, account, data, balance=""):
    record = copy.deepcopy(records[template])
    record.update(id=eid, account=account, recordId=f"CLEAN-{eid}-202512", sourceBalance=balance)
    pack["evidence"].append(record)
    records[eid] = record
    payloads[eid] = data

# Payroll: a supported, recent deposit in transit; balanced GL and independent review.
payroll = next(row for row in pack["reconciliations"] if row["id"] == "REC-PAY")
payroll.update(glClosingBalance="50000.00", reviewedBy="Taylor Chen (fictional)")
payroll["outstandingItems"][0].update(date="2025-12-29", support="Deposit DEMO-DEP-002 recorded 2025-12-29; cleared 2026-01-02.", evidenceId="PAY-SUPPORT")
payloads["REC-PAY-REC"] = copy.deepcopy(payroll)
records["REC-PAY-REC"]["sourceReviewer"] = payroll["reviewedBy"]
records["REC-PAY-GL"]["sourceBalance"] = "50000.00"
payloads["REC-PAY-GL"] = {
    "openingBalance": "50000.00",
    "journals": [
        {"date":"2025-12-15", "reference":"DEMO-JE-201", "debit":"0.00", "credit":"2000.00", "description":"Payment included in bank statement"},
        {"date":"2025-12-29", "reference":"DEMO-JE-202", "debit":"2000.00", "credit":"0.00", "description":"Deposit in transit; clears 2026-01-02"},
    ],
    "closingBalance":"50000.00",
}
records["REC-PAY-SIGNOFF"]["sourceReviewer"] = payroll["reviewedBy"]
payloads["REC-PAY-SIGNOFF"].update(reviewedBy=payroll["reviewedBy"], intentional_exception=False)
add_source("OP-SUPPORT", "PAY-SUPPORT", "PAYROLL-002", {"deposit":"DEMO-DEP-002", "amount":"2000.00", "recorded":"2025-12-29", "cleared":"2026-01-02", "periodEndStatus":"Deposit in transit"})

# Reserve: include the third material account with an explicit zero-item population.
reserve = copy.deepcopy(pack["reconciliations"][0])
reserve.update(id="REC-RES", account="RESERVE-003", reference="CLEAN-REC-RES", bankClosingBalance="75000.00", bankAdjustments="0.00", adjustedBankBalance="75000.00", glClosingBalance="75000.00", reconciliationBalance="75000.00", outstandingItems=[], outstandingPopulationConfirmed=True, evidenceIds={"reconciliation":"REC-RES-REC", "bank":"REC-RES-BANK", "gl":"REC-RES-GL"}, reviewSignoffEvidenceId="REC-RES-SIGNOFF")
pack["reconciliations"].append(reserve)
add_source("REC-OP-REC", "REC-RES-REC", "RESERVE-003", copy.deepcopy(reserve))
add_source("REC-OP-BANK", "REC-RES-BANK", "RESERVE-003", {"institution":"Fictional Harbor Bank", "openingBalance":"75000.00", "transactions":[], "closingBalance":"75000.00"}, "75000.00")
add_source("REC-OP-GL", "REC-RES-GL", "RESERVE-003", {"openingBalance":"75000.00", "journals":[], "closingBalance":"75000.00"}, "75000.00")
add_source("REC-OP-SIGNOFF", "REC-RES-SIGNOFF", "RESERVE-003", {"reconciliation":"REC-RES", "preparedBy":reserve["preparedBy"], "reviewedBy":reserve["reviewedBy"], "reviewedAt":reserve["reviewedAt"], "decision":"Simulated source review only; final audit pack signoff remains blank.", "intentional_exception":False})
payloads["BANK-ROSTER"].pop("intentional_gap", None)
payloads["BANK-ROSTER"]["completeness"] = "All three listed material accounts have matching reconciliations and source files."

# Access removal: same-day removal supported consistently by all four source systems.
for record in pack["evidence"]:
    if record["pbcCode"] == "PBC-009":
        scenario = payloads[record["id"]]["scenario"]
        scenario["users"][1]["removedDate"] = "2025-12-15"
        scenario.pop("exception", None)
        scenario["controlOutcome"] = "DEMO-U002 access removed on termination date; no delayed removal."

catalog = json.loads((ROOT / "inputs/workbook-extract.json").read_text(encoding="utf-8"))
cells = {cell["cell"]:cell["value"] for cell in catalog["sheets"][0]["cells"]}
criteria = {f"{cells[f'A{row}']}.{index}":text.strip() for row in range(2,12) for index,text in enumerate(cells[f"F{row}"].split(";"),1)}
for assessment in pack["pbcAssessments"]:
    assessment.update(result="Passed", checker="Taylor Chen (simulated)", note=f"SIMULATED: {criteria[assessment['criterionId']]}", possibleReason="", remediation="", resolution="Simulated assessment recorded", owner="Demo process owner", reviewStatus="Pending final reviewer signoff")

pack["engagement"] = "DEMOCO | Complete synthetic December 2025 audit pack"
pack["metadata"].update({
    "Population or sample":"Three material bank accounts, three reconciliations; synthetic samples cover all other PBC areas.",
    "Preparer and reviewer":"Alex Morgan / Taylor Chen (fictional; different people for each reconciliation).",
    "Completeness check":"All three bank accounts and all 10 PBC areas included with supporting mock files.",
    "Accuracy and reconciliation check":"Operating 100000.00, payroll 50000.00 and reserve 75000.00: adjusted bank equals GL in USD.",
    "Cut-off check":"2025-12-31; supported outstanding items dated 2025-12-20 and 2025-12-29; reserve has none.",
    "Exception status":"No exceptions in this synthetic scenario when its matching files are attached.",
    "File name and version":"auditpack-clean-dataset.zip; SYNTHETIC-CLEAN-v1",
    "Final status":"SYNTHETIC: input checks complete; final reviewer signoff remains blank.",
})

# Give this scenario distinct filenames, with actual byte hashes for its own evidence.
for record in pack["evidence"]:
    record.update(originalFilename=f"CLEAN-{record['id']}.json", version="SYNTHETIC-CLEAN-v1", reportParameters=f"SYNTHETIC; entity=DEMOCO; period=2025-12; currency=USD; account={record['account'] or 'ALL'}", limitations="Fictional demo export and identities; no live connection or real audit evidence.")
    payload = {"classification":"SYNTHETIC DEMO - NOT AUDIT EVIDENCE", "provenance":{key:value for key,value in record.items() if key != "declaredSha256"}, "data":payloads[record["id"]]}
    raw = (json.dumps(payload, indent=2, ensure_ascii=False)+"\n").encode("utf-8")
    (SOURCES / record["originalFilename"]).write_bytes(raw)
    record["declaredSha256"] = hashlib.sha256(raw).hexdigest()

text = json.dumps(pack, separators=(",", ":"), ensure_ascii=False)+"\n"
if len(text) >= 60000 or len(text.encode("utf-8")) >= 60000:
    raise ValueError(f"Clean JSON is too large: {len(text)} characters")
(OUT / "demo-pack-clean.json").write_text(text, encoding="utf-8", newline="\n")
manifest = {row["id"]:{"file":f"sources/{row['originalFilename']}", "sha256":row["declaredSha256"]} for row in pack["evidence"]}
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2)+"\n", encoding="utf-8", newline="\n")
instructions = f"""# AuditPack complete synthetic input

SYNTHETIC DEMO - NOT AUDIT EVIDENCE

Import demo-pack-clean.json ({len(text):,} characters, below 60,000) into AuditPack using Choose JSON file. Attach the 45 files in sources/ to their matching evidence IDs. CLEAN-REC-OP-BANK.json, for example, belongs to REC-OP-BANK. These files belong to this clean scenario; do not substitute files from the original exception demo.

Expected result with all matching files attached: every check and all 57 criteria pass, with no Exception, Needs evidence or Not assessed rows. JSON alone intentionally does not count as attached source evidence.

The three bank accounts reconcile: operating USD 100,000; payroll USD 50,000; reserve USD 75,000. Operating and payroll have supported recent reconciling items; reserve explicitly confirms no outstanding items. Every reconciliation has a different preparer and reviewer. The fictional terminated employee's access is removed on the termination date.

All 10 PBC areas, 17 metadata fields and 51 simulated nonbank assessments are retained. The final PDF/XLSX reviewer signoff stays blank. Passing a synthetic scenario is not an audit opinion; identities, sources and human assessments are fictional.

Rebuild with python scripts/generate_clean_demo.py after generating the original demo.
"""
(OUT / "README.md").write_text(instructions, encoding="utf-8", newline="\n")
with ZipFile(OUT / "auditpack-clean-dataset.zip", "w", ZIP_DEFLATED) as archive:
    paths=[OUT / "README.md", OUT / "demo-pack-clean.json", OUT / "manifest.json"]+[SOURCES / row["originalFilename"] for row in pack["evidence"]]
    for path in paths:
        info=ZipInfo(path.relative_to(OUT).as_posix(), (2026,1,17,12,0,0))
        info.compress_type=ZIP_DEFLATED
        archive.writestr(info,path.read_bytes())
print(f"Clean dataset: {len(text):,} characters; {len(pack['reconciliations'])} reconciliations; {len(pack['evidence'])} files; {len(pack['pbcAssessments'])} simulated assessments.")
