import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createSnapshot } from "./checks";
import { validatePack } from "./import";
import { buildPdf, buildXlsx } from "./exports";
import { catalog, type Attachment } from "./model";
import { demoPack } from "./sample";

const at = "2026-02-01T00:00:00Z";

describe("evidence identity regressions", () => {
  it("never treats inherited object keys as attached files in checks or exports", async () => {
    const pack = demoPack();
    pack.expectedAccounts = ["OPERATING-001"];
    pack.reconciliations = [pack.reconciliations[0]];
    pack.evidence = pack.evidence.filter(
      (record) => record.account === "OPERATING-001",
    );
    pack.expectedAccountEvidenceId = "SCOPE";
    pack.reconciliations[0].reviewSignoffEvidenceId = "SIGNOFF";
    pack.evidence.push({
      ...pack.evidence[0],
      id: "SCOPE",
      kind: "other",
      account: "",
    });
    pack.evidence.push({ ...pack.evidence[0], id: "SIGNOFF", kind: "other" });
    const inherited = [
      "toString",
      "valueOf",
      "hasOwnProperty",
      "isPrototypeOf",
      "propertyIsEnumerable",
      "toLocaleString",
    ];
    const aliases = new Map(
      pack.evidence.map((record, i) => [record.id, inherited[i]]),
    );
    pack.evidence.forEach((record) => {
      record.id = aliases.get(record.id)!;
    });
    const reconciliation = pack.reconciliations[0];
    for (const kind of ["reconciliation", "bank", "gl"] as const)
      reconciliation.evidenceIds[kind] = aliases.get(
        reconciliation.evidenceIds[kind],
      )!;
    reconciliation.outstandingItems.forEach((item) => {
      item.evidenceId = aliases.get(item.evidenceId)!;
    });
    reconciliation.reviewSignoffEvidenceId = aliases.get("SIGNOFF")!;
    pack.expectedAccountEvidenceId = aliases.get("SCOPE")!;
    expect(validatePack(pack).errors).toEqual([]);
    const snapshot = createSnapshot(pack, {}, "NO-FILES", at);
    expect(
      snapshot.checks
        .filter((check) => check.id.startsWith("EVID-"))
        .every((check) => check.result === "Needs evidence"),
    ).toBe(true);
    expect(snapshot.coverage["PBC-002"]).toBe("Needs evidence");
    expect(buildPdf(snapshot).length).toBeGreaterThan(100);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Buffer.from(await buildXlsx(snapshot)) as unknown as ExcelJS.Buffer,
    );
    const sheet = workbook.getWorksheet("Evidence")!;
    const column = (sheet.getRow(2).values as unknown[]).indexOf(
      "Actual attachment",
    );
    expect(column).toBeGreaterThan(0);
    pack.evidence.forEach((_, index) =>
      expect(sheet.getRow(index + 3).getCell(column).value).toBe("Missing"),
    );
  }, 30000);

  it("does not require receivables accounts to appear in the bank account roster", () => {
    const pack = demoPack();
    const systems = catalog
      .find((item) => item.code === "PBC-003")!
      .systems.split(";")
      .map((value) => value.trim());
    pack.evidence = systems.map((system, index) => ({
      ...pack.evidence[0],
      id: `AR-${index}`,
      kind: "other" as const,
      pbcCode: "PBC-003",
      sourceSystem: system,
      account: "AR-1100",
    }));
    const attachments: Record<string, Attachment> = Object.fromEntries(
      pack.evidence.map((record) => [
        record.id,
        {
          name: record.originalFilename,
          sha256: "a".repeat(64),
          capturedAt: at,
          size: 100,
        },
      ]),
    );
    pack.pbcAssessments = [
      {
        criterionId: "PBC-003.2",
        result: "Passed",
        checker: "QA reviewer",
        checkedAt: "2026-01-10",
        evidenceIds: pack.evidence.map((record) => record.id),
        note: "Synthetic explicit human assessment",
        possibleReason: "",
        owner: "",
        remediation: "",
        resolution: "",
        reviewStatus: "",
      },
    ];
    expect(
      createSnapshot(pack, attachments, "NONBANK", at).criterionResults[
        "PBC-003.2"
      ],
    ).toBe("Passed");
    pack.evidence[0].entity = "OTHERCO";
    expect(
      createSnapshot(pack, attachments, "NONBANK", at).criterionResults[
        "PBC-003.2"
      ],
    ).toBe("Exception");
  });
});
