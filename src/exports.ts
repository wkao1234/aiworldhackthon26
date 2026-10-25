import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import {
  getAttachment,
  catalog,
  cents,
  criteria,
  metadataFields,
  money,
  sourceWorkbook,
  workbookHash,
  type EvidenceRecord,
  type Result,
} from "./model";
import type { Snapshot } from "./checks";

const missing = (value: string | undefined | null) =>
  value?.trim() || "Missing";
const text = (value: unknown) => String(value ?? "");
const clean = (value: unknown) =>
  text(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const safeCell = (value: unknown): string | number =>
  typeof value === "number"
    ? value
    : /^\s*[=+\-@]/.test(clean(value))
      ? `'${clean(value)}`
      : clean(value);
const numeric = (value: string): number | string =>
  value && cents(value) !== null ? cents(value)! / 100 : "Missing";
const counts = (values: Result[]) => ({
  passed: values.filter((v) => v === "Passed").length,
  exception: values.filter((v) => v === "Exception").length,
  evidence: values.filter((v) => v === "Needs evidence").length,
  unassessed: values.filter((v) => v === "Not assessed").length,
});

function sourceFootprint(
  record: EvidenceRecord | undefined,
  snapshot: Snapshot,
): string {
  if (!record) return "Missing source record and attached file.";
  const attachment = getAttachment(snapshot.attachments, record.id);
  const fields = [
    `Evidence ID: ${record.id}`,
    `Source system (source-provided): ${missing(record.sourceSystem)}`,
    `Original filename/version: ${missing(record.originalFilename)} / ${missing(record.version)}`,
    `Record/report ID: ${missing(record.recordId)}`,
    `Parameters: ${missing(record.reportParameters)}`,
    `Imported/transcribed source balance: ${record.kind === "bank" || record.kind === "gl" ? missing(record.sourceBalance) : "Not applicable"}`,
    `Entity/account/currency/period: ${missing(record.entity)} / ${missing(record.account)} / ${missing(record.currency)} / ${missing(record.period)}`,
    `Source extraction timestamp: ${missing(record.extractedAt)}`,
    `Source preparer/date: ${missing(record.sourcePreparer)} / ${missing(record.sourcePreparedAt)}`,
    `Source reviewer/date: ${missing(record.sourceReviewer)} / ${missing(record.sourceReviewedAt)}`,
    `Declared file SHA-256 (source-provided): ${missing(record.declaredSha256)}`,
    `Actual attachment: ${attachment ? `${attachment.name}; ${attachment.size} bytes` : "Missing"}`,
    `Capture time: ${attachment?.capturedAt || "Missing"}`,
    `Computed attached file SHA-256: ${attachment?.sha256 || "Missing"}`,
    `Limitations: ${missing(record.limitations)}`,
  ];
  return fields.join("\n");
}

export function buildPdf(snapshot: Snapshot): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth(),
    margin = 18,
    usable = pageWidth - margin * 2;
  let y = 22;
  const dark = "#10263a",
    accent = "#126b70";
  const need = (height: number) => {
    if (y + height > 270) {
      doc.addPage();
      y = 22;
    }
  };
  const paragraph = (value: string, size = 9, color = dark) => {
    doc.setTextColor(color);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(value), usable) as string[];
    for (const line of lines) {
      need(size * 0.45 + 2);
      doc.text(line, margin, y);
      y += size * 0.45 + 1.8;
    }
    y += 2;
  };
  const heading = (value: string, level = 1) => {
    need(level === 1 ? 16 : 12);
    y += level === 1 ? 5 : 3;
    doc.setTextColor(level === 1 ? dark : accent);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(level === 1 ? 16 : 11);
    const lines = doc.splitTextToSize(clean(value), usable) as string[];
    for (const line of lines) {
      need(level === 1 ? 8 : 6);
      doc.text(line, margin, y);
      y += level === 1 ? 8 : 6;
    }
    y += 2;
  };
  const table = (
    headers: string[],
    rows: (string | number)[][],
    widths?: number[],
  ) => {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: 20, bottom: 20 },
      head: [headers],
      body: rows.map((row) => row.map((value) => clean(value))),
      theme: "grid",
      tableWidth: usable,
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        textColor: dark,
        cellPadding: 2.3,
        overflow: "linebreak",
        valign: "top",
        lineColor: "#d7e1e5",
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: dark,
        textColor: "#ffffff",
        fontStyle: "bold",
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: "#f4f8f8" },
      columnStyles: widths
        ? Object.fromEntries(
            widths.map((width, index) => [index, { cellWidth: width }]),
          )
        : undefined,
      rowPageBreak: "auto",
      showHead: "everyPage",
      pageBreak: "auto",
    });
    y =
      ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? y) + 5;
  };

  doc.setFillColor(dark);
  doc.rect(0, 0, pageWidth, 75, "F");
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.text("Bank reconciliation", margin, 31);
  doc.text("audit pack", margin, 43);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Evidence-led working paper · PDF export", margin, 57);
  y = 91;
  if (snapshot.input.demo) {
    heading("SYNTHETIC DEMO — NOT AUDIT EVIDENCE");
    paragraph(
      "Every figure, identity and source in this pack is synthetic. Any attached demo files are synthetic; no live system extraction is implied.",
      10,
      "#ad4d23",
    );
  }
  heading(missing(snapshot.input.engagement), 2);
  table(
    ["Pack identity", "Value"],
    [
      ["Pack ID", snapshot.packId],
      ["Snapshot timestamp (generated)", snapshot.timestamp],
      ["Entity", missing(snapshot.input.entity)],
      ["Period", missing(snapshot.input.period)],
      ["Currency", missing(snapshot.input.currency)],
      [
        "Expected accounts",
        snapshot.input.expectedAccounts.length
          ? snapshot.input.expectedAccounts.join(", ")
          : "Missing",
      ],
      [
        "Expected account population evidence",
        missing(snapshot.input.expectedAccountEvidenceId),
      ],
      ["Demo marker", snapshot.input.demo ? "SYNTHETIC DEMO" : "No"],
    ],
    [48, usable - 48],
  );
  heading("Scope & limitations");
  paragraph(
    "This working pack applies deterministic checks to user-imported data. Source identity, extraction timestamps, preparer and reviewer names/dates are source-provided claims. An attached file is hashed at capture; its contents are not parsed or authenticated. Generic PDF attachments are retained as references only. A Passed check is not an audit opinion or proof of a live system extraction.",
  );
  paragraph(
    `Requirements provenance: ${sourceWorkbook}; SHA-256 ${workbookHash}; PBC List!A1:F11 and Audit pack metadata!A1:B18. The source workbook is a requirements catalog, not transactional evidence.`,
  );
  const summary = counts(
    criteria.map((row) => snapshot.criterionResults[row.id]),
  );
  table(
    ["Assurance criteria", "Count"],
    [
      ["Passed", summary.passed],
      ["Exception", summary.exception],
      ["Needs evidence", summary.evidence],
      ["Not assessed", summary.unassessed],
    ],
    [usable - 35, 35],
  );

  heading("Pack metadata");
  table(
    ["Source row / parameter", "Value / purpose"],
    metadataFields.map((field) => [
      `${field.sourceRow}\n${field.label}`,
      `${missing(snapshot.input.metadata[field.label])}\nPurpose: ${field.purpose}`,
    ]),
    [64, usable - 64],
  );

  heading("PBC coverage & individual assurance criteria");
  for (const item of catalog) {
    heading(`${item.code} · ${item.name} · ${snapshot.coverage[item.code]}`, 2);
    const linked = snapshot.input.evidence.filter(
      (row) => row.pbcCode === item.code,
    );
    table(
      ["Requirements source", "Detail"],
      [
        ["Workbook row", item.sourceRow],
        ["Audit area", item.area],
        ["Systems required", item.systems],
        ["Example audit evidence", item.exampleEvidence],
        ["Full assurance parameters", item.assurance],
        [
          "Evidence footprint",
          linked.length
            ? linked.map((row) => sourceFootprint(row, snapshot)).join("\n\n")
            : "No source records or attachments linked; missing evidence.",
        ],
      ],
      [50, usable - 50],
    );
    table(
      ["Criterion / workbook cell", "Exact assurance statement", "Result"],
      criteria
        .filter((row) => row.pbcCode === item.code)
        .map((row) => [
          `${row.id}\n${row.sourceCell}`,
          row.text,
          snapshot.criterionResults[row.id],
        ]),
      [38, usable - 66, 28],
    );
  }

  heading("Bank reconciliations by account");
  if (!snapshot.input.reconciliations.length)
    paragraph(
      "No reconciliation records imported. Bank checks require evidence.",
    );
  for (const row of snapshot.input.reconciliations) {
    heading(
      `${row.account || "Missing account"} · ${row.period || "Missing period"}`,
      2,
    );
    table(
      ["Reconciliation field", "Imported value"],
      [
        ["ID / reference", `${missing(row.id)} / ${missing(row.reference)}`],
        [
          "Entity / currency",
          `${missing(row.entity)} / ${missing(row.currency)}`,
        ],
        [
          "Bank statement closing balance",
          money(
            row.bankClosingBalance ? cents(row.bankClosingBalance) : null,
            row.currency,
          ),
        ],
        [
          "Signed bank adjustments",
          money(
            row.bankAdjustments ? cents(row.bankAdjustments) : null,
            row.currency,
          ),
        ],
        [
          "Outstanding population explicitly confirmed",
          row.outstandingPopulationConfirmed
            ? "Yes (user-imported declaration)"
            : "No / missing",
        ],
        [
          "Adjusted bank balance",
          money(
            row.adjustedBankBalance ? cents(row.adjustedBankBalance) : null,
            row.currency,
          ),
        ],
        [
          "GL closing balance",
          money(
            row.glClosingBalance ? cents(row.glClosingBalance) : null,
            row.currency,
          ),
        ],
        [
          "Reconciliation reported balance",
          money(
            row.reconciliationBalance ? cents(row.reconciliationBalance) : null,
            row.currency,
          ),
        ],
        [
          "Pack reconciliation preparer/date",
          `${missing(row.preparedBy)} / ${missing(row.preparedAt)}`,
        ],
        [
          "Pack reconciliation reviewer/date",
          `${missing(row.reviewedBy)} / ${missing(row.reviewedAt)}`,
        ],
        [
          "Independent review signoff evidence ID",
          missing(row.reviewSignoffEvidenceId),
        ],
        ["Owner", missing(row.owner)],
      ],
      [65, usable - 65],
    );
    for (const kind of ["reconciliation", "bank", "gl"] as const) {
      const record = snapshot.input.evidence.find(
        (entry) => entry.id === row.evidenceIds[kind],
      );
      heading(`${kind.toUpperCase()} source footprint`, 2);
      table(
        ["Provenance", "Source-provided fields and actual attachment"],
        [[kind, sourceFootprint(record, snapshot)]],
        [35, usable - 35],
      );
    }
    table(
      ["Outstanding item", "Signed amount", "Date / support / evidence"],
      row.outstandingItems.length
        ? row.outstandingItems.map((item) => [
            item.id,
            money(item.amount ? cents(item.amount) : null, row.currency),
            `${missing(item.date)}; ${missing(item.support)}; ${missing(item.evidenceId)}; ${getAttachment(snapshot.attachments, item.evidenceId) ? "file attached" : "attachment missing"}`,
          ])
        : [
            [
              "None listed",
              "—",
              "Verify zero adjustments and attached source records.",
            ],
          ],
      [37, 35, usable - 72],
    );
  }

  heading("Complete check ledger");
  table(
    ["Check ID / result", "What was checked", "Rule, observation & evidence"],
    snapshot.checks.map((check) => [
      `${check.id}\n${check.result}`,
      `${check.pbcCode}; ${check.account || "—"}\n${check.description}\nChecker: ${check.checker || "Missing"}; at: ${check.checkedAt || "Missing"}`,
      `Rule: ${check.rule}\nObserved: ${check.observed}\nEvidence: ${check.evidenceIds.length ? check.evidenceIds.join(", ") : "Missing"}\nException: ${check.exception || "None recorded"}\nPossible reason (hypothesis): ${check.possibleReason || "Not recorded"}\nOwner/remediation/resolution: ${check.owner || "Missing"} / ${check.remediation || "Not recorded"} / ${check.resolution || "Not recorded"}\nReview status: ${check.reviewStatus}`,
    ]),
    [39, 54, usable - 93],
  );

  heading("Evidence register");
  if (!snapshot.input.evidence.length)
    paragraph("No evidence records imported or attached.");
  for (const record of snapshot.input.evidence)
    table(
      ["ID / PBC", "Source evidence footprint"],
      [[`${record.id}\n${record.pbcCode}`, sourceFootprint(record, snapshot)]],
      [42, usable - 42],
    );

  heading("Exceptions & remediation");
  const exceptions = snapshot.checks.filter(
    (row) => row.result === "Exception" || row.result === "Needs evidence",
  );
  table(
    ["ID / status", "Exception, possible reason & action"],
    exceptions.length
      ? exceptions.map((row) => [
          `${row.id}\n${row.result}`,
          `Exception: ${row.exception || "Missing evidence or assessment"}\nPossible reason (hypothesis): ${row.possibleReason || "Not recorded"}\nOwner: ${row.owner || "Missing"}\nRemediation: ${row.remediation || "Not recorded"}\nResolution: ${row.resolution || "Not recorded"}\nReview status: ${row.reviewStatus}`,
        ])
      : [["None identified", "This does not constitute an audit opinion."]],
    [45, usable - 45],
  );

  doc.addPage();
  y = 22;
  heading("Reviewer signoff");
  paragraph(
    "Leave blank until an independent reviewer actually completes and documents a review.",
  );
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: 20, bottom: 20 },
    head: [["Field", "Reviewer entry"]],
    body: [
      ["Reviewer name", ""],
      ["Signature", ""],
      ["Date", ""],
      ["Decision", ""],
      ["Comments", ""],
    ],
    tableWidth: usable,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      textColor: dark,
      minCellHeight: 19,
      valign: "middle",
      cellPadding: 3,
      lineColor: "#d7e1e5",
      lineWidth: 0.15,
    },
    headStyles: { fillColor: dark, textColor: "#ffffff", fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: usable - 55 } },
  });

  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setDrawColor("#d7e1e5");
    doc.line(margin, 282, pageWidth - margin, 282);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor("#58707e");
    doc.text(
      `${snapshot.input.demo ? "SYNTHETIC DEMO · " : ""}${snapshot.packId} · ${snapshot.timestamp}`,
      margin,
      288,
    );
    doc.text(`${page} / ${total}`, pageWidth - margin, 288, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: (string | number)[][],
  widths: number[],
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 2 }],
  });
  sheet.addRow([name]);
  sheet.mergeCells(1, 1, 1, headers.length);
  sheet.getRow(1).height = 30;
  sheet.getRow(1).font = {
    name: "Aptos Display",
    size: 16,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF10263A" },
  };
  sheet.getRow(1).alignment = { vertical: "middle", indent: 1 };
  sheet.addRow(headers);
  sheet.getRow(2).height = 30;
  sheet.getRow(2).font = {
    name: "Aptos",
    size: 10,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getRow(2).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF126B70" },
  };
  sheet.getRow(2).alignment = { vertical: "middle", wrapText: true };
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  rows.forEach((values, index) => {
    const row = sheet.addRow(values.map(safeCell));
    row.alignment = { vertical: "top", wrapText: true };
    row.font = { name: "Aptos", size: 10, color: { argb: "FF10263A" } };
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: index % 2 ? "FFF1F6F6" : "FFFFFFFF" },
    };
    row.height = Math.min(
      400,
      Math.max(
        22,
        16 *
          Math.max(
            ...values.map((value, column) =>
              text(value)
                .split("\n")
                .reduce(
                  (lines, line) =>
                    lines +
                    Math.max(
                      1,
                      Math.ceil(
                        line.length / Math.max(15, (widths[column] || 20) - 2),
                      ),
                    ),
                  0,
                ),
            ),
          ),
      ),
    );
  });
  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: Math.max(2, sheet.rowCount), column: headers.length },
  };
  sheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    orientation: "landscape",
  };
  return sheet;
}

