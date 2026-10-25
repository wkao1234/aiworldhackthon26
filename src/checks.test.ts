import { describe, expect, it } from "vitest";
import { createSnapshot } from "./checks";
import { validatePack } from "./import";
import { cents, criteria, type Attachment, type PackInput } from "./model";
import { demoPack, templatePack } from "./sample";

const at = "2026-02-01T12:00:00Z";
function populated() {
  const pack = demoPack();
  pack.expectedAccounts = ["OPERATING-001"];
  pack.reconciliations = [pack.reconciliations[0]];
  pack.reconciliations[0].reviewSignoffEvidenceId = "OP-SIGNOFF";
  pack.expectedAccountEvidenceId = "OP-SCOPE";
  const evidence = pack.evidence[0];
  pack.evidence = pack.evidence.filter(
    (row) => row.account === "OPERATING-001",
  );
  pack.evidence.push({
    ...evidence,
    id: "OP-SCOPE",
    kind: "other",
    account: "",
    sourceSystem: "Synthetic treasury system",
  });
  pack.evidence.push({
    ...evidence,
    id: "OP-SIGNOFF",
    kind: "other",
    sourceSystem: "Synthetic review archive",
  });
  const attachments: Record<string, Attachment> = Object.fromEntries(
    pack.evidence.map((row) => [
      row.id,
      {
        name: `${row.id}.txt`,
        sha256: "a".repeat(64),
        capturedAt: at,
        size: 12,
      },
    ]),
  );
  return { pack, attachments };
}
const result = (
  pack: PackInput,
  attachments: Record<string, Attachment>,
  id: string,
) =>
  createSnapshot(pack, attachments, "PACK-TEST", at).checks.find(
    (row) => row.id === id,
  )?.result;

describe("bank reconciliation checks", () => {
  it("does not mistake inherited object keys for attached files", () => {
    const { pack } = populated();
    pack.evidence[0].id = "__proto__";
    const snapshot = createSnapshot(pack, {}, "PACK-TEST", at);
    expect(
      snapshot.checks.find((row) => row.id === "EVID-__proto__")?.result,
    ).toBe("Needs evidence");
  });
  it("matches distinct imported bank/GL source balances and passes all six bank criteria with evidence", () => {
    const { pack, attachments } = populated();
    const snapshot = createSnapshot(pack, attachments, "PACK-TEST", at);
    expect(
      snapshot.checks.find((row) => row.id === "BANK-REC-OP-BANK-SOURCE")
        ?.result,
    ).toBe("Passed");
    expect(
      snapshot.checks.find((row) => row.id === "BANK-REC-OP-GL-SOURCE")?.result,
    ).toBe("Passed");
    expect(
      criteria
        .filter((row) => row.pbcCode === "PBC-002")
        .map((row) => snapshot.criterionResults[row.id]),
    ).toEqual(Array(6).fill("Passed"));
  });
  it("flags mismatch and does not replace a missing balance with zero", () => {
    const { pack, attachments } = populated();
    pack.reconciliations[0].glClosingBalance = "99999.99";
    expect(result(pack, attachments, "BANK-REC-OP-GL")).toBe("Exception");
    pack.reconciliations[0].glClosingBalance = "";
    expect(result(pack, attachments, "BANK-REC-OP-GL")).toBe("Needs evidence");
    pack.reconciliations[0].glClosingBalance = "0.00";
    expect(result(pack, attachments, "BANK-REC-OP-GL")).toBe("Exception");
  });
  it("flags missing support, stale items, and dates after the period", () => {
    const { pack, attachments } = populated();
    const item = pack.reconciliations[0].outstandingItems[0];
    item.support = "";
    expect(result(pack, attachments, "BANK-REC-OP-ITEM-OP-1-SUPPORT")).toBe(
      "Needs evidence",
    );
    item.date = "2025-10-01";
    expect(result(pack, attachments, "BANK-REC-OP-ITEM-OP-1-AGE")).toBe(
      "Exception",
    );
    item.date = "2026-01-01";
    expect(result(pack, attachments, "BANK-REC-OP-ITEM-OP-1-AGE")).toBe(
      "Exception",
    );
  });
  it("requires a confirmed zero-item population and an account-scope attachment", () => {
    const { pack, attachments } = populated();
    pack.reconciliations[0].outstandingItems = [];
    pack.reconciliations[0].bankAdjustments = "0.00";
    pack.reconciliations[0].outstandingPopulationConfirmed = false;
    expect(result(pack, attachments, "BANK-REC-OP-NO-SUPPORT")).toBe(
      "Needs evidence",
    );
    pack.reconciliations[0].outstandingPopulationConfirmed = true;
    expect(result(pack, attachments, "BANK-REC-OP-NO-SUPPORT")).toBe("Passed");
    delete attachments["OP-SCOPE"];
    expect(result(pack, attachments, "BANK-SCOPE-SUPPORT")).toBe(
      "Needs evidence",
    );
  });
  it("requires independent review in chronological order and actual signoff evidence", () => {
    const { pack, attachments } = populated();
    const row = pack.reconciliations[0];
    row.reviewedBy = row.preparedBy;
    expect(result(pack, attachments, "BANK-REC-OP-REVIEW")).toBe("Exception");
    row.reviewedBy = "Another reviewer";
    row.reviewedAt = "2026-01-01";
    expect(result(pack, attachments, "BANK-REC-OP-REVIEW")).toBe("Exception");
    row.reviewedAt = "2026-01-07";
    delete attachments["OP-SIGNOFF"];
    expect(result(pack, attachments, "BANK-REC-OP-REVIEW")).toBe(
      "Needs evidence",
    );
  });
  it("sums cents exactly even when intermediate totals exceed safe integers", () => {
    const { pack, attachments } = populated();
    const row = pack.reconciliations[0];
    row.outstandingItems = [
      {
        id: "LARGE",
        amount: "90071992547409.91",
        date: "2025-12-20",
        support: "Large synthetic",
        evidenceId: "OP-SUPPORT",
      },
      {
        id: "TWO",
        amount: "0.02",
        date: "2025-12-20",
        support: "Small synthetic",
        evidenceId: "OP-SUPPORT",
      },
      {
        id: "OFFSET",
        amount: "-90071992547409.91",
        date: "2025-12-20",
        support: "Offset synthetic",
        evidenceId: "OP-SUPPORT",
      },
    ];
    row.bankAdjustments = "0.02";
    expect(result(pack, attachments, "BANK-REC-OP-ITEM-TIE")).toBe("Passed");
    expect(cents("90071992547409.92")).toBeNull();
  });
});

