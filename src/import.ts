import {
  criteria,
  cents,
  emptyPack,
  metadataFields,
  type EvidenceRecord,
  type OutstandingItem,
  type PackInput,
  type PbcAssessment,
  type Reconciliation,
  validDate,
  validPeriod,
} from "./model";

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isoTimestamp = (value: string) => {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match || !validDate(match[1])) return false;
  const [, , hour, minute, second, zone, , offsetHour, offsetMinute] = match;
  if (+hour > 23 || +minute > 59 || +second > 59) return false;
  if (
    zone !== "Z" &&
    (+offsetHour > 14 ||
      +offsetMinute > 59 ||
      (+offsetHour === 14 && +offsetMinute !== 0))
  )
    return false;
  return !Number.isNaN(Date.parse(value));
};

export function validatePack(raw: unknown): {
  data?: PackInput;
  errors: string[];
} {
  const errors: string[] = [];
  if (!isRecord(raw)) return { errors: ["Root must be a JSON object."] };
  const string = (record: RecordValue, key: string, path: string): string => {
    const value = record[key];
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") {
      errors.push(`${path}.${key} must be text.`);
      return "";
    }
    return value.trim();
  };
  const object = (value: unknown, path: string): RecordValue => {
    if (value === undefined) return {};
    if (!isRecord(value)) {
      errors.push(`${path} must be an object.`);
      return {};
    }
    return value;
  };
  const array = (value: unknown, path: string): unknown[] => {
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array.`);
      return [];
    }
    return value;
  };
  const date = (value: string, path: string) => {
    if (value && !validDate(value))
      errors.push(`${path} must be a real YYYY-MM-DD date.`);
  };
  const timestamp = (value: string, path: string) => {
    if (value && !isoTimestamp(value))
      errors.push(`${path} must be an ISO timestamp with timezone.`);
  };
  const amount = (value: string, path: string) => {
    if (value && cents(value) === null)
      errors.push(`${path} must be a decimal amount with at most two places.`);
  };
  const period = (value: string, path: string) => {
    if (value && !validPeriod(value)) errors.push(`${path} must be YYYY-MM.`);
  };
  const readStrings = (value: unknown, path: string): string[] =>
    array(value, path).map((item, index) => {
      if (typeof item !== "string") {
        errors.push(`${path}[${index}] must be text.`);
        return "";
      }
      return item.trim();
    });

  const base = emptyPack();
  base.engagement = string(raw, "engagement", "pack");
  base.entity = string(raw, "entity", "pack");
  base.period = string(raw, "period", "pack");
  base.currency = string(raw, "currency", "pack").toUpperCase();
  period(base.period, "pack.period");
  base.expectedAccounts = readStrings(
    raw.expectedAccounts,
    "expectedAccounts",
  ).filter(Boolean);
  base.expectedAccountEvidenceId = string(
    raw,
    "expectedAccountEvidenceId",
    "pack",
  );
  if (
    new Set(base.expectedAccounts.map((account) => account.toLowerCase()))
      .size !== base.expectedAccounts.length
  )
    errors.push("expectedAccounts contains a duplicate account.");
  if (raw.staleDays !== undefined) {
    if (
      !Number.isInteger(raw.staleDays) ||
      (raw.staleDays as number) < 0 ||
      (raw.staleDays as number) > 3650
    )
      errors.push("staleDays must be an integer from 0 to 3650.");
    else base.staleDays = raw.staleDays as number;
  }
  if (raw.demo !== undefined && typeof raw.demo !== "boolean")
    errors.push("demo must be a boolean.");
  base.demo = raw.demo === true;
  const metadata = object(raw.metadata, "metadata");
  for (const field of metadataFields)
    base.metadata[field.label] = string(metadata, field.label, "metadata");

  base.evidence = array(raw.evidence, "evidence").map(
    (item, index): EvidenceRecord => {
      const path = `evidence[${index}]`,
        record = object(item, path);
      const kind = string(record, "kind", path);
      if (kind && !["reconciliation", "bank", "gl", "other"].includes(kind))
        errors.push(`${path}.kind is unsupported.`);
      const result: EvidenceRecord = {
        id: string(record, "id", path),
        kind: (kind || "other") as EvidenceRecord["kind"],
        pbcCode: string(record, "pbcCode", path),
        sourceSystem: string(record, "sourceSystem", path),
        originalFilename: string(record, "originalFilename", path),
        version: string(record, "version", path),
        recordId: string(record, "recordId", path),
        reportParameters: string(record, "reportParameters", path),
        entity: string(record, "entity", path),
        account: string(record, "account", path),
        currency: string(record, "currency", path).toUpperCase(),
        period: string(record, "period", path),
        extractedAt: string(record, "extractedAt", path),
        sourcePreparer: string(record, "sourcePreparer", path),
        sourcePreparedAt: string(record, "sourcePreparedAt", path),
        sourceReviewer: string(record, "sourceReviewer", path),
        sourceReviewedAt: string(record, "sourceReviewedAt", path),
        declaredSha256: string(record, "declaredSha256", path),
        limitations: string(record, "limitations", path),
        sourceBalance: string(record, "sourceBalance", path),
      };
      period(result.period, `${path}.period`);
      timestamp(result.extractedAt, `${path}.extractedAt`);
      date(result.sourcePreparedAt, `${path}.sourcePreparedAt`);
      date(result.sourceReviewedAt, `${path}.sourceReviewedAt`);
      if (
        result.declaredSha256 &&
        !/^[a-fA-F0-9]{64}$/.test(result.declaredSha256)
      )
        errors.push(`${path}.declaredSha256 must be 64 hex characters.`);
      amount(result.sourceBalance, `${path}.sourceBalance`);
      return result;
    },
  );

  base.reconciliations = array(raw.reconciliations, "reconciliations").map(
    (item, index): Reconciliation => {
      const path = `reconciliations[${index}]`,
        record = object(item, path),
        refs = object(record.evidenceIds, `${path}.evidenceIds`);
      if (record.outstandingItems === undefined)
        errors.push(
          `${path}.outstandingItems must be provided, even when empty.`,
        );
      if (typeof record.outstandingPopulationConfirmed !== "boolean")
        errors.push(
          `${path}.outstandingPopulationConfirmed must be true or false.`,
        );
      const items: OutstandingItem[] = array(
        record.outstandingItems,
        `${path}.outstandingItems`,
      ).map((entry, itemIndex) => {
        const itemPath = `${path}.outstandingItems[${itemIndex}]`,
          value = object(entry, itemPath);
        const result = {
          id: string(value, "id", itemPath),
          amount: string(value, "amount", itemPath),
          date: string(value, "date", itemPath),
          support: string(value, "support", itemPath),
          evidenceId: string(value, "evidenceId", itemPath),
        };
        amount(result.amount, `${itemPath}.amount`);
        date(result.date, `${itemPath}.date`);
        return result;
      });
      const result: Reconciliation = {
        id: string(record, "id", path),
        entity: string(record, "entity", path),
        account: string(record, "account", path),
        currency: string(record, "currency", path).toUpperCase(),
        period: string(record, "period", path),
        reference: string(record, "reference", path),
        bankClosingBalance: string(record, "bankClosingBalance", path),
        bankAdjustments: string(record, "bankAdjustments", path),
        adjustedBankBalance: string(record, "adjustedBankBalance", path),
        glClosingBalance: string(record, "glClosingBalance", path),
        reconciliationBalance: string(record, "reconciliationBalance", path),
        outstandingItems: items,
        outstandingPopulationConfirmed:
          record.outstandingPopulationConfirmed === true,
        evidenceIds: {
          reconciliation: string(refs, "reconciliation", `${path}.evidenceIds`),
          bank: string(refs, "bank", `${path}.evidenceIds`),
          gl: string(refs, "gl", `${path}.evidenceIds`),
        },
        preparedBy: string(record, "preparedBy", path),
        preparedAt: string(record, "preparedAt", path),
        reviewedBy: string(record, "reviewedBy", path),
        reviewedAt: string(record, "reviewedAt", path),
        reviewSignoffEvidenceId: string(
          record,
          "reviewSignoffEvidenceId",
          path,
        ),
        owner: string(record, "owner", path),
      };
      period(result.period, `${path}.period`);
      date(result.preparedAt, `${path}.preparedAt`);
      date(result.reviewedAt, `${path}.reviewedAt`);
      for (const key of [
        "bankClosingBalance",
        "bankAdjustments",
        "adjustedBankBalance",
        "glClosingBalance",
        "reconciliationBalance",
      ] as const)
        amount(result[key], `${path}.${key}`);
      if (
        new Set(items.map((row) => row.id.toLowerCase())).size !== items.length
      )
        errors.push(`${path}.outstandingItems has duplicate IDs.`);
      return result;
    },
  );

  base.pbcAssessments = array(raw.pbcAssessments, "pbcAssessments").map(
    (item, index): PbcAssessment => {
      const path = `pbcAssessments[${index}]`,
        record = object(item, path),
        result = string(record, "result", path);
      if (
        result &&
        !["Passed", "Exception", "Needs evidence", "Not assessed"].includes(
          result,
        )
      )
        errors.push(`${path}.result is unsupported.`);
      const assessment: PbcAssessment = {
        criterionId: string(record, "criterionId", path),
        result: (result || "Not assessed") as PbcAssessment["result"],
        checker: string(record, "checker", path),
        checkedAt: string(record, "checkedAt", path),
        evidenceIds: readStrings(record.evidenceIds, `${path}.evidenceIds`),
        note: string(record, "note", path),
        possibleReason: string(record, "possibleReason", path),
        owner: string(record, "owner", path),
        remediation: string(record, "remediation", path),
        resolution: string(record, "resolution", path),
        reviewStatus: string(record, "reviewStatus", path),
      };
      date(assessment.checkedAt, `${path}.checkedAt`);
      if (!criteria.some((entry) => entry.id === assessment.criterionId))
        errors.push(`${path}.criterionId is not in the assurance checklist.`);
      return assessment;
    },
  );
  if (
    new Set(base.evidence.map((row) => row.id.toLowerCase())).size !==
    base.evidence.length
  )
    errors.push("Evidence IDs must be unique.");
  if (
    new Set(base.reconciliations.map((row) => row.id.toLowerCase())).size !==
    base.reconciliations.length
  )
    errors.push("Reconciliation IDs must be unique.");
  if (
    new Set(
      base.reconciliations.map((row) =>
        `${row.entity}|${row.account}|${row.period}`.toLowerCase(),
      ),
    ).size !== base.reconciliations.length
  )
    errors.push("Duplicate entity/account/period reconciliation.");
  if (
    new Set(base.pbcAssessments.map((row) => row.criterionId)).size !==
    base.pbcAssessments.length
  )
    errors.push("Duplicate assurance criterion assessment.");
  for (const [index, row] of base.reconciliations.entries()) {
    const path = `reconciliations[${index}]`;
    if (base.entity && row.entity && base.entity !== row.entity)
      errors.push(`${path}.entity conflicts with pack.entity.`);
    if (base.currency && row.currency && base.currency !== row.currency)
      errors.push(`${path}.currency conflicts with pack.currency.`);
    if (base.period && row.period && base.period !== row.period)
      errors.push(`${path}.period conflicts with pack.period.`);
    for (const [kind, id] of Object.entries(row.evidenceIds)) {
      if (!id) continue;
      const evidence = base.evidence.find((record) => record.id === id);
      if (evidence && evidence.kind !== kind)
        errors.push(
          `${path}.evidenceIds.${kind} points to ${evidence.kind} evidence.`,
        );
      if (evidence)
        for (const key of [
          "entity",
          "account",
          "currency",
          "period",
        ] as const) {
          if (evidence[key] && row[key] && evidence[key] !== row[key])
            errors.push(
              `${path}.evidenceIds.${kind} has inconsistent ${key} versus its reconciliation.`,
            );
        }
    }
  }
  return errors.length ? { errors } : { data: base, errors: [] };
}

export function parsePackJson(text: string): {
  data?: PackInput;
  errors: string[];
} {
  try {
    return validatePack(JSON.parse(text));
  } catch (error) {
    return {
      errors: [
        `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}
