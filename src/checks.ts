import {
  catalog,
  cents,
  criteria,
  metadataFields,
  money,
  moneyBig,
  periodEnd,
  type Attachment,
  type Check,
  type EvidenceRecord,
  type PackInput,
  type Result,
} from "./model";

export interface Snapshot {
  packId: string;
  timestamp: string;
  input: PackInput;
  attachments: Record<string, Attachment>;
  checks: Check[];
  criterionResults: Record<string, Result>;
  coverage: Record<string, Result>;
}

const severity: Record<Result, number> = {
  Passed: 0,
  "Not assessed": 1,
  "Needs evidence": 2,
  Exception: 3,
};
function evidenceScope(
  record: EvidenceRecord | undefined,
  expected: Partial<
    Pick<EvidenceRecord, "entity" | "account" | "currency" | "period">
  >,
) {
  const missing: string[] = [],
    mismatches: string[] = [];
  if (!record) return { missing: ["source record"], mismatches };
  if (!record.pbcCode) missing.push("PBC code");
  else if (record.pbcCode !== "PBC-002")
    mismatches.push(`PBC ${record.pbcCode} vs PBC-002`);
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    if (!expected[key] || !record[key]) missing.push(key);
    else if (record[key] !== expected[key])
      mismatches.push(`${key}: ${record[key]} vs ${expected[key]}`);
  }
  return { missing, mismatches };
}
export function aggregate(results: Result[]): Result {
  if (!results.length) return "Not assessed";
  return results.reduce(
    (worst, result) => (severity[result] > severity[worst] ? result : worst),
    "Passed",
  );
}

