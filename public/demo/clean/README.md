# AuditPack complete synthetic input

SYNTHETIC DEMO - NOT AUDIT EVIDENCE

Import demo-pack-clean.json (59,301 characters, below 60,000) into AuditPack using Choose JSON file. Attach the 45 files in sources/ to their matching evidence IDs. CLEAN-REC-OP-BANK.json, for example, belongs to REC-OP-BANK. These files belong to this clean scenario; do not substitute files from the original exception demo.

Expected result with all matching files attached: every check and all 57 criteria pass, with no Exception, Needs evidence or Not assessed rows. JSON alone intentionally does not count as attached source evidence.

The three bank accounts reconcile: operating USD 100,000; payroll USD 50,000; reserve USD 75,000. Operating and payroll have supported recent reconciling items; reserve explicitly confirms no outstanding items. Every reconciliation has a different preparer and reviewer. The fictional terminated employee's access is removed on the termination date.

All 10 PBC areas, 17 metadata fields and 51 simulated nonbank assessments are retained. The final PDF/XLSX reviewer signoff stays blank. Passing a synthetic scenario is not an audit opinion; identities, sources and human assessments are fictional.

Rebuild with python scripts/generate_clean_demo.py after generating the original demo.
