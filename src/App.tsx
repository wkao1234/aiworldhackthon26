import { useMemo, useRef, useState, type ChangeEvent } from "react";
import workbookUrl from "../inputs/Hackathon PBC & Metadata.xlsx?url";
import { createSnapshot } from "./checks";
import { downloadBytes } from "./download";
import { parsePackJson } from "./import";
import {
  getAttachment,
  catalog,
  criteria,
  emptyPack,
  metadataFields,
  sourceWorkbook,
  workbookHash,
  type Attachment,
  type PackInput,
  type PbcAssessment,
  type Result,
} from "./model";
import { templatePack } from "./sample";
import { loadDemoDataset } from "./demo";

const identity = () => ({
  id: `AP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
  at: new Date().toISOString(),
});
const tone = (result: Result) =>
  result === "Passed"
    ? "pass"
    : result === "Exception"
      ? "exception"
      : result === "Needs evidence"
        ? "evidence"
        : "unassessed";
const statusOrder: Result[] = [
  "Exception",
  "Needs evidence",
  "Not assessed",
  "Passed",
];

function Badge({ result }: { result: Result }) {
  return <span className={`badge ${tone(result)}`}>{result}</span>;
}

function Field({
  label,
  value,
  onChange,
  hint,
  type = "text",
  wide = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  type?: string;
  wide?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {hint && <small>{hint}</small>}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export default function App() {
  const [pack, setPack] = useState<PackInput>(() => emptyPack());
  const [attachments, setAttachments] = useState<Record<string, Attachment>>(
    {},
  );
  const fileStore = useRef<Record<string, File>>(Object.create(null));
  const attachmentEpoch = useRef(0);
  const attachmentVersions = useRef<Record<string, number>>(
    Object.create(null),
  );
  const pendingHashes = useRef(0);
  const inputGeneration = useRef(0);
  const demoLoadVersion = useRef(0);
  const [demoLoading, setDemoLoading] = useState(false);
  const [revision, setRevision] = useState(identity);
  const [editor, setEditor] = useState(() =>
    JSON.stringify(templatePack(), null, 2),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState<Result | "All">("All");
  const [query, setQuery] = useState("");
  const snapshot = useMemo(
    () => createSnapshot(pack, attachments, revision.id, revision.at),
    [pack, attachments, revision],
  );
  const counts = useMemo(
    () =>
      statusOrder.map((result) => ({
        result,
        count: snapshot.checks.filter((check) => check.result === result)
          .length,
      })),
    [snapshot],
  );
  const bank = useMemo(
    () =>
      snapshot.checks.filter(
        (check) => check.pbcCode === "PBC-002" && !check.id.startsWith("PBC-"),
      ),
    [snapshot],
  );
  const visibleChecks = snapshot.checks.filter(
    (check) =>
      (filter === "All" || check.result === filter) &&
      `${check.id} ${check.description} ${check.account} ${check.exception}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const attachedCount = Object.keys(attachments).length;

  function commit(next: PackInput, clearAttachments = false) {
    inputGeneration.current += 1;
    setPack(next);
    setRevision(identity());
    setErrors([]);
    setNotice("");
    if (clearAttachments) {
      attachmentEpoch.current += 1;
      attachmentVersions.current = Object.create(null);
      fileStore.current = Object.create(null);
      setAttachments({});
    }
    setEditor(JSON.stringify(next, null, 2));
  }
  function change<K extends keyof PackInput>(key: K, value: PackInput[K]) {
    commit({ ...pack, [key]: value });
  }
  function applyEditor() {
    inputGeneration.current += 1;
    const parsed = parsePackJson(editor);
    if (!parsed.data) {
      setErrors(parsed.errors);
      setNotice(
        "Import rejected. The previous working pack and attachments are unchanged.",
      );
      return;
    }
    commit(parsed.data, true);
    setNotice(
      "Validated JSON applied. Attachments were cleared because imported references must be reattached.",
    );
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const generation = ++inputGeneration.current;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setErrors([
        "Choose a .json structured evidence file. Other formats are not parsed.",
      ]);
      return;
    }
    try {
      const contents = await file.text();
      if (generation !== inputGeneration.current) return;
      const parsed = parsePackJson(contents);
      if (!parsed.data) {
        setErrors(parsed.errors);
        setNotice(
          "Import rejected. The previous working pack and attachments are unchanged.",
        );
        return;
      }
      commit(parsed.data, true);
      setNotice(
        `${file.name} imported. Attach each source file to its matching evidence ID.`,
      );
    } catch (error) {
      if (generation !== inputGeneration.current) return;
      setErrors([
        `Could not read ${file.name}: ${error instanceof Error ? error.message : String(error)}`,
      ]);
      setNotice(
        "Import rejected. The previous working pack and attachments are unchanged.",
      );
    }
  }
  async function attach(id: string, file: File | undefined) {
    if (!file) return;
    inputGeneration.current += 1;
    const epoch = attachmentEpoch.current;
    const version = (attachmentVersions.current[id] || 0) + 1;
    attachmentVersions.current[id] = version;
    pendingHashes.current += 1;
    setBusy(`Hashing ${file.name}…`);
    try {
      const hash = await crypto.subtle.digest(
        "SHA-256",
        await file.arrayBuffer(),
      );
      if (
        epoch !== attachmentEpoch.current ||
        version !== attachmentVersions.current[id]
      )
        return;
      const sha256 = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const attachment = {
        name: file.name,
        sha256,
        capturedAt: new Date().toISOString(),
        size: file.size,
      };
      fileStore.current[id] = file;
      setAttachments((current) => ({ ...current, [id]: attachment }));
      setRevision(identity());
      setNotice(`Attached and hashed ${file.name} for ${id}.`);
    } catch (error) {
      setErrors([`Could not attach ${file.name}: ${String(error)}`]);
    } finally {
      pendingHashes.current -= 1;
      setBusy(pendingHashes.current ? "Hashing source files…" : "");
    }
  }
  function detach(id: string) {
    inputGeneration.current += 1;
    attachmentVersions.current[id] = (attachmentVersions.current[id] || 0) + 1;
    delete fileStore.current[id];
    setAttachments((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setRevision(identity());
  }
  function updateAssessment(
    id: string,
    key: keyof PbcAssessment,
    value: string | string[],
  ) {
    const current = pack.pbcAssessments.find(
      (row) => row.criterionId === id,
    ) || {
      criterionId: id,
      result: "Not assessed" as Result,
      checker: "",
      checkedAt: "",
      evidenceIds: [],
      note: "",
      possibleReason: "",
      owner: "",
      remediation: "",
      resolution: "",
      reviewStatus: "",
    };
    const updated = { ...current, [key]: value } as PbcAssessment;
    commit({
      ...pack,
      pbcAssessments: [
        ...pack.pbcAssessments.filter((row) => row.criterionId !== id),
        updated,
      ],
    });
  }
  async function exportPack(format: "pdf" | "xlsx") {
    setBusy(`Building ${format.toUpperCase()}…`);
    setErrors([]);
    try {
      const { buildPdf, buildXlsx } = await import("./exports");
      const bytes =
        format === "pdf" ? buildPdf(snapshot) : await buildXlsx(snapshot);
      downloadBytes(
        bytes,
        `${snapshot.packId}${pack.demo ? "-SYNTHETIC-DEMO" : ""}.${format}`,
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      setNotice(
        `${format.toUpperCase()} generated from snapshot ${snapshot.packId}.`,
      );
    } catch (error) {
      setErrors([
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    } finally {
      setBusy("");
    }
  }
  function downloadTemplate() {
    downloadBytes(
      new TextEncoder().encode(JSON.stringify(templatePack(), null, 2)),
      "audit-pack-template.json",
      "application/json",
    );
  }

  async function exploreDemo() {
    const generation = ++inputGeneration.current;
    const loadVersion = ++demoLoadVersion.current;
    setDemoLoading(true);
    setErrors([]);
    try {
      const demo = await loadDemoDataset();
      if (generation !== inputGeneration.current) return;
      commit(demo.pack, true);
      fileStore.current = demo.files;
      setAttachments(demo.attachments);
      setNotice(
        `Synthetic demo loaded with ${demo.pack.evidence.length} hashed mock source files. Review the deliberate exceptions, then export PDF and XLSX.`,
      );
    } catch (error) {
      if (generation !== inputGeneration.current) return;
      setErrors([error instanceof Error ? error.message : String(error)]);
      setNotice(
        "Demo could not be loaded. Your previous working pack is unchanged.",
      );
    } finally {
      if (loadVersion === demoLoadVersion.current) setDemoLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="AuditPack home">
          <span className="brand-mark">
            A<span>•</span>
          </span>
          <span>
            AuditPack <em>/ audit studio</em>
          </span>
        </a>
        <div className="topbar-right">
          <span className="local-pill">LOCAL WORKSPACE</span>
          <a href="#exports" className="topbar-link">
            Export pack <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>
      <div className="layout">
        <aside className="sidebar" aria-label="Workflow navigation">
          <p className="side-kicker">WORKFLOW</p>
          <nav>
            <a href="#overview">
              <span>01</span> Overview
            </a>
            <a href="#intake">
              <span>02</span> Intake
            </a>
            <a href="#evidence">
              <span>03</span> Evidence
            </a>
            <a href="#checks">
              <span>04</span> Checks
            </a>
            <a href="#coverage">
              <span>05</span> PBC coverage
            </a>
            <a href="#exports">
              <span>06</span> Exports
            </a>
          </nav>
          <div className="sidebar-note">
            <div className="sidebar-note-icon">◎</div>
            <strong>Evidence stays here</strong>
            <p>
              All processing runs in this browser tab. Source files are hashed
              locally and are not uploaded.
            </p>
          </div>
          <div className="sidebar-foot">
            SOURCE CATALOG
            <br />
            <strong>10 PBC ITEMS · 57 CRITERIA</strong>
          </div>
        </aside>
        <main id="top">
          <section id="overview" className="hero">
            <div className="hero-copy">
              <p className="eyebrow">
                <span className="eyebrow-line" /> AUDIT WORKSPACE / 2026
              </p>
              <h1>
                Every balance has
                <br />
                <i>a story to prove.</i>
              </h1>
              <p className="hero-text">
                Build a traceable bank reconciliation pack from structured
                source data, attached evidence, and an explicit
                criterion-by-criterion check ledger.
              </p>
              <div className="hero-actions">
                <a className="button primary" href="#intake">
                  Start an audit pack <span>→</span>
                </a>
                <button
                  className="button secondary"
                  onClick={exploreDemo}
                  disabled={Boolean(busy) || demoLoading}
                >
                  {demoLoading
                    ? "Loading mock sources…"
                    : "Explore synthetic demo"}{" "}
                  <span>↗</span>
                </button>
                <a
                  className="button secondary"
                  href={`${import.meta.env.BASE_URL}demo/ledgerline-demo-dataset.zip`}
                  download
                >
                  Download demo dataset <span>↓</span>
                </a>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-card art-back">
                <span>GL / CASH</span>
                <strong>—</strong>
                <small>SOURCE AMOUNT PENDING</small>
              </div>
              <div className="art-card art-front">
                <div className="art-dot" />
                <span>RECONCILIATION</span>
                <strong>EVIDENCE PENDING</strong>
                <small>PROVENANCE REQUIRED</small>
              </div>
              <div className="art-grid" />
            </div>
          </section>
          {pack.demo && (
            <div className="demo-banner">
              <strong>◈ SYNTHETIC DEMO</strong>
              <span>
                Fictional data and source files only. Includes deliberate
                exceptions; all exports are marked synthetic.
              </span>
              <button
                onClick={() => {
                  commit(emptyPack(), true);
                  setNotice("Demo cleared. Working data reset.");
                }}
              >
                Clear demo
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {errors.length > 0 && (
            <div className="error-panel" role="alert">
              <strong>Action needed</strong>
              <ul>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          <section className="metrics" aria-label="Pack snapshot">
            <div className="metric">
              <span>PACK STATUS</span>
              <strong className="status-display">
                {snapshot.checks.some((check) => check.result === "Exception")
                  ? "Exceptions found"
                  : attachedCount === 0
                    ? "Awaiting evidence"
                    : "In assessment"}
              </strong>
              <small>No audit opinion is implied</small>
            </div>
            <div className="metric">
              <span>BANK ACCOUNTS</span>
              <strong>
                {pack.reconciliations.length}{" "}
                <em>/ {pack.expectedAccounts.length || "—"}</em>
              </strong>
              <small>Imported / expected</small>
            </div>
            <div className="metric">
              <span>ATTACHED FILES</span>
              <strong>
                {attachedCount} <em>/ {pack.evidence.length || "—"}</em>
              </strong>
              <small>Locally hashed / registered</small>
            </div>
            <div className="metric">
              <span>ASSURANCE CRITERIA</span>
              <strong>{criteria.length}</strong>
              <small>Across all 10 PBC requests</small>
            </div>
          </section>

          <section id="intake" className="page-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">01 / PACK INTAKE</p>
                <h2>Define the engagement.</h2>
                <p>
                  Use the source workbook as the requirements catalog. Import
                  transactional data separately.
                </p>
              </div>
              <a
                className="text-link"
                href={workbookUrl}
                download={sourceWorkbook}
              >
                Download source workbook ↗
              </a>
            </div>
            <div className="two-column">
              <div className="panel">
                <div className="panel-head">
                  <div className="panel-icon">✳</div>
                  <div>
                    <h3>Scope & population</h3>
                    <p>These values are declarations from your working pack.</p>
                  </div>
                </div>
                <div className="form-grid">
                  <Field
                    label="Engagement"
                    value={pack.engagement}
                    onChange={(value) => change("engagement", value)}
                    hint="Name used on both exports"
                  />
                  <Field
                    label="Entity"
                    value={pack.entity}
                    onChange={(value) => change("entity", value)}
                  />
                  <Field
                    label="Accounting period"
                    value={pack.period}
                    onChange={(value) => change("period", value)}
                    hint="YYYY-MM"
                    type="month"
                  />
                  <Field
                    label="Currency"
                    value={pack.currency}
                    onChange={(value) =>
                      change("currency", value.toUpperCase())
                    }
                    hint="ISO currency code"
                  />
                  <Field
                    label="Stale item cutoff (days)"
                    value={String(pack.staleDays)}
                    onChange={(value) =>
                      change(
                        "staleDays",
                        Math.min(
                          3650,
                          Math.max(0, Math.trunc(Number(value) || 0)),
                        ),
                      )
                    }
                    type="number"
                  />
                </div>
                <label className="field wide">
                  <span>Expected material bank accounts</span>
                  <small>
                    One account per line. An empty list cannot prove
                    completeness.
                  </small>
                  <textarea
                    rows={4}
                    value={pack.expectedAccounts.join("\n")}
                    onChange={(event) =>
                      change(
                        "expectedAccounts",
                        event.target.value
                          .split(/[\n,]/)
                          .map((value) => value.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder={"OPERATING-001\nPAYROLL-002"}
                  />
                </label>
                <Field
                  label="Account population evidence ID"
                  value={pack.expectedAccountEvidenceId}
                  onChange={(value) =>
                    change("expectedAccountEvidenceId", value)
                  }
                  hint="Attach a PBC-002 scope report under this evidence ID"
                  wide
                />
              </div>
              <div className="panel source-panel">
                <div className="panel-head">
                  <div className="panel-icon">▤</div>
                  <div>
                    <h3>Source catalog</h3>
                    <p>Preserved, byte-for-byte, from the supplied workbook.</p>
                  </div>
                </div>
                <div className="source-fact">
                  <span>PBC USE CASES</span>
                  <strong>10</strong>
                </div>
                <div className="source-fact">
                  <span>ASSURANCE CRITERIA</span>
                  <strong>57</strong>
                </div>
                <div className="source-fact">
                  <span>METADATA FIELDS</span>
                  <strong>17</strong>
                </div>
                <p className="source-caption">
                  Workbook SHA-256
                  <br />
                  <code>{workbookHash}</code>
                </p>
                <p className="source-warning">
                  This workbook contains requirements, not bank or GL
                  transaction evidence.
                </p>
              </div>
            </div>
            <details className="panel metadata-panel">
              <summary>
                <span>
                  <strong>17 required metadata fields</strong>
                  <small>
                    Source: Audit pack metadata!A2:B18 · expand to edit
                  </small>
                </span>
                <span aria-hidden="true">＋</span>
              </summary>
              <div className="metadata-grid">
                {metadataFields.map((field) => (
                  <label className="field" key={field.label}>
                    <span>{field.label}</span>
                    <small>
                      {field.sourceRow} · {field.purpose}
                    </small>
                    <input
                      value={pack.metadata[field.label] || ""}
                      onChange={(event) =>
                        commit({
                          ...pack,
                          metadata: {
                            ...pack.metadata,
                            [field.label]: event.target.value,
                          },
                        })
                      }
                      placeholder="Missing"
                    />
                  </label>
                ))}
              </div>
            </details>
            <div className="panel import-panel">
              <div className="panel-head">
                <div className="panel-icon">⇩</div>
                <div>
                  <h3>Structured evidence import</h3>
                  <p>
                    Import JSON or edit the structured template below. Generic
                    PDFs are attachments and are not parsed.
                  </p>
                </div>
              </div>
              <div className="import-actions">
                <button className="button dark" onClick={downloadTemplate}>
                  Download JSON template ↓
                </button>
                <label className="button outline file-button">
                  Choose JSON file{" "}
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={importFile}
                  />
                </label>
                <button className="button outline" onClick={applyEditor}>
                  Validate & apply JSON
                </button>
              </div>
              <label className="field wide code-editor">
                <span>Editable JSON intake</span>
                <small>
                  Amounts are signed decimal strings; dates are YYYY-MM-DD;
                  extraction times require ISO timezone. Import replaces working
                  records only after full validation.
                </small>
                <textarea
                  spellCheck={false}
                  value={editor}
                  onChange={(event) => {
                    inputGeneration.current += 1;
                    setEditor(event.target.value);
                  }}
                  rows={12}
                />
              </label>
              <p className="help-line">
                Schema and sign convention are documented in the README. Prior
                valid data stays intact if validation fails.
              </p>
            </div>
          </section>

          <section id="evidence" className="page-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">02 / EVIDENCE LINEAGE</p>
                <h2>Know where it came from.</h2>
                <p>
                  Each reconciliation, bank, and GL record needs its own source
                  footprint and an actual file attachment.
                </p>
              </div>
              <span className="section-count">
                {pack.evidence.length} REGISTERED · {attachedCount} ATTACHED
              </span>
            </div>
            {!pack.evidence.length ? (
              <div className="empty-state">
                <div>⌁</div>
                <h3>No evidence registered yet</h3>
                <p>
                  Import the structured JSON template to register source
                  records, then attach each file to its evidence ID. Importing
                  the requirements workbook alone does not add transaction
                  evidence.
                </p>
                <a href="#intake" className="button outline">
                  Go to intake →
                </a>
              </div>
            ) : (
              <div className="evidence-grid">
                {pack.evidence.map((record) => {
                  const attachment = getAttachment(attachments, record.id);
                  return (
                    <article className="evidence-card" key={record.id}>
                      <div className="evidence-card-top">
                        <span className="record-kind">
                          {record.kind.toUpperCase()}
                        </span>
                        <span
                          className={
                            attachment ? "attached-label" : "missing-label"
                          }
                        >
                          {attachment ? "● ATTACHED" : "○ FILE MISSING"}
                        </span>
                      </div>
                      <h3>{record.id}</h3>
                      <p className="evidence-meta">
                        {record.pbcCode} · {record.account || "Account missing"}
                      </p>
                      <dl>
                        <div>
                          <dt>Source</dt>
                          <dd>{record.sourceSystem || "Missing"}</dd>
                        </div>
                        <div>
                          <dt>Report ID</dt>
                          <dd>{record.recordId || "Missing"}</dd>
                        </div>
                        <div>
                          <dt>Extracted</dt>
                          <dd>{record.extractedAt || "Missing"}</dd>
                        </div>
                        <div>
                          <dt>Source prep / review</dt>
                          <dd>
                            {record.sourcePreparer || "Missing"} /{" "}
                            {record.sourceReviewer || "Missing"}
                          </dd>
                        </div>
                        <div>
                          <dt>Filename / version</dt>
                          <dd>
                            {record.originalFilename || "Missing"} /{" "}
                            {record.version || "Missing"}
                          </dd>
                        </div>
                      </dl>
                      {attachment ? (
                        <div className="attachment">
                          <strong>✓ {attachment.name}</strong>
                          <small>SHA-256 {attachment.sha256}</small>
                          <small>Captured {attachment.capturedAt}</small>
                          <button onClick={() => detach(record.id)}>
                            Remove file
                          </button>
                        </div>
                      ) : (
                        <label className="attach-button">
                          Attach source file{" "}
                          <input
                            type="file"
                            onChange={(event) => {
                              void attach(record.id, event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section id="checks" className="page-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">03 / DETERMINISTIC CHECKS</p>
                <h2>Every check, accounted for.</h2>
                <p>
                  Amounts compare in integer cents with zero tolerance. Missing
                  values never become numeric zero.
                </p>
              </div>
              <span className="section-count">
                {snapshot.checks.length} LEDGER ROWS
              </span>
            </div>
            <div className="status-grid">
              {counts.map(({ result, count }) => (
                <button
                  key={result}
                  className={`status-card ${tone(result)} ${filter === result ? "selected" : ""}`}
                  onClick={() => setFilter(filter === result ? "All" : result)}
                >
                  <strong>{count}</strong>
                  <span>{result}</span>
                </button>
              ))}
            </div>
            <div className="panel ledger-panel">
              <div className="ledger-toolbar">
                <div>
                  <h3>Check ledger</h3>
                  <p>
                    {bank.length} bank rules and source checks, plus criterion
                    and metadata rows
                  </p>
                </div>
                <div className="ledger-controls">
                  <label className="search-field">
                    <span className="sr-only">Search checks</span>
                    <input
                      placeholder="Search checks…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Filter checks by result"
                    value={filter}
                    onChange={(event) =>
                      setFilter(event.target.value as Result | "All")
                    }
                  >
                    <option>All</option>
                    {statusOrder.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ID / PBC</th>
                      <th>What was checked</th>
                      <th>Result</th>
                      <th>Evidence</th>
                      <th>Exception / observation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleChecks.map((check) => (
                      <tr key={check.id}>
                        <td>
                          <strong>{check.id}</strong>
                          <small>
                            {check.pbcCode}
                            {check.account ? ` · ${check.account}` : ""}
                          </small>
                        </td>
                        <td>
                          {check.description}
                          <small>{check.rule}</small>
                        </td>
                        <td>
                          <Badge result={check.result} />
                        </td>
                        <td>
                          {check.evidenceIds.length ? (
                            check.evidenceIds.join(", ")
                          ) : (
                            <span className="muted">Missing</span>
                          )}
                        </td>
                        <td>
                          {check.exception || check.observed}
                          <small>{check.possibleReason}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!visibleChecks.length && (
                <div className="table-empty">No checks match this view.</div>
              )}
            </div>
          </section>

          <section id="coverage" className="page-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">04 / FULL PBC COVERAGE</p>
                <h2>Nothing outside the frame.</h2>
                <p>
                  All ten supplied requests and 57 assurance statements remain
                  addressable. Nonbank criteria need explicit criterion-level
                  human assessment.
                </p>
              </div>
            </div>
            <div className="coverage-list">
              {catalog.map((item) => (
                <details className="coverage-item" key={item.code}>
                  <summary>
                    <span className="coverage-code">{item.code}</span>
                    <span className="coverage-title">
                      <strong>{item.name}</strong>
                      <small>
                        {item.area} · {item.sourceRow}
                      </small>
                    </span>
                    <Badge result={snapshot.coverage[item.code]} />
                    <span className="coverage-plus">＋</span>
                  </summary>
                  <div className="coverage-body">
                    <div className="coverage-context">
                      <div>
                        <strong>Required systems</strong>
                        <p>{item.systems}</p>
                      </div>
                      <div>
                        <strong>Example evidence</strong>
                        <p>{item.exampleEvidence}</p>
                      </div>
                    </div>
                    <p className="coverage-full">
                      <strong>Full workbook assurance text:</strong>{" "}
                      {item.assurance}
                    </p>
                    <div className="criterion-list">
                      {criteria
                        .filter((row) => row.pbcCode === item.code)
                        .map((criterion) => {
                          const assessment = pack.pbcAssessments.find(
                            (row) => row.criterionId === criterion.id,
                          );
                          const automated = criterion.pbcCode === "PBC-002";
                          return (
                            <div className="criterion" key={criterion.id}>
                              <div className="criterion-main">
                                <span className="criterion-id">
                                  {criterion.id}
                                </span>
                                <p>{criterion.text}</p>
                                <Badge
                                  result={
                                    snapshot.criterionResults[criterion.id]
                                  }
                                />
                              </div>
                              {automated ? (
                                <p className="criterion-note">
                                  Automated bank checks and source footprint
                                  feed this criterion. See the check ledger for
                                  each underlying rule.
                                </p>
                              ) : (
                                <div className="assessment-grid">
                                  <label>
                                    Human assessment
                                    <select
                                      value={
                                        assessment?.result || "Not assessed"
                                      }
                                      onChange={(event) =>
                                        updateAssessment(
                                          criterion.id,
                                          "result",
                                          event.target.value,
                                        )
                                      }
                                    >
                                      {statusOrder.map((status) => (
                                        <option key={status}>{status}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    Checker
                                    <input
                                      value={assessment?.checker || ""}
                                      onChange={(event) =>
                                        updateAssessment(
                                          criterion.id,
                                          "checker",
                                          event.target.value,
                                        )
                                      }
                                      placeholder="Named person"
                                    />
                                  </label>
                                  <label>
                                    Checked date
                                    <input
                                      type="date"
                                      value={assessment?.checkedAt || ""}
                                      onChange={(event) =>
                                        updateAssessment(
                                          criterion.id,
                                          "checkedAt",
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>
                                  <label>
                                    Evidence IDs
                                    <input
                                      value={
                                        assessment?.evidenceIds.join(", ") || ""
                                      }
                                      onChange={(event) =>
                                        updateAssessment(
                                          criterion.id,
                                          "evidenceIds",
                                          event.target.value
                                            .split(",")
                                            .map((value) => value.trim())
                                            .filter(Boolean),
                                        )
                                      }
                                      placeholder="Comma-separated"
                                    />
                                  </label>
                                  <label className="wide">
                                    Assessment note
                                    <input
                                      value={assessment?.note || ""}
                                      onChange={(event) =>
                                        updateAssessment(
                                          criterion.id,
                                          "note",
                                          event.target.value,
                                        )
                                      }
                                      placeholder="What was checked"
                                    />
                                  </label>
                                  <label className="wide">
                                    Possible reason (hypothesis)
                                    <input
                                      value={assessment?.possibleReason || ""}
                                      onChange={(event) =>
                                        updateAssessment(
                                          criterion.id,
                                          "possibleReason",
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>
                                  <label>
                                    Owner
                                    <input
                                      value={assessment?.owner || ""}
                                      onChange={(event) =>
                                        updateAssessment(
                                          criterion.id,
                                          "owner",
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>
                                  <label>
                                    Remediation
                                    <input
                                      value={assessment?.remediation || ""}
                                      onChange={(event) =>
                                        updateAssessment(
                                          criterion.id,
                                          "remediation",
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>
                                  <label>
                                    Resolution
                                    <input
                                      value={assessment?.resolution || ""}
                                      onChange={(event) =>
                                        updateAssessment(
                                          criterion.id,
                                          "resolution",
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>
                                  <label>
                                    Review status
                                    <input
                                      value={assessment?.reviewStatus || ""}
                                      onChange={(event) =>
                                        updateAssessment(
                                          criterion.id,
                                          "reviewStatus",
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>

          <section id="exports" className="page-section export-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">05 / FINAL DELIVERABLES</p>
                <h2>One snapshot. Two useful files.</h2>
                <p>
                  Both downloads use pack ID <strong>{snapshot.packId}</strong>{" "}
                  and snapshot time <strong>{snapshot.timestamp}</strong>. Any
                  edit creates a new snapshot.
                </p>
              </div>
            </div>
            <div className="export-grid">
              <div className="export-card">
                <div className="export-icon">PDF</div>
                <h3>Audit pack</h3>
                <p>
                  Scope, full PBC coverage, account reconciliations, source
                  footprints, complete check ledger, evidence, exceptions, and
                  blank reviewer signoff.
                </p>
                <button
                  className="button primary"
                  disabled={Boolean(busy) || demoLoading}
                  onClick={() => void exportPack("pdf")}
                >
                  Download PDF <span>↗</span>
                </button>
              </div>
              <div className="export-card">
                <div className="export-icon xlsx">XLSX</div>
                <h3>Summary workbook</h3>
                <p>
                  Styled sheets for summary, checks, 57 criteria, PBC coverage,
                  accounts, evidence, metadata, exceptions, and reviewer
                  signoff.
                </p>
                <button
                  className="button dark"
                  disabled={Boolean(busy) || demoLoading}
                  onClick={() => void exportPack("xlsx")}
                >
                  Download XLSX <span>↗</span>
                </button>
              </div>
            </div>
            {busy && (
              <p className="busy" role="status">
                {busy}
              </p>
            )}
            <div className="export-footnote">
              <strong>Reviewer signoff remains blank.</strong> Imported names
              and dates are source-provided claims. The engine does not
              authenticate users, parse generic attachments, or issue an audit
              opinion.
            </div>
          </section>
          <footer>
            <span>AuditPack / AUDIT STUDIO</span>
            <span>
              Requirements source: {sourceWorkbook} ·{" "}
              {workbookHash.slice(0, 12)}…
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