export function createSnapshot(
  input: PackInput,
  attachments: Record<string, Attachment>,
  packId: string,
  timestamp: string,
): Snapshot {
  const checks: Check[] = [];
  const evidenceMap = new Map(input.evidence.map((row) => [row.id, row]));
  const bankCriteria = criteria.filter((row) => row.pbcCode === "PBC-002");
  const criterionChecks: Record<string, Check[]> = Object.fromEntries(
    bankCriteria.map((row) => [row.id, []]),
  );
  const auto = (
    id: string,
    description: string,
    rule: string,
    observed: string,
    result: Result,
    account = "",
    evidenceIds: string[] = [],
    exception = "",
    possibleReason = "",
    owner = "",
    criterionId = "",
  ) => {
    const check: Check = {
      id,
      pbcCode: "PBC-002",
      account,
      description,
      rule,
      observed,
      result,
      checker: "Automated engine",
      checkedAt: timestamp,
      evidenceIds: evidenceIds.filter(Boolean),
      exception: result === "Passed" ? "" : exception,
      possibleReason: result === "Passed" ? "" : possibleReason,
      owner,
      remediation: "",
      resolution: "",
      reviewStatus: "Pending reviewer signoff",
    };
    checks.push(check);
    if (criterionId) criterionChecks[criterionId].push(check);
    return check;
  };
  const hasAttachment = (id: string) => Boolean(attachments[id]);
  const evidenceFields = (record: EvidenceRecord): string[] => {
    const required: (keyof EvidenceRecord)[] = [
      "sourceSystem",
      "originalFilename",
      "version",
      "recordId",
      "reportParameters",
      "entity",
      "currency",
      "period",
      "extractedAt",
      "sourcePreparer",
      "sourcePreparedAt",
      "sourceReviewer",
      "sourceReviewedAt",
    ];
    const fields = required.filter((key) => !record[key]);
    if (record.kind !== "other" && !record.account) fields.push("account");
    if (
      (record.kind === "bank" || record.kind === "gl") &&
      !record.sourceBalance
    )
      fields.push("sourceBalance");
    return fields;
  };

  for (const record of input.evidence) {
    const attachment = attachments[record.id];
    const missing = evidenceFields(record);
    if (!attachment)
      missing.push("actual attached file / computed SHA-256 / capture time");
    let result: Result = missing.length ? "Needs evidence" : "Passed";
    let exception = missing.length ? `Missing: ${missing.join(", ")}` : "";
    if (
      attachment &&
      record.declaredSha256 &&
      record.declaredSha256.toLowerCase() !== attachment.sha256.toLowerCase()
    ) {
      result = "Exception";
      exception = "Declared file SHA-256 differs from attached file SHA-256.";
    }
    if (
      record.sourcePreparedAt &&
      record.sourceReviewedAt &&
      record.sourceReviewedAt < record.sourcePreparedAt
    ) {
      result = "Exception";
      exception =
        "Source-provided review date precedes source-provided preparation date.";
    }
    checks.push({
      id: `EVID-${record.id}`,
      pbcCode: record.pbcCode || "Unassigned",
      account: record.account,
      description: `${record.kind} evidence provenance and attachment`,
      rule: "Source fields, separate source identities/dates, and an actual attached file with computed hash are required.",
      observed: `Source: ${record.sourceSystem || "Missing"}; record: ${record.recordId || "Missing"}; extracted: ${record.extractedAt || "Missing"}; attached: ${attachment ? attachment.name : "Missing"}`,
      result,
      checker: "Automated engine",
      checkedAt: timestamp,
      evidenceIds: [record.id],
      exception,
      possibleReason: missing.length
        ? "Hypothesis: source metadata or file was not supplied."
        : "",
      owner: "",
      remediation: "",
      resolution: "",
      reviewStatus: "Pending reviewer signoff",
    });
  }

  if (!input.expectedAccounts.length)
    auto(
      "BANK-SCOPE",
      "Expected account population",
      "List all material in-scope bank accounts.",
      "Expected account list is empty.",
      "Needs evidence",
      "",
      [],
      "Completeness cannot be assessed without an expected account list.",
      "Hypothesis: account scope has not been supplied.",
      "",
      bankCriteria[0].id,
    );
  const scopeEvidence = evidenceMap.get(input.expectedAccountEvidenceId);
  const scopeMatch = evidenceScope(scopeEvidence, {
    entity: input.entity,
    currency: input.currency,
    period: input.period,
  });
  const scopeSupported = Boolean(
    input.expectedAccountEvidenceId &&
    hasAttachment(input.expectedAccountEvidenceId) &&
    !scopeMatch.missing.length &&
    !scopeMatch.mismatches.length,
  );
  auto(
    "BANK-SCOPE-SUPPORT",
    "Expected account list source",
    "Expected material account list requires attached PBC-002 evidence for the same entity, currency and period.",
    scopeMatch.mismatches.length
      ? scopeMatch.mismatches.join("; ")
      : scopeSupported
        ? `Attached ${input.expectedAccountEvidenceId}`
        : `Missing scope evidence: ${scopeMatch.missing.join(", ") || "actual attachment"}.`,
    scopeMatch.mismatches.length
      ? "Exception"
      : scopeSupported
        ? "Passed"
        : "Needs evidence",
    "",
    [input.expectedAccountEvidenceId],
    scopeMatch.mismatches.length
      ? "Account population evidence belongs to a different scope."
      : scopeSupported
        ? ""
        : "Expected account list lacks matching attached scope evidence.",
    scopeSupported
      ? ""
      : "Hypothesis: an account population report was omitted or extracted for a different scope.",
    "",
    bankCriteria[0].id,
  );
  for (const account of input.expectedAccounts) {
    const matches = input.reconciliations.filter(
      (row) => row.account === account,
    );
    auto(
      `BANK-SCOPE-${account}`,
      `Account completeness: ${account}`,
      "Exactly one reconciliation per expected account.",
      `${matches.length} reconciliation(s)`,
      matches.length === 1
        ? "Passed"
        : matches.length === 0
          ? "Needs evidence"
          : "Exception",
      account,
      matches.flatMap((row) => Object.values(row.evidenceIds)),
      matches.length === 1
        ? ""
        : `Expected one reconciliation; found ${matches.length}.`,
      matches.length === 0
        ? "Hypothesis: reconciliation was not included."
        : "Hypothesis: duplicate account population.",
      "",
      bankCriteria[0].id,
    );
  }
  for (const row of input.reconciliations) {
    const account = row.account || row.id || "Unidentified account";
    const refs = Object.values(row.evidenceIds).filter(Boolean);
    const name = (suffix: string) => `BANK-${row.id || account}-${suffix}`;
    if (!input.expectedAccounts.includes(row.account))
      auto(
        name("SCOPE"),
        `Unexpected account: ${account}`,
        "Account must be on the expected account list.",
        "Account absent from expected list.",
        input.expectedAccounts.length ? "Exception" : "Needs evidence",
        account,
        refs,
        "Account population differs from scope.",
        "Hypothesis: scope list is incomplete.",
        row.owner,
        bankCriteria[0].id,
      );
    const sourceRows = (["reconciliation", "bank", "gl"] as const).map(
      (kind) => ({
        kind,
        id: row.evidenceIds[kind],
        record: evidenceMap.get(row.evidenceIds[kind]),
      }),
    );
    const sourceMissing = sourceRows
      .filter((entry) => !entry.id || !entry.record || !hasAttachment(entry.id))
      .map((entry) => entry.kind);
    auto(
      name("PROVENANCE"),
      `Three-source evidence footprint: ${account}`,
      "Attach reconciliation, bank statement and GL evidence separately.",
      sourceMissing.length
        ? `Missing attached ${sourceMissing.join(", ")}`
        : "Three separate files attached.",
      sourceMissing.length ? "Needs evidence" : "Passed",
      account,
      refs,
      sourceMissing.length
        ? `Missing actual attached source files: ${sourceMissing.join(", ")}.`
        : "",
      sourceMissing.length ? "Hypothesis: source files were not supplied." : "",
      row.owner,
    );
    const hasCoreEvidence = sourceMissing.length === 0;
    const numeric = [
      "bankClosingBalance",
      "bankAdjustments",
      "adjustedBankBalance",
      "glClosingBalance",
      "reconciliationBalance",
    ] as const;
    const value = Object.fromEntries(
      numeric.map((key) => [key, row[key] ? cents(row[key]) : null]),
    ) as Record<(typeof numeric)[number], number | null>;
    const complete = numeric.every((key) => value[key] !== null);
    const balance = complete
      ? BigInt(value.bankClosingBalance!) + BigInt(value.bankAdjustments!)
      : null;
    auto(
      name("ARITHMETIC"),
      `Adjusted bank arithmetic: ${account}`,
      "Bank closing balance + signed adjustments = adjusted bank balance; zero tolerance.",
      `${money(value.bankClosingBalance, row.currency)} + ${money(value.bankAdjustments, row.currency)} = ${moneyBig(balance, row.currency)}; reported ${money(value.adjustedBankBalance, row.currency)}`,
      !complete
        ? "Needs evidence"
        : balance === BigInt(value.adjustedBankBalance!)
          ? "Passed"
          : "Exception",
      account,
      refs,
      complete && balance !== BigInt(value.adjustedBankBalance!)
        ? "Adjusted balance does not recalculate."
        : !complete
          ? "A required amount is missing."
          : "",
      complete && balance !== BigInt(value.adjustedBankBalance!)
        ? "Hypothesis: adjustment sign or amount may be wrong."
        : "",
      row.owner,
      bankCriteria[1].id,
    );
    const sourceBank = sourceRows.find(
      (entry) => entry.kind === "bank",
    )?.record;
    const sourceGl = sourceRows.find((entry) => entry.kind === "gl")?.record;
    const sourceBankValue = sourceBank?.sourceBalance
      ? cents(sourceBank.sourceBalance)
      : null;
    const sourceGlValue = sourceGl?.sourceBalance
      ? cents(sourceGl.sourceBalance)
      : null;
    auto(
      name("BANK-SOURCE"),
      `Bank statement source amount: ${account}`,
      "Imported bank source closing balance equals reconciliation-transcribed bank closing balance. Attachment content is not parsed.",
      `${money(sourceBankValue, row.currency)} source vs ${money(value.bankClosingBalance, row.currency)} reconciliation`,
      sourceBankValue === null || value.bankClosingBalance === null
        ? "Needs evidence"
        : sourceBankValue === value.bankClosingBalance
          ? "Passed"
          : "Exception",
      account,
      [row.evidenceIds.bank, row.evidenceIds.reconciliation],
      sourceBankValue !== null &&
        value.bankClosingBalance !== null &&
        sourceBankValue !== value.bankClosingBalance
        ? "Imported bank and reconciliation balances differ."
        : "",
      "Hypothesis: wrong statement or transcribed amount.",
      row.owner,
      bankCriteria[1].id,
    );
    auto(
      name("GL-SOURCE"),
      `GL source amount: ${account}`,
      "Imported GL source closing balance equals reconciliation-transcribed GL closing balance. Attachment content is not parsed.",
      `${money(sourceGlValue, row.currency)} source vs ${money(value.glClosingBalance, row.currency)} reconciliation`,
      sourceGlValue === null || value.glClosingBalance === null
        ? "Needs evidence"
        : sourceGlValue === value.glClosingBalance
          ? "Passed"
          : "Exception",
      account,
      [row.evidenceIds.gl, row.evidenceIds.reconciliation],
      sourceGlValue !== null &&
        value.glClosingBalance !== null &&
        sourceGlValue !== value.glClosingBalance
        ? "Imported GL and reconciliation balances differ."
        : "",
      "Hypothesis: wrong GL report or transcribed amount.",
      row.owner,
      bankCriteria[1].id,
    );
    auto(
      name("GL"),
      `Adjusted bank to GL: ${account}`,
      "Adjusted bank balance equals GL closing balance; zero tolerance.",
      `${money(value.adjustedBankBalance, row.currency)} vs ${money(value.glClosingBalance, row.currency)}`,
      value.adjustedBankBalance === null || value.glClosingBalance === null
        ? "Needs evidence"
        : value.adjustedBankBalance === value.glClosingBalance
          ? "Passed"
          : "Exception",
      account,
      refs,
      value.adjustedBankBalance !== null &&
        value.glClosingBalance !== null &&
        value.adjustedBankBalance !== value.glClosingBalance
        ? "Adjusted bank and GL differ."
        : "",
      "Hypothesis: an entry may be unposted or an item may be omitted.",
      row.owner,
      bankCriteria[1].id,
    );
    auto(
      name("RECON"),
      `Reconciliation balance reference: ${account}`,
      "Reconciliation reported balance equals adjusted bank balance.",
      `${money(value.reconciliationBalance, row.currency)} vs ${money(value.adjustedBankBalance, row.currency)}`,
      value.reconciliationBalance === null || value.adjustedBankBalance === null
        ? "Needs evidence"
        : value.reconciliationBalance === value.adjustedBankBalance
          ? "Passed"
          : "Exception",
      account,
      refs,
      value.reconciliationBalance !== null &&
        value.adjustedBankBalance !== null &&
        value.reconciliationBalance !== value.adjustedBankBalance
        ? "Reconciliation reported balance differs."
        : "",
      "",
      row.owner,
      bankCriteria[1].id,
    );
    const itemCents = row.outstandingItems.map((item) =>
      item.amount ? cents(item.amount) : null,
    );
    const itemSum = itemCents.every((item) => item !== null)
      ? itemCents.reduce<bigint>((sum, item) => sum + BigInt(item!), 0n)
      : null;
    auto(
      name("ITEM-TIE"),
      `Outstanding items to adjustments: ${account}`,
      "Signed outstanding-item amounts sum to signed bank adjustments.",
      `${moneyBig(itemSum, row.currency)} vs ${money(value.bankAdjustments, row.currency)}`,
      itemSum === null || value.bankAdjustments === null
        ? "Needs evidence"
        : itemSum === BigInt(value.bankAdjustments)
          ? "Passed"
          : "Exception",
      account,
      refs,
      itemSum !== null &&
        value.bankAdjustments !== null &&
        itemSum !== BigInt(value.bankAdjustments)
        ? "Outstanding items do not tie to adjustments."
        : "",
      "Hypothesis: an outstanding item may be omitted or signed incorrectly.",
      row.owner,
      bankCriteria[2].id,
    );
    for (const item of row.outstandingItems) {
      const itemEvidence = evidenceMap.get(item.evidenceId);
      const itemMatch = evidenceScope(itemEvidence, {
        entity: row.entity,
        account: row.account,
        currency: row.currency,
        period: row.period,
      });
      const supported = Boolean(
        item.support &&
        item.evidenceId &&
        hasAttachment(item.evidenceId) &&
        !itemMatch.missing.length &&
        !itemMatch.mismatches.length,
      );
      auto(
        name(`ITEM-${item.id}-SUPPORT`),
        `Outstanding support: ${item.id}`,
        "Each item has a support description and attached PBC-002 evidence matching entity, account, currency and period.",
        `${item.support || "No support description"}; ${item.evidenceId || "no evidence ID"}; ${hasAttachment(item.evidenceId) ? "file attached" : "no file attached"}; ${itemMatch.mismatches.length ? itemMatch.mismatches.join("; ") : itemMatch.missing.length ? `Missing scope: ${itemMatch.missing.join(", ")}` : "scope aligned"}`,
        itemMatch.mismatches.length
          ? "Exception"
          : supported
            ? "Passed"
            : "Needs evidence",
        account,
        [item.evidenceId],
        itemMatch.mismatches.length
          ? "Outstanding item support belongs to a different scope."
          : supported
            ? ""
            : "Outstanding item support is incomplete.",
        supported
          ? ""
          : "Hypothesis: supporting evidence was omitted or belongs to another scope.",
        row.owner,
        bankCriteria[2].id,
      );
      const end = periodEnd(row.period);
      const days =
        end && item.date
          ? Math.floor(
              (end.getTime() - new Date(`${item.date}T00:00:00Z`).getTime()) /
                86400000,
            )
          : null;
      auto(
        name(`ITEM-${item.id}-AGE`),
        `Outstanding age: ${item.id}`,
        `Flag items older than ${input.staleDays} days at period end.`,
        days === null ? "Item date or period missing." : `${days} days`,
        days === null
          ? "Needs evidence"
          : days < 0 || days > input.staleDays
            ? "Exception"
            : "Passed",
        account,
        [item.evidenceId],
        days !== null && days < 0
          ? "Item date falls after the reconciliation period end."
          : days !== null && days > input.staleDays
            ? `Stale item exceeds ${input.staleDays} days.`
            : "",
        "Hypothesis: clearing or investigation may be delayed.",
        row.owner,
        bankCriteria[3].id,
      );
    }
    if (!row.outstandingItems.length) {
      const confirmedZero =
        row.outstandingPopulationConfirmed &&
        value.bankAdjustments === 0 &&
        hasCoreEvidence;
      auto(
        name("NO-ITEMS"),
        `Outstanding age: ${account}`,
        "Explicitly confirm zero outstanding-item population with zero adjustments and attached source files.",
        confirmedZero
          ? "Zero population explicitly confirmed."
          : "Zero-item population not substantiated.",
        confirmedZero ? "Passed" : "Needs evidence",
        account,
        refs,
        "",
        "",
        row.owner,
        bankCriteria[3].id,
      );
      auto(
        name("NO-SUPPORT"),
        `Outstanding support: ${account}`,
        "Document absence of outstanding items with attached reconciliation evidence.",
        confirmedZero
          ? "Zero population explicitly confirmed."
          : "Zero-item population not substantiated.",
        confirmedZero ? "Passed" : "Needs evidence",
        account,
        refs,
        "",
        "",
        row.owner,
        bankCriteria[2].id,
      );
    }
    const mismatch: string[] = [],
      missing: string[] = [];
    for (const key of ["entity", "currency", "period"] as const) {
      if (!input[key] || !row[key]) missing.push(`engagement.${key}`);
      else if (input[key] !== row[key])
        mismatch.push(
          `engagement.${key}: ${input[key]} vs reconciliation ${row[key]}`,
        );
    }
    for (const source of sourceRows) {
      if (!source.record) {
        missing.push(`${source.kind} record`);
        continue;
      }
      if (source.record.pbcCode !== "PBC-002")
        mismatch.push(
          `${source.kind}.pbcCode: ${source.record.pbcCode} vs PBC-002`,
        );
      for (const key of ["entity", "account", "currency", "period"] as const) {
        const actual = source.record[key],
          expected = row[key];
        if (!actual || !expected) missing.push(`${source.kind}.${key}`);
        else if (actual !== expected)
          mismatch.push(`${source.kind}.${key}: ${actual} vs ${expected}`);
      }
    }
    auto(
      name("CONSISTENCY"),
      `Source identity consistency: ${account}`,
      "Reconciliation, bank and GL entity/account/currency/period agree.",
      mismatch.length
        ? mismatch.join("; ")
        : missing.length
          ? `Missing ${missing.join(", ")}`
          : "All source identity fields agree.",
      mismatch.length
        ? "Exception"
        : missing.length
          ? "Needs evidence"
          : "Passed",
      account,
      refs,
      mismatch.join("; "),
      mismatch.length
        ? "Hypothesis: an incorrect report or filter was supplied."
        : "",
      row.owner,
      bankCriteria[4].id,
    );
    const independent =
      row.preparedBy && row.reviewedBy && row.preparedAt && row.reviewedAt;
    const same = Boolean(
      row.preparedBy &&
      row.reviewedBy &&
      row.preparedBy.toLowerCase() === row.reviewedBy.toLowerCase(),
    );
    const reversed = Boolean(
      row.preparedAt && row.reviewedAt && row.reviewedAt < row.preparedAt,
    );
    const signoff = evidenceMap.get(row.reviewSignoffEvidenceId);
    const signoffMatch = evidenceScope(signoff, {
      entity: row.entity,
      account: row.account,
      currency: row.currency,
      period: row.period,
    });
    const signoffAttached = Boolean(
      row.reviewSignoffEvidenceId &&
      hasAttachment(row.reviewSignoffEvidenceId) &&
      !signoffMatch.missing.length &&
      !signoffMatch.mismatches.length,
    );
    auto(
      name("REVIEW"),
      `Independent reconciliation review: ${account}`,
      "Named preparer and different named reviewer, with review on or after preparation.",
      `Prepared ${row.preparedBy || "Missing"} ${row.preparedAt || "Missing"}; reviewed ${row.reviewedBy || "Missing"} ${row.reviewedAt || "Missing"}`,
      same || reversed || signoffMatch.mismatches.length
        ? "Exception"
        : !independent || !signoffAttached
          ? "Needs evidence"
          : "Passed",
      account,
      [row.evidenceIds.reconciliation, row.reviewSignoffEvidenceId],
      same
        ? "Preparer and reviewer are the same named person."
        : reversed
          ? "Review date precedes preparation date."
          : signoffMatch.mismatches.length
            ? `Review signoff scope mismatch: ${signoffMatch.mismatches.join("; ")}`
            : !independent
              ? "Review identity or date missing."
              : !signoffAttached
                ? "Matching attached independent review signoff evidence missing."
                : "",
      same ? "Hypothesis: independent review was not performed." : "",
      row.owner,
      bankCriteria[5].id,
    );
  }

  const criterionResults: Record<string, Result> = {};
  for (const criterion of criteria) {
    const related = criterionChecks[criterion.id];
    const assessment = input.pbcAssessments.find(
      (row) => row.criterionId === criterion.id,
    );
    let result: Result,
      observed: string,
      ids: string[] = [];
    if (related) {
      ids = [...new Set(related.flatMap((row) => row.evidenceIds))];
      const evidStatus = checks
        .filter(
          (row) =>
            row.id.startsWith("EVID-") && ids.includes(row.evidenceIds[0]),
        )
        .map((row) => row.result);
      result = aggregate([...related.map((row) => row.result), ...evidStatus]);
      if (!related.length) result = "Needs evidence";
      observed = `${related.filter((row) => row.result === "Passed").length}/${related.length} bank checks passed; ${evidStatus.filter((result) => result === "Passed").length}/${evidStatus.length} provenance records complete.`;
    } else if (!assessment || assessment.result === "Not assessed") {
      result = "Not assessed";
      observed = "No criterion-level human assessment supplied.";
    } else {
      ids = assessment.evidenceIds;
      const linked = ids.map((id) => evidenceMap.get(id));
      const pbc = catalog.find((row) => row.code === criterion.pbcCode)!;
      const requiredSystems = pbc.systems
        .split(";")
        .map((system) => system.trim().toLowerCase());
      const suppliedSystems = new Set(
        linked
          .filter((row): row is EvidenceRecord => Boolean(row))
          .map((row) => row.sourceSystem.toLowerCase()),
      );
      const missingSystems = requiredSystems.filter(
        (system) => !suppliedSystems.has(system),
      );
      const mismatch = linked.some(
        (row) =>
          row &&
          (row.pbcCode !== criterion.pbcCode ||
            Boolean(
              input.entity && row.entity && row.entity !== input.entity,
            ) ||
            Boolean(
              input.period && row.period && row.period !== input.period,
            ) ||
            Boolean(
              input.currency && row.currency && row.currency !== input.currency,
            ) ||
            Boolean(
              row.account &&
              input.expectedAccounts.length &&
              !input.expectedAccounts.includes(row.account),
            )),
      );
      const eligible = Boolean(
        assessment.checker &&
        assessment.checkedAt &&
        ids.length &&
        ids.every((id) => evidenceMap.has(id) && hasAttachment(id)) &&
        !missingSystems.length,
      );
      const provenances = checks.filter(
        (row) => row.id.startsWith("EVID-") && ids.includes(row.evidenceIds[0]),
      );
      result = mismatch
        ? "Exception"
        : !eligible || provenances.some((row) => row.result !== "Passed")
          ? "Needs evidence"
          : assessment.result;
      observed = `${assessment.note || "No assessment note"}; checker ${assessment.checker || "Missing"}; date ${assessment.checkedAt || "Missing"}; attached evidence ${ids.filter(hasAttachment).length}/${ids.length}; missing required systems ${missingSystems.join(", ") || "none"}; scope mismatch ${mismatch ? "yes" : "no"}`;
    }
    criterionResults[criterion.id] = result;
    checks.push({
      id: criterion.id,
      pbcCode: criterion.pbcCode,
      account: "",
      description: criterion.text,
      rule: `${criterion.sourceCell}: ${criterion.text}`,
      observed,
      result,
      checker: related
        ? "Automated engine"
        : assessment?.checker || "Unassigned",
      checkedAt: related ? timestamp : assessment?.checkedAt || "",
      evidenceIds: ids,
      exception:
        result === "Exception"
          ? assessment?.note ||
            "One or more underlying checks found an exception."
          : result === "Needs evidence"
            ? "Criterion lacks required evidence or assessment."
            : "",
      possibleReason: assessment?.possibleReason || "",
      owner: assessment?.owner || "",
      remediation: assessment?.remediation || "",
      resolution: assessment?.resolution || "",
      reviewStatus: assessment?.reviewStatus || "Pending reviewer signoff",
    });
  }
  for (const [index, field] of metadataFields.entries()) {
    const value = input.metadata[field.label];
    checks.push({
      id: `META-${String(index + 1).padStart(2, "0")}`,
      pbcCode: "Metadata",
      account: "",
      description: field.label,
      rule: `${field.sourceRow}: ${field.purpose}`,
      observed: value || "Missing",
      result: value ? "Passed" : "Needs evidence",
      checker: "Automated presence check",
      checkedAt: timestamp,
      evidenceIds: [],
      exception: value ? "" : "Required metadata not supplied.",
      possibleReason: value
        ? ""
        : "Hypothesis: pack metadata has not been completed.",
      owner: "",
      remediation: "",
      resolution: "",
      reviewStatus: "Pending reviewer signoff",
    });
  }
  const coverage = Object.fromEntries(
    catalog.map((item) => [
      item.code,
      aggregate(
        criteria
          .filter((row) => row.pbcCode === item.code)
          .map((row) => criterionResults[row.id]),
      ),
    ]),
  );
  return {
    packId,
    timestamp,
    input,
    attachments,
    checks,
    criterionResults,
    coverage,
  };
}
