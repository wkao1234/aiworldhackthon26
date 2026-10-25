import extract from "../inputs/workbook-extract.json";

export type Result = "Passed" | "Exception" | "Needs evidence" | "Not assessed";
export type EvidenceKind = "reconciliation" | "bank" | "gl" | "other";

export interface EvidenceRecord {
  id: string;
  kind: EvidenceKind;
  pbcCode: string;
  sourceSystem: string;
  originalFilename: string;
  version: string;
  recordId: string;
  reportParameters: string;
  entity: string;
  account: string;
  currency: string;
  period: string;
  extractedAt: string;
  sourcePreparer: string;
  sourcePreparedAt: string;
  sourceReviewer: string;
  sourceReviewedAt: string;
  declaredSha256: string;
  sourceBalance: string;
  limitations: string;
}

export interface OutstandingItem {
  id: string;
  amount: string;
  date: string;
  support: string;
  evidenceId: string;
}

export interface Reconciliation {
  id: string;
  entity: string;
  account: string;
  currency: string;
  period: string;
  reference: string;
  bankClosingBalance: string;
  bankAdjustments: string;
  adjustedBankBalance: string;
  glClosingBalance: string;
  reconciliationBalance: string;
  outstandingItems: OutstandingItem[];
  outstandingPopulationConfirmed: boolean;
  evidenceIds: { reconciliation: string; bank: string; gl: string };
  preparedBy: string;
  preparedAt: string;
  reviewedBy: string;
  reviewedAt: string;
  reviewSignoffEvidenceId: string;
  owner: string;
}

export interface PbcAssessment {
  criterionId: string;
  result: Result;
  checker: string;
  checkedAt: string;
  evidenceIds: string[];
  note: string;
  possibleReason: string;
  owner: string;
  remediation: string;
  resolution: string;
  reviewStatus: string;
}

export interface PackInput {
  engagement: string;
  entity: string;
  period: string;
  currency: string;
  expectedAccounts: string[];
  expectedAccountEvidenceId: string;
  staleDays: number;
  metadata: Record<string, string>;
  reconciliations: Reconciliation[];
  evidence: EvidenceRecord[];
  pbcAssessments: PbcAssessment[];
  demo: boolean;
}

export interface Attachment {
  name: string;
  sha256: string;
  capturedAt: string;
  size: number;
}

export function getAttachment(
  attachments: Record<string, Attachment>,
  id: string,
): Attachment | undefined {
  return Object.hasOwn(attachments, id) ? attachments[id] : undefined;
}

export interface Check {
  id: string;
  pbcCode: string;
  account: string;
  description: string;
  rule: string;
  observed: string;
  result: Result;
  checker: string;
  checkedAt: string;
  evidenceIds: string[];
  exception: string;
  possibleReason: string;
  owner: string;
  remediation: string;
  resolution: string;
  reviewStatus: string;
}

export interface CatalogItem {
  code: string;
  name: string;
  area: string;
  systems: string;
  exampleEvidence: string;
  assurance: string;
  sourceRow: string;
}

export interface Criterion {
  id: string;
  pbcCode: string;
  text: string;
  sourceCell: string;
}

const pbcCells = new Map(
  extract.sheets[0].cells.map((cell) => [cell.cell, cell.value]),
);
export const catalog: CatalogItem[] = Array.from({ length: 10 }, (_, index) => {
  const row = index + 2;
  return {
    code: pbcCells.get(`A${row}`) ?? "",
    name: pbcCells.get(`B${row}`) ?? "",
    area: pbcCells.get(`C${row}`) ?? "",
    systems: pbcCells.get(`D${row}`) ?? "",
    exampleEvidence: pbcCells.get(`E${row}`) ?? "",
    assurance: pbcCells.get(`F${row}`) ?? "",
    sourceRow: `PBC List!A${row}:F${row}`,
  };
});
export const criteria: Criterion[] = catalog.flatMap((item) =>
  item.assurance.split(";").map((text, index) => ({
    id: `${item.code}.${index + 1}`,
    pbcCode: item.code,
    text: text.trim(),
    sourceCell: `${item.sourceRow.split("!")[0]}!F${Number(item.sourceRow.match(/A(\d+)/)?.[1])}`,
  })),
);

const metaCells = new Map(
  extract.sheets[1].cells.map((cell) => [cell.cell, cell.value]),
);
export const metadataFields = Array.from({ length: 17 }, (_, index) => {
  const row = index + 2;
  return {
    label: metaCells.get(`A${row}`) ?? "",
    purpose: metaCells.get(`B${row}`) ?? "",
    sourceRow: `Audit pack metadata!A${row}:B${row}`,
  };
});

export const workbookHash = extract.sha256;
export const sourceWorkbook = extract.source;

export function emptyPack(): PackInput {
  return {
    engagement: "",
    entity: "",
    period: "",
    currency: "",
    expectedAccounts: [],
    expectedAccountEvidenceId: "",
    staleDays: 30,
    metadata: Object.fromEntries(
      metadataFields.map((field) => [field.label, ""]),
    ),
    reconciliations: [],
    evidence: [],
    pbcAssessments: [],
    demo: false,
  };
}

export function cents(value: string): number | null {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return null;
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? (negative ? -result : result) : null;
}

export function money(value: number | null, currency = ""): string {
  return moneyBig(value === null ? null : BigInt(value), currency);
}

export function moneyBig(value: bigint | null, currency = ""): string {
  if (value === null) return "Missing";
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${currency ? `${currency} ` : ""}${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function validPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function periodEnd(value: string): Date | null {
  if (!validPeriod(value)) return null;
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0));
}
