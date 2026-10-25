import {
  emptyPack,
  type EvidenceRecord,
  type PackInput,
  type Reconciliation,
} from "./model";

const evidence = (
  id: string,
  kind: EvidenceRecord["kind"],
  account: string,
  system: string,
): EvidenceRecord => ({
  id,
  kind,
  pbcCode: "PBC-002",
  sourceSystem: system,
  originalFilename: `${id}.pdf`,
  version: "Synthetic v1",
  recordId: `SYN-${id}`,
  reportParameters: `Synthetic example; entity: DEMOCO; account: ${account}; period: 2025-12`,
  entity: "DEMOCO",
  account,
  currency: "USD",
  period: "2025-12",
  extractedAt: "2026-01-05T10:00:00Z",
  sourcePreparer: "Synthetic operator",
  sourcePreparedAt: "2026-01-05",
  sourceReviewer: "Synthetic supervisor",
  sourceReviewedAt: "2026-01-06",
  declaredSha256: "",
  limitations:
    "Synthetic demonstration only; no source system connection or real attachment.",
  sourceBalance:
    kind === "bank"
      ? account === "OPERATING-001"
        ? "102500.00"
        : "48000.00"
      : kind === "gl"
        ? account === "OPERATING-001"
          ? "100000.00"
          : "49900.00"
        : "",
});

const reconciliation = (
  id: string,
  account: string,
  closing: string,
  adjustment: string,
  adjusted: string,
  gl: string,
): Reconciliation => ({
  id,
  entity: "DEMOCO",
  account,
  currency: "USD",
  period: "2025-12",
  reference: `SYN-${id}`,
  bankClosingBalance: closing,
  bankAdjustments: adjustment,
  adjustedBankBalance: adjusted,
  glClosingBalance: gl,
  reconciliationBalance: adjusted,
  outstandingItems: [],
  outstandingPopulationConfirmed: true,
  evidenceIds: {
    reconciliation: `${id}-REC`,
    bank: `${id}-BANK`,
    gl: `${id}-GL`,
  },
  preparedBy: "Demo preparer",
  preparedAt: "2026-01-06",
  reviewedBy: "Demo reviewer",
  reviewedAt: "2026-01-07",
  reviewSignoffEvidenceId: "",
  owner: "Demo treasury",
});

export function demoPack(): PackInput {
  const pack = emptyPack();
  pack.demo = true;
  pack.engagement = "Synthetic treasury close review";
  pack.entity = "DEMOCO";
  pack.period = "2025-12";
  pack.currency = "USD";
  pack.expectedAccounts = ["OPERATING-001", "PAYROLL-002", "RESERVE-003"];
  pack.expectedAccountEvidenceId = "";
  pack.metadata["Entity and scope"] =
    "DEMOCO; synthetic USD bank accounts; December 2025";
  pack.metadata["Population or sample"] = "Synthetic example population";
  pack.metadata["Data owner"] = "Demo treasury";
  pack.metadata["Preparer and reviewer"] =
    "Demo preparer / Demo reviewer (source-provided claims)";
  pack.metadata["Source system"] =
    "Synthetic treasury system; synthetic bank portal; synthetic ERP";
  pack.metadata["Report parameters"] = "Synthetic December 2025; DEMOCO; USD";
  pack.metadata["Extraction timestamp"] =
    "2026-01-05T10:00:00Z (synthetic source claim)";
  pack.metadata["Sensitive-data treatment"] =
    "No personal or real financial data in this demo";
  pack.metadata["File name and version"] = "Synthetic examples, v1";
  pack.metadata["Preparation and review dates"] =
    "2026-01-06 / 2026-01-07 (synthetic claims)";
  pack.metadata["Final status"] = "In progress — synthetic demonstration";
  const operating = reconciliation(
    "REC-OP",
    "OPERATING-001",
    "102500.00",
    "-2500.00",
    "100000.00",
    "100000.00",
  );
  operating.outstandingItems = [
    {
      id: "OP-1",
      amount: "-2500.00",
      date: "2025-12-20",
      support: "Synthetic outstanding check",
      evidenceId: "OP-SUPPORT",
    },
  ];
  const payroll = reconciliation(
    "REC-PAY",
    "PAYROLL-002",
    "48000.00",
    "2000.00",
    "50000.00",
    "49900.00",
  );
  payroll.outstandingItems = [
    {
      id: "PAY-1",
      amount: "2000.00",
      date: "2025-10-01",
      support: "",
      evidenceId: "",
    },
  ];
  payroll.reviewedBy = "Demo preparer";
  pack.reconciliations = [operating, payroll];
  pack.evidence = [
    evidence(
      "REC-OP-REC",
      "reconciliation",
      "OPERATING-001",
      "Synthetic treasury system",
    ),
    evidence("REC-OP-BANK", "bank", "OPERATING-001", "Synthetic bank portal"),
    evidence("REC-OP-GL", "gl", "OPERATING-001", "Synthetic ERP"),
    evidence(
      "REC-PAY-REC",
      "reconciliation",
      "PAYROLL-002",
      "Synthetic treasury system",
    ),
    evidence("REC-PAY-BANK", "bank", "PAYROLL-002", "Synthetic bank portal"),
    evidence("REC-PAY-GL", "gl", "PAYROLL-002", "Synthetic ERP"),
    evidence(
      "OP-SUPPORT",
      "other",
      "OPERATING-001",
      "Synthetic check register",
    ),
  ];
  return pack;
}

export function templatePack(): PackInput {
  const pack = emptyPack();
  pack.expectedAccounts = ["ACCOUNT-001"];
  pack.reconciliations = [
    {
      id: "REC-001",
      entity: "",
      account: "ACCOUNT-001",
      currency: "",
      period: "",
      reference: "",
      bankClosingBalance: "",
      bankAdjustments: "",
      adjustedBankBalance: "",
      glClosingBalance: "",
      reconciliationBalance: "",
      outstandingItems: [
        { id: "ITEM-001", amount: "", date: "", support: "", evidenceId: "" },
      ],
      outstandingPopulationConfirmed: false,
      evidenceIds: {
        reconciliation: "REC-EVID-001",
        bank: "BANK-EVID-001",
        gl: "GL-EVID-001",
      },
      preparedBy: "",
      preparedAt: "",
      reviewedBy: "",
      reviewedAt: "",
      reviewSignoffEvidenceId: "",
      owner: "",
    },
  ];
  pack.evidence = (["reconciliation", "bank", "gl"] as const).map(
    (kind, index) => ({
      id: ["REC-EVID-001", "BANK-EVID-001", "GL-EVID-001"][index],
      kind,
      pbcCode: "PBC-002",
      sourceSystem: "",
      originalFilename: "",
      version: "",
      recordId: "",
      reportParameters: "",
      entity: "",
      account: "ACCOUNT-001",
      currency: "",
      period: "",
      extractedAt: "",
      sourcePreparer: "",
      sourcePreparedAt: "",
      sourceReviewer: "",
      sourceReviewedAt: "",
      declaredSha256: "",
      sourceBalance: "",
      limitations: "",
    }),
  );
  return pack;
}
