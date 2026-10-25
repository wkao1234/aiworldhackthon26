import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSnapshot } from "./checks";
import { loadDemoDataset } from "./demo";
import { parsePackJson } from "./import";
import { criteria, metadataFields, type Attachment } from "./model";

const root = join(process.cwd(), "public", "demo");
afterEach(() => vi.unstubAllGlobals());

describe("downloadable synthetic dataset", () => {
  it("validates every source hash and demonstrates the expected passes and exceptions", async () => {
    const importJson = await readFile(join(root, "demo-pack.json"), "utf8");
    expect(importJson.length).toBeLessThan(60_000);
    const parsed = parsePackJson(importJson);
    expect(parsed.errors).toEqual([]);
    const pack = parsed.data!;
    expect(pack.demo).toBe(true);
    expect(pack.evidence).toHaveLength(40);
    expect(pack.pbcAssessments).toHaveLength(51);
    expect(
      metadataFields.every((field) => Boolean(pack.metadata[field.label])),
    ).toBe(true);
    const attachments: Record<string, Attachment> = {};
    for (const record of pack.evidence) {
      const bytes = await readFile(
        join(root, "sources", record.originalFilename),
      );
      const digest = createHash("sha256").update(bytes).digest("hex");
      expect(digest).toBe(record.declaredSha256);
      expect(JSON.parse(bytes.toString()).classification).toBe(
        "SYNTHETIC DEMO - NOT AUDIT EVIDENCE",
      );
      if (record.pbcCode !== "PBC-002") {
        expect(record.sourcePreparedAt >= "2026-01-12").toBe(true);
        expect(record.sourceReviewedAt >= record.sourcePreparedAt).toBe(true);
        expect(record.extractedAt.slice(0, 10) >= record.sourceReviewedAt).toBe(
          true,
        );
      }
      attachments[record.id] = {
        name: record.originalFilename,
        sha256: digest,
        capturedAt: "2026-10-25T23:00:00Z",
        size: bytes.length,
      };
    }
    const snapshot = createSnapshot(
      pack,
      attachments,
      "DEMO-TEST",
      "2026-10-25T23:00:00Z",
    );
    const result = (id: string) =>
      snapshot.checks.find((check) => check.id === id)?.result;
    expect(result("BANK-REC-OP-GL")).toBe("Passed");
    expect(result("BANK-REC-OP-REVIEW")).toBe("Passed");
    expect(result("BANK-REC-OP-ITEM-OP-1-SUPPORT")).toBe("Passed");
    expect(result("BANK-REC-PAY-GL")).toBe("Exception");
    expect(result("BANK-REC-PAY-REVIEW")).toBe("Exception");
    expect(result("BANK-REC-PAY-ITEM-PAY-1-AGE")).toBe("Exception");
    expect(result("BANK-REC-PAY-ITEM-PAY-1-SUPPORT")).toBe("Needs evidence");
    expect(result("BANK-SCOPE-RESERVE-003")).toBe("Needs evidence");
    expect(result("PBC-009.2")).toBe("Exception");
    expect(result("PBC-009.6")).toBe("Exception");
    expect(
      criteria.every((criterion) => snapshot.criterionResults[criterion.id]),
    ).toBe(true);
    expect(
      snapshot.checks
        .filter((check) => check.id.startsWith("EVID-"))
        .every((check) => check.result === "Passed"),
    ).toBe(true);
    expect(snapshot.coverage["PBC-001"]).toBe("Passed");
  });

  it("loads actual source bytes and rejects tampered demo evidence", async () => {
    let tamper = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const relative = url.replace(/^.*?demo\//, "");
        const bytes = await readFile(join(root, relative));
        return new Response(
          tamper && relative.includes("sources/")
            ? "tampered"
            : bytes.toString(),
        );
      }),
    );
    const loaded = await loadDemoDataset();
    expect(Object.keys(loaded.files)).toHaveLength(40);
    expect(Object.keys(loaded.attachments)).toHaveLength(40);
    expect(await loaded.files["REC-OP-BANK"].text()).toContain(
      "Fictional Harbor Bank",
    );
    tamper = true;
    await expect(loadDemoDataset()).rejects.toThrow("hash mismatch");
  });
});
