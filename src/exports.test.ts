import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { createSnapshot } from "./checks";
import { buildPdf, buildXlsx } from "./exports";
import {
  catalog,
  criteria,
  emptyPack,
  metadataFields,
  type Attachment,
} from "./model";
import { demoPack } from "./sample";

const qa = join(process.cwd(), ".qa");
const at = "2026-02-01T12:00:00Z";

describe("real export files", () => {
  it("writes parseable populated PDF/XLSX fixtures with matching identity, numeric amounts and demo markers", async () => {
    await mkdir(join(qa, "evidence"), { recursive: true });
    const pack = demoPack();
    const attachments: Record<string, Attachment> = {};
    for (const record of pack.evidence) {
      const name = `${record.id}.txt`,
        bytes = Buffer.from(
          `SYNTHETIC QA FILE\n${record.id}\n${record.kind}\n`,
          "utf8",
        );
      await writeFile(join(qa, "evidence", name), bytes);
      attachments[record.id] = {
        name,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        capturedAt: at,
        size: bytes.length,
      };
    }
    const snapshot = createSnapshot(pack, attachments, "AP-QA-POPULATED", at);
    const pdf = buildPdf(snapshot),
      xlsx = await buildXlsx(snapshot);
    await writeFile(join(qa, "populated.pdf"), pdf);
    await writeFile(join(qa, "populated.xlsx"), xlsx);
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(xlsx) as unknown as ExcelJS.Buffer);
    expect(workbook.getWorksheet("Summary")?.getCell("B3").value).toBe(
      "AP-QA-POPULATED",
    );
    expect(workbook.getWorksheet("Summary")?.getCell("B5").value).toBe(
      "SYNTHETIC DEMO — NOT AUDIT EVIDENCE",
    );
    expect(workbook.getWorksheet("PBC coverage")?.rowCount).toBe(
      catalog.length + 2,
    );
    expect(workbook.getWorksheet("Assurance criteria")?.rowCount).toBe(
      criteria.length + 2,
    );
    expect(workbook.getWorksheet("Metadata")?.rowCount).toBe(
      metadataFields.length + 2,
    );
    expect(workbook.getWorksheet("Accounts")?.getCell("G3").value).toBe(102500);
    expect(workbook.getWorksheet("Accounts")?.getCell("H3").value).toBe(102500);
    expect(
      workbook.getWorksheet("Reviewer signoff")?.getCell("B3").value,
    ).toBeFalsy();
  }, 30000);

  it("writes sparse long-text exports without inventing check completion and escapes formula-like text", async () => {
    await mkdir(qa, { recursive: true });
    const pack = emptyPack();
    pack.engagement = "LONG IDENTIFIER ".repeat(70);
    pack.metadata["Entity and scope"] = " =2+2";
    pack.metadata["Sensitive-data treatment"] = "Long limitation text ".repeat(
      100,
    );
    const snapshot = createSnapshot(pack, {}, "AP-QA-SPARSE", at);
    const pdf = buildPdf(snapshot),
      xlsx = await buildXlsx(snapshot);
    await writeFile(join(qa, "sparse-long.pdf"), pdf);
    await writeFile(join(qa, "sparse-long.xlsx"), xlsx);
    expect(snapshot.coverage["PBC-002"]).toBe("Needs evidence");
    expect(snapshot.coverage["PBC-001"]).toBe("Not assessed");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(xlsx) as unknown as ExcelJS.Buffer);
    expect(workbook.getWorksheet("Metadata")?.getCell("D3").value).toBe(
      "' =2+2",
    );
    expect(
      workbook.getWorksheet("Reviewer signoff")?.getCell("B3").value,
    ).toBeFalsy();
  }, 30000);
});
