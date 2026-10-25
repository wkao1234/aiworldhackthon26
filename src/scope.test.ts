import { describe, it, expect } from "vitest";
import { createSnapshot } from "./checks";
import { demoPack } from "./sample";
import type { Attachment } from "./model";

function fixture() {
  const pack = demoPack();
  pack.expectedAccounts = ["OPERATING-001"];
  pack.reconciliations = [pack.reconciliations[0]];
  pack.evidence = pack.evidence.filter((e) => e.account === "OPERATING-001");
  pack.expectedAccountEvidenceId = "SCOPE";
  pack.reconciliations[0].reviewSignoffEvidenceId = "SIGNOFF";
  pack.evidence.push({
    ...pack.evidence[0],
    id: "SCOPE",
    kind: "other",
    account: "",
  });
  pack.evidence.push({ ...pack.evidence[0], id: "SIGNOFF", kind: "other" });
  const attachments: Record<string, Attachment> = Object.fromEntries(
    pack.evidence.map((e) => [
      e.id,
      {
        name: e.originalFilename,
        sha256: "a".repeat(64),
        capturedAt: "2026-02-01T00:00:00Z",
        size: 100,
      },
    ]),
  );
  return { pack, attachments };
}

describe("independent scope review", () => {
  it("does not accept another entity account roster as completeness support", () => {
    const { pack, attachments } = fixture();
    pack.evidence.find((e) => e.id === "SCOPE")!.entity = "OTHERCO";
    expect(
      createSnapshot(pack, attachments, "ROOT", "2026-02-01T00:00:00Z")
        .criterionResults["PBC-002.1"],
    ).toBe("Exception");
  });
  it("does not accept prior period signoff as current independent review", () => {
    const { pack, attachments } = fixture();
    pack.evidence.find((e) => e.id === "SIGNOFF")!.period = "2025-11";
    expect(
      createSnapshot(pack, attachments, "ROOT", "2026-02-01T00:00:00Z")
        .criterionResults["PBC-002.6"],
    ).toBe("Exception");
  });
  it("does not accept another entity outstanding item support", () => {
    const { pack, attachments } = fixture();
    pack.evidence.find((e) => e.id === "OP-SUPPORT")!.entity = "OTHERCO";
    expect(
      createSnapshot(pack, attachments, "ROOT", "2026-02-01T00:00:00Z")
        .criterionResults["PBC-002.3"],
    ).toBe("Exception");
  });
  it("rechecks engagement scope when the intake fields are edited after import", () => {
    const { pack, attachments } = fixture();
    pack.currency = "EUR";
    expect(
      createSnapshot(pack, attachments, "ROOT", "2026-02-01T00:00:00Z")
        .criterionResults["PBC-002.5"],
    ).toBe("Exception");
  });
});
