import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSnapshot } from "./checks";
import { loadDemoDataset, type DemoScenario } from "./demo";
import { parsePackJson } from "./import";
import { criteria, metadataFields, type Attachment } from "./model";

const root = join(process.cwd(), "public", "demo");
afterEach(() => vi.unstubAllGlobals());

describe("downloadable synthetic dataset", () => {
  it("accepts the complete clean scenario and passes every check with its actual evidence files", async () => {
    const cleanRoot = join(root, "clean");
    const json = await readFile(
      join(cleanRoot, "demo-pack-clean.json"),
      "utf8",
    );
    expect(json.length).toBeLessThan(60_000);
    const parsed = parsePackJson(json);
    expect(parsed.errors).toEqual([]);
    const pack = parsed.data!;
    expect(pack.demo).toBe(true);
    expect(pack.reconciliations).toHaveLength(3);
    expect(pack.evidence).toHaveLength(45);
    expect(pack.pbcAssessments).toHaveLength(51);
    const attachments: Record<string, Attachment> = {};
    for (const record of pack.evidence) {
      const bytes = await readFile(
        join(cleanRoot, "sources", record.originalFilename),
      );
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      expect(sha256).toBe(record.declaredSha256);
      expect(JSON.parse(bytes.toString()).classification).toBe(
        "SYNTHETIC DEMO - NOT AUDIT EVIDENCE",
      );
      attachments[record.id] = {
        name: record.originalFilename,
        sha256,
        capturedAt: "2026-10-25T23:00:00Z",
        size: bytes.length,
      };
    }
    const snapshot = createSnapshot(
      pack,
      attachments,
      "CLEAN-DEMO-TEST",
      "2026-10-25T23:00:00Z",
    );
    expect(
      snapshot.checks.filter((check) => check.result !== "Passed"),
    ).toEqual([]);
    expect(Object.values(snapshot.criterionResults)).toEqual(
      Array(57).fill("Passed"),
    );
    expect(Object.values(snapshot.coverage)).toEqual(Array(10).fill("Passed"));
    // Structured input alone must not manufacture evidence attachments.
    expect(
      createSnapshot(
        pack,
        {},
        "CLEAN-NO-FILES",
        "2026-10-25T23:00:00Z",
      ).checks.some((check) => check.result === "Needs evidence"),
    ).toBe(true);
  });

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

  it.each([
    ["exceptions", 40],
    ["clean", 45],
  ] as const)(
    "loads actual %s source bytes and rejects tampered evidence",
    async (scenario, fileCount) => {
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
      const loaded = await loadDemoDataset(scenario);
      expect(Object.keys(loaded.files)).toHaveLength(fileCount);
      expect(Object.keys(loaded.attachments)).toHaveLength(fileCount);
      expect(await loaded.files["REC-OP-BANK"].text()).toContain(
        "Fictional Harbor Bank",
      );
      if (scenario === "clean") {
        const snapshot = createSnapshot(
          loaded.pack,
          loaded.attachments,
          "CLEAN-LOADER",
          "2026-10-25T23:00:00Z",
        );
        expect(
          snapshot.checks.every((check) => check.result === "Passed"),
        ).toBe(true);
        expect(loaded.files["REC-OP-BANK"].name).toMatch(/^CLEAN-/);
      }
      tamper = true;
      await expect(loadDemoDataset(scenario)).rejects.toThrow("hash mismatch");
    },
  );

  it("rejects unknown scenarios before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadDemoDataset("../private" as DemoScenario)).rejects.toThrow(
      "Unknown demo scenario",
    );
    await expect(loadDemoDataset("__proto__" as DemoScenario)).rejects.toThrow(
      "Unknown demo scenario",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