export async function buildXlsx(snapshot: Snapshot): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ledgerline Audit Pack Studio";
  workbook.created = new Date(snapshot.timestamp);
  const assurance = counts(
    criteria.map((row) => snapshot.criterionResults[row.id]),
  );
  addSheet(
    workbook,
    "Summary",
    ["Field", "Value"],
    [
      ["Pack ID", snapshot.packId],
      ["Snapshot timestamp (generated)", snapshot.timestamp],
      [
        "Demo marker",
        snapshot.input.demo ? "SYNTHETIC DEMO — NOT AUDIT EVIDENCE" : "No",
      ],
      ["Engagement", missing(snapshot.input.engagement)],
      ["Entity", missing(snapshot.input.entity)],
      ["Period", missing(snapshot.input.period)],
      ["Currency", missing(snapshot.input.currency)],
      [
        "Expected accounts",
        snapshot.input.expectedAccounts.length
          ? snapshot.input.expectedAccounts.join(", ")
          : "Missing",
      ],
      [
        "Expected account population evidence ID",
        missing(snapshot.input.expectedAccountEvidenceId),
      ],
      ["Criteria passed", assurance.passed],
      ["Criteria with exceptions", assurance.exception],
      ["Criteria needing evidence", assurance.evidence],
      ["Criteria not assessed", assurance.unassessed],
      ["Requirements workbook", sourceWorkbook],
      ["Requirements SHA-256", workbookHash],
      [
        "Limitation",
        "User-imported source identities and dates are claims; only actually attached files have computed hashes. No live connection or audit opinion.",
      ],
    ],
    [39, 110],
  );
  addSheet(
    workbook,
    "Check ledger",
    [
      "Check ID",
      "PBC",
      "Account",
      "What was checked",
      "Rule / expected",
      "Observed",
      "Result",
      "Checker",
      "Checked at",
      "Evidence IDs",
      "Exception",
      "Possible reason (hypothesis)",
      "Owner",
      "Remediation",
      "Resolution",
      "Review status",
    ],
    snapshot.checks.map((row) => [
      row.id,
      row.pbcCode,
      row.account,
      row.description,
      row.rule,
      row.observed,
      row.result,
      row.checker,
      row.checkedAt,
      row.evidenceIds.join(", ") || "Missing",
      row.exception,
      row.possibleReason,
      row.owner,
      row.remediation,
      row.resolution,
      row.reviewStatus,
    ]),
    [25, 14, 20, 48, 65, 65, 18, 25, 25, 32, 48, 48, 25, 38, 38, 26],
  );
  addSheet(
    workbook,
    "PBC coverage",
    [
      "PBC",
      "Workbook row",
      "PBC item",
      "Audit area",
      "Systems required",
      "Example audit evidence",
      "Full assurance parameters",
      "Overall criterion status",
      "Source evidence IDs",
      "Actually attached files",
    ],
    catalog.map((item) => [
      item.code,
      item.sourceRow,
      item.name,
      item.area,
      item.systems,
      item.exampleEvidence,
      item.assurance,
      snapshot.coverage[item.code],
      snapshot.input.evidence
        .filter((row) => row.pbcCode === item.code)
        .map((row) => row.id)
        .join(", ") || "Missing",
      snapshot.input.evidence
        .filter(
          (row) =>
            row.pbcCode === item.code &&
            getAttachment(snapshot.attachments, row.id),
        )
        .map((row) => getAttachment(snapshot.attachments, row.id)!.name)
        .join(", ") || "Missing",
    ]),
    [16, 24, 42, 30, 60, 70, 100, 22, 35, 42],
  );
  addSheet(
    workbook,
    "Assurance criteria",
    [
      "Criterion ID",
      "PBC",
      "Source cell",
      "Exact assurance statement",
      "Result",
      "Checker",
      "Checked at",
      "Evidence IDs",
      "Assessment note",
    ],
    criteria.map((row) => {
      const check = snapshot.checks.find((check) => check.id === row.id)!;
      return [
        row.id,
        row.pbcCode,
        row.sourceCell,
        row.text,
        check.result,
        check.checker,
        check.checkedAt,
        check.evidenceIds.join(", ") || "Missing",
        check.observed,
      ];
    }),
    [20, 16, 24, 100, 20, 28, 26, 35, 70],
  );
  addSheet(
    workbook,
    "Accounts",
    [
      "Recon ID",
      "Entity",
      "Account",
      "Currency",
      "Period",
      "Reference",
      "Bank closing (recon)",
      "Bank closing (source import)",
      "Signed adjustments",
      "Adjusted bank",
      "GL closing (recon)",
      "GL closing (source import)",
      "Reconciliation balance",
      "Zero-item population confirmed",
      "Preparer",
      "Prepared date",
      "Reviewer",
      "Reviewed date",
      "Evidence IDs",
    ],
    snapshot.input.reconciliations.map((row) => [
      row.id,
      row.entity,
      row.account,
      row.currency,
      row.period,
      row.reference,
      numeric(row.bankClosingBalance),
      numeric(
        snapshot.input.evidence.find(
          (entry) => entry.id === row.evidenceIds.bank,
        )?.sourceBalance || "",
      ),
      numeric(row.bankAdjustments),
      numeric(row.adjustedBankBalance),
      numeric(row.glClosingBalance),
      numeric(
        snapshot.input.evidence.find((entry) => entry.id === row.evidenceIds.gl)
          ?.sourceBalance || "",
      ),
      numeric(row.reconciliationBalance),
      row.outstandingPopulationConfirmed
        ? "Yes (imported declaration)"
        : "No / missing",
      row.preparedBy,
      row.preparedAt,
      row.reviewedBy,
      row.reviewedAt,
      Object.values(row.evidenceIds).join(", "),
    ]),
    [
      25, 20, 25, 13, 15, 28, 24, 25, 20, 20, 23, 25, 23, 25, 25, 18, 25, 18,
      45,
    ],
  );
  addSheet(
    workbook,
    "Outstanding items",
    [
      "Recon ID",
      "Account",
      "Item ID",
      "Signed amount",
      "Item date",
      "Support description",
      "Evidence ID",
      "Actual attachment",
    ],
    snapshot.input.reconciliations.flatMap((row) =>
      row.outstandingItems.map((item) => [
        row.id,
        row.account,
        item.id,
        numeric(item.amount),
        item.date || "Missing",
        item.support || "Missing",
        item.evidenceId || "Missing",
        getAttachment(snapshot.attachments, item.evidenceId)?.name || "Missing",
      ]),
    ),
    [24, 24, 24, 20, 18, 65, 30, 35],
  );
  addSheet(
    workbook,
    "Evidence",
    [
      "Evidence ID",
      "Kind",
      "PBC",
      "Source system (claimed)",
      "Original filename",
      "Version",
      "Record / report ID",
      "Report parameters",
      "Entity",
      "Account",
      "Currency",
      "Period",
      "Source balance (imported)",
      "Extraction timestamp (claimed)",
      "Source preparer",
      "Source prepared date",
      "Source reviewer",
      "Source reviewed date",
      "Declared SHA-256",
      "Actual attachment",
      "Capture timestamp",
      "Computed attachment SHA-256",
      "Limitations",
      "Missing field flags",
    ],
    snapshot.input.evidence.map((row) => {
      const attachment = getAttachment(snapshot.attachments, row.id);
      const absent = Object.entries(row)
        .filter(
          ([key, value]) =>
            !value && !["declaredSha256", "limitations"].includes(key),
        )
        .map(([key]) => key);
      if (!attachment) absent.push("actual attached file");
      return [
        row.id,
        row.kind,
        row.pbcCode,
        row.sourceSystem || "Missing",
        row.originalFilename || "Missing",
        row.version || "Missing",
        row.recordId || "Missing",
        row.reportParameters || "Missing",
        row.entity || "Missing",
        row.account || "Missing",
        row.currency || "Missing",
        row.period || "Missing",
        numeric(row.sourceBalance),
        row.extractedAt || "Missing",
        row.sourcePreparer || "Missing",
        row.sourcePreparedAt || "Missing",
        row.sourceReviewer || "Missing",
        row.sourceReviewedAt || "Missing",
        row.declaredSha256 || "Missing",
        attachment?.name || "Missing",
        attachment?.capturedAt || "Missing",
        attachment?.sha256 || "Missing",
        row.limitations || "Not stated",
        absent.join(", ") || "None",
      ];
    }),
    [
      25, 18, 16, 38, 38, 20, 30, 70, 20, 23, 14, 16, 25, 28, 25, 18, 25, 18,
      65, 38, 28, 65, 55, 55,
    ],
  );
  addSheet(
    workbook,
    "Metadata",
    ["Workbook row", "Parameter", "Purpose", "Entered value", "Status"],
    metadataFields.map((row) => [
      row.sourceRow,
      row.label,
      row.purpose,
      snapshot.input.metadata[row.label] || "Missing",
      snapshot.input.metadata[row.label]
        ? "Provided (source claim)"
        : "Needs evidence",
    ]),
    [32, 38, 90, 75, 27],
  );
  addSheet(
    workbook,
    "Exceptions",
    [
      "Check ID",
      "PBC",
      "Account",
      "Result",
      "Exception / gap",
      "Possible reason (hypothesis)",
      "Owner",
      "Remediation",
      "Resolution",
      "Review status",
      "Evidence IDs",
    ],
    snapshot.checks
      .filter(
        (row) => row.result === "Exception" || row.result === "Needs evidence",
      )
      .map((row) => [
        row.id,
        row.pbcCode,
        row.account,
        row.result,
        row.exception || "Missing evidence or assessment",
        row.possibleReason,
        row.owner,
        row.remediation,
        row.resolution,
        row.reviewStatus,
        row.evidenceIds.join(", ") || "Missing",
      ]),
    [28, 17, 24, 20, 60, 55, 25, 45, 45, 26, 35],
  );
  addSheet(
    workbook,
    "Reviewer signoff",
    ["Field", "Reviewer entry"],
    [
      ["Reviewer name", ""],
      ["Signature", ""],
      ["Date", ""],
      ["Decision", ""],
      ["Comments", ""],
    ],
    [35, 85],
  );
  const data = await workbook.xlsx.writeBuffer();
  return new Uint8Array(data as ArrayBuffer);
}
