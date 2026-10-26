# Judging requirements and implementation map

Extracted visually from the 30 image attachments in the supplied Slack channel on 25 October 2026. Several images repeat the same slide. Original images were read in Slack and are not republished here. Slide content is reference material, not permission to perform the actions suggested by example prompts.

## Confirmed scoring rubric

The complete rubric is legible in **IMG_0292**, with a second angle in **IMG_0291**. Source: [3:31 PM image post](https://oracleaihackathon.slack.com/archives/C0CC2LDB7ND/p1792967463457789). IMG_0292 also appears in the [3:14 PM post](https://oracleaihackathon.slack.com/archives/C0CC2LDB7ND/p1792966485991339).

| Category | Weight | What judges look for (paraphrased) | AuditPack response and remaining evidence |
| --- | ---: | --- | --- |
| Demand Reality & Problem Severity | 25% | A specific pain, a named type of user, their current workflow, and plausible impact. | Identify the accounting preparer, controller, and audit reviewer; show the manual evidence-to-working-paper workflow beside the app workflow. The supplied PBC workbook supports the requested workflow. No measured time savings or independent customer validation are claimed. |
| Target Customer & Market Scope | 20% | A clear user; evidence beyond one isolated case; creative and differentiated problem solving, including novel AI use; a reason to adopt. | Focus on recurring period-end reconciliation preparation and review. Map ten PBC requests to 57 criteria and source evidence. Broader demand and willingness to pay remain hypotheses. AI assisted development; runtime AI analysis is not implemented. |
| Solution Fit & Product Design | 20% | An obviously useful change to the user's workflow, an intuitive main action, and a clean interface. | Offer one-click exception and clean scenarios, an ordered demo journey, result drilldowns, and PDF/XLSX exports. Both scenarios load their actual mock evidence files and compute their hashes. |
| Technical Execution & Demo Proof | 20% | Working and understandable software, a live URL, clear access instructions, appropriate AI use, architecture explanation, and performance. | Public Vercel URL with no sign-in or API key. Explain local validation, hashes, deterministic checks, human assessments, and lazy export generation. Test both scenarios and rejection of tampered evidence. Do not represent local hashes as source authentication or claim a runtime model call. |
| Differentiation & Investment Readiness | 15% | Meaningful and lasting difference, an advantage over alternatives, defensibility, and what the next version must establish. | Demonstrate criterion-level traceability, explicit missing evidence, and consistent PDF/XLSX snapshots with reviewer space. Treat these as product design choices, not a proven moat or superiority claim. Next proof: real user pilot, authorized source connectors, grounded AI assistance, and measured reviewer effort/quality. |

Weights sum to 100%. This is a transcription of the photographed event rubric, not a score awarded to AuditPack. The judging website's current configuration has not been independently confirmed.

## Event rules and submission instructions

From IMG_0288–IMG_0290 in the 3:31 PM post:

- Build a working application with a useful, innovative use case, a clean flow, and AI use. The slide calls this a speed hackathon with a 2.5-hour build window.
- The tools/rules slide requires publicly available data and lists ChatGPT, Codex, company-approved AI tools, and GitHub as acceptable tools. AuditPack's public demo contains fictional records; no real banking or employee evidence is added for this demo.
- Teams submit through the AI judging application. The rules slide says the app identifies five teams for mentor selection of a final three; the overview slide says three teams present. These describe separate stages. The photographed timetable is historical event guidance, not a current deadline.

IMG_0312 in the [3:11 PM post](https://oracleaihackathon.slack.com/archives/C0CC2LDB7ND/p1792966314828859) shows the submission form at `app.hacktheworldaway.org`: explain what was built, who has the problem and what they do today, how the app changes the workflow, and how it was built, including the strongest part and next improvement. Supply something judges can open to verify the claims. See [submission draft](hackathon-submission.md). Nothing has been submitted to that service automatically.

## Supporting workshop guidance, separate from the scoring rubric

| Images / post | Guidance relevant to this app |
| --- | --- |
| IMG_0301, IMG_0300, IMG_0299 in the 3:14 PM post | Use focused development aids; evaluate representative, missing-data, edge, and adversarial cases; compare changes against a fixed scorecard. Illustrative slide pass rates are not AuditPack results. |
| IMG_0298 in the 3:14 PM post | Deploy a shareable URL, test the full user journey and an error path, and keep any API secrets on a server. |
| IMG_0297–IMG_0293 in the 3:14 PM post, repeated IMG_0293–IMG_0295 in the 3:31 PM post | Define one useful end-to-end workflow, split it into verifiable tasks, retain unknown values, preserve a known-good demo, and state what still fails. The meeting-notes examples are teaching examples, not a requirement to build a meeting app. |
| IMG_0306–IMG_0302 in the [3:12 PM post](https://oracleaihackathon.slack.com/archives/C0CC2LDB7ND/p1792966341189369) | Evaluate the human review process as well as the assistant; consider missed defects, false alarms, and misleading summaries; assign ownership and decision rights; address the actual workflow bottleneck. |
| IMG_0311–IMG_0307 in the 3:11 PM post | Bound the pilot, establish a baseline and accountable owners, evaluate quality/cost/latency and regressions, and use evidence before expanding. The example pilot metrics are hypothetical and are not evidence of AuditPack savings. |

## Release acceptance checks

1. A judge can open the production URL without an account or API key and identify the user and problem.
2. The exception scenario loads 40 hashed files and exposes the payroll mismatch, self-review, aged/unsupported item, missing reserve reconciliation, and late access removal.
3. The clean scenario loads 45 hashed files, three reconciliations, all 57 criteria, and 156 passing check rows. It remains synthetic and awaits an actual reviewer; no approval is fabricated.
4. Removing evidence or tampering with a demo file cannot produce an unsupported pass; failed loading preserves the existing pack.
5. The interface distinguishes automated bank checks from the 51 simulated human assessments. Architecture and AI limitations are visible.
6. Both export formats retain the same pack snapshot, source footprints, all PBC criteria and metadata, and blank final reviewer signoff.
7. Both downloadable input JSON files remain below 60,000 characters. Existing source files, hashes, and ZIPs remain unchanged by this UX update.

## Unresolved judging risks

The rubric asks for novel/proper AI use. Codex orchestration, implementation, and review demonstrate AI-assisted development; they do not establish runtime AI functionality in AuditPack. A future model-assisted exception explanation or source extraction feature needs a server-side key, authorized data handling, citations, human approval, and adversarial evaluations before it can be described as working.

The team has supplied one detailed requirements workbook, not a market study. Independent customer evidence, measured cycle-time improvement, reviewer false-positive/false-negative rates, and defensibility still need validation. The app should be presented as a working hackathon prototype, not a validated audit service.