describe("structured import", () => {
  it("rejects malformed and normalized-invalid timestamps and amounts", () => {
    const pack = templatePack();
    pack.evidence[0].extractedAt = "2025-02-30T12:00:00Z";
    expect(validatePack(pack).errors.join(" ")).toContain("extractedAt");
    pack.evidence[0].extractedAt = "2025-02-28T25:00:00Z";
    expect(validatePack(pack).errors.join(" ")).toContain("extractedAt");
    pack.evidence[0].extractedAt = "2025-02-28T12:00:00Z";
    pack.reconciliations[0].bankClosingBalance = "2.345";
    expect(validatePack(pack).errors.join(" ")).toContain("bankClosingBalance");
  });
  it("rejects duplicates, missing outstanding population, and inconsistent source identity", () => {
    const pack = templatePack();
    pack.expectedAccounts.push("ACCOUNT-001");
    expect(validatePack(pack).errors.join(" ")).toContain("duplicate account");
    pack.expectedAccounts.pop();
    const raw = structuredClone(pack) as unknown as Record<string, unknown>;
    delete (raw.reconciliations as Record<string, unknown>[])[0]
      .outstandingItems;
    expect(validatePack(raw).errors.join(" ")).toContain(
      "outstandingItems must be provided",
    );
    pack.evidence[1].account = "WRONG";
    expect(validatePack(pack).errors.join(" ")).toContain(
      "inconsistent account",
    );
  });
  it("does not turn a whole-PBC or wrong-system manual claim into a pass", () => {
    const { pack, attachments } = populated();
    const criterion = criteria.find((row) => row.pbcCode === "PBC-001")!;
    pack.pbcAssessments = [
      {
        criterionId: criterion.id,
        result: "Passed",
        checker: "Human checker",
        checkedAt: "2026-01-10",
        evidenceIds: ["REC-OP-REC"],
        note: "Claimed pass",
        possibleReason: "",
        owner: "",
        remediation: "",
        resolution: "",
        reviewStatus: "",
      },
    ];
    expect(
      createSnapshot(pack, attachments, "PACK-TEST", at).criterionResults[
        criterion.id
      ],
    ).toBe("Exception");
    expect(
      createSnapshot(pack, attachments, "PACK-TEST", at).criterionResults[
        criteria.filter((row) => row.pbcCode === "PBC-001")[1].id
      ],
    ).toBe("Not assessed");
  });
});
