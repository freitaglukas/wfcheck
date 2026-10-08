# Generic Workflow Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Turn any n8n export into an explainable test plan, then run qualified tests in a disposable n8n runtime with isolated integrations and configurable LLM substitutes.

**Architecture:** Deterministic analysis and a versioned capability registry feed a strict test-plan compiler. Cloud and Docker adapters execute the same normalized suites; optional local LLM assistance proposes plans, while separate mock/local/replay modes replace workflow model dependencies. Workflow business code, contracts and expected fixtures stay in independent projects.

**Tech Stack:** Node 24 LTS, TypeScript ESM, Commander, Zod, YAML, Undici, Vitest, Docker Engine, official pinned n8n/task-runner images, Ollama/OpenAI-compatible local inference.

**Spec:** [Approved design](../specs/2026-10-07-receipt-cli-support-design.md). Owner approved the design and requested this plan. Owner approved implementation on 2026-10-08; execution is in progress.

## Global Constraints

- Keep the CLI and its repository generic: no receipt fields, money/date rules, OCR prompts, provider endpoint or application resource IDs in runtime code.
- Preserve existing source workflow bytes; make only recorded test-copy transport/configuration changes.
- The current restrictive execution profile remains the default, and existing suites remain compatible.
- No n8n Cloud API key or HTTPS tunnel is required for local mode.
- Use an official n8n image with an explicit tested version and resolved digest, never an unrecorded latest tag.
- Publish only a dynamically assigned loopback port; no privileged containers, host Docker socket in workloads or arbitrary host mounts.
- Preserve the 20 serial executions per invocation limit, 120-second test deadline ceiling, 64 KiB gateway request/response budget and no trigger retries.
- Secrets remain local/private; modes 600 for files and 700 for state directories. Do not print, commit or place production secrets in copies.
- Read-only public API discovery precedes Cloud writes; no private editor API or arbitrary SQL bootstrap.
- Local-mode discovery rejects models with remote/cloud backing; never fall back to hosted inference.
- Clean exact recorded resource IDs only; no prefix cleanup or global Docker prune.
- Unknown effects, unresolved bindings and missing evidence cannot pass. Unsupported/configuration/infrastructure errors exit 2; observed assertion failures exit 1; complete passing cases and cleanup exit 0.
- Planning assistance cannot authorize effects or promote guessed model output into expected truth. Record provenance and separate smoke, baseline and behavior verification.
- No release, publication, Grid change, permanent ingress, purchases or unrelated production changes.

## Review Focus

1. Exports using newer/community nodes or AI connections must still get complete analysis; unsupported execution remains explicit. Pins: A1/A2 and B3.
2. A literal credential or secret hidden in a Code string/URL/body must not appear in inspection or assistant input by default. Pins: A1 and C3.
3. An HTTP timeout after a Form starts must not trigger a retry or silently select another execution. Pins: B3.
4. Partial resource creation, daemon restart or interruption must retain recoverable exact ownership and preserve unrelated resources. Pins: B1/B2.
5. A model-generated plan that validates syntax but changes an endpoint, effect permission or oracle must be rejected. Pins: A3/C3.

---

## Execution map and deliverables

The spec contains three separable subsystems. Each linked plan produces useful, independently testable software; execute their tasks in the order below rather than treating the documents as permission for parallel changes to shared interfaces.

| Order | Deliverable | Plan/task |
| --- | --- | --- |
| 0 | Receipt project separated; CLI/package remains generic | Task 0 below |
| 1 | Offline inspect with complete graph/capability diagnostics | [Analysis plan](2026-10-07-workflow-analysis-plan.md), A1-A2 |
| 2 | Version 2 normalized suites and deterministic draft planner | Analysis plan, A3 |
| 3 | Exact-ID resource journal and partial-create recovery | [Runtime plan](2026-10-07-isolated-runtime-plan.md), B1 |
| 4 | Qualified unattended Docker bootstrap, then scoped gateway/runtime | Runtime plan, B2a-B2b |
| 5 | Generic file/native-node execution and actual table evidence | Runtime plan, B3-B4 |
| 6 | Local-model transport, native chat substitution, record/replay | [LLM plan](2026-10-07-local-llm-plan.md), C1-C2 |
| 7 | Optional local planning assistant through the deterministic compiler | LLM plan, C3 |
| 8 | Cross-project Docker/Cloud acceptance and package proof | Task 1 below |

Execution recommendation: inline/native implementation, sequential commits and one independent whole-branch review after the slice. Shared schema/runtime interfaces make task order valuable. Do not delegate unless the owner chooses that method or an applicable execution skill requires it.

## Shared interface decisions

A3 defines version 2 suites, retaining the current version 1 parser and fixtures unchanged. B1 migrates only the ownership journal to version 2 and reads old manifests. Report format 2 records runtime/model/analysis provenance; legacy suites still produce the same exit semantics.

The normalized test contract is defined in src/spec/normalized.ts: each test has id, workflow path, one JSON/file input, timeoutMs, selected trigger ID, optional reviewed source hash, HTTP bindings, logical tables/table bindings, mocks, assertions and verification kind (smoke, baseline or behavior). Local model settings are optional suite/test defaults resolved by C1. User-authored trust/effect declarations are separate from assistant suggestions.

Use these exact core configuration names; A3 owns their schemas and exports. AssertionV2 extends the existing assertion union with the table/schema targets defined in A3. LlmDefaults is defined by C1. Code review declarations are author-supplied, do not establish a sandbox, and cannot be generated as authority by the assistant.

~~~ts
type NormalizedInput =
  | { kind: 'json'; fixture: string }
  | { kind: 'file'; fixture: string; field: string; mimeType: string };
interface HttpBinding {
  nodeId: string; expectedUrl: string; mockPath: string;
  protocol: 'http-json' | 'openai-chat';
}
interface LogicalTable {
  id: string; columns: Array<{name: string; type: 'string' | 'number' | 'boolean'}>;
  seedRows: Array<Record<string, unknown>>;
}
interface TableBinding {
  nodeId: string; expectedResourceId: string; tableId: string;
  fault?: 'missing-table';
}
interface WorkflowTrust {
  sourceHash: string;
  reviewedCode: Array<{nodeId: string; codeHash: string; noExternalEffects: true}>;
}
interface NormalizedTest {
  id: string; workflow: string; input: NormalizedInput; triggerId?: string;
  timeoutMs: number; trust?: WorkflowTrust; bindings: HttpBinding[];
  tables: LogicalTable[]; tableBindings: TableBinding[];
  mocks: MockRule[]; assertions: AssertionV2[];
  verificationKind: 'smoke' | 'baseline' | 'behavior'; llm?: LlmDefaults;
}
interface NormalizedSuite {
  schemaVersion: 2; name: string; redactValues: string[];
  runtime?: RuntimeKind; llm?: LlmDefaults; tests: NormalizedTest[];
}
~~~

Set explicit schema bounds: source/schema documents <= 1 MiB, <= 20 tests, <= 200 executable nodes per version 2 test (analysis inventories up to 500; the legacy version 1 limit remains 20), <= 20 logical table columns, <= 100 seed/observed rows and <= 20 HTTP bindings per case. These are generic limits; inspect reports oversized execution needs instead of truncating inventory. Inputs/mocks/assertions retain the separate limits already stated. Schema date columns and broader node/row limits remain unsupported until qualified.

The runtime boundary in src/runtime/types.ts is:

~~~ts
type RuntimeKind = 'cloud' | 'docker';
type CompiledInput =
  | { kind: 'json'; data: Record<string, unknown>; sha256: string }
  | { kind: 'file'; bytes: Uint8Array; field: string; fileName: string;
      mimeType: string; sha256: string };
interface TriggerAttempt {
  responseStatus?: number;
  transport: 'received' | 'uncertain';
}
interface RuntimeCapabilities {
  kind: RuntimeKind; version?: string; imageDigest?: string;
  triggerKinds: Array<'webhook-json' | 'form-file'>;
  nodeCatalogHash?: string; operations: string[];
}
interface RuntimeAdapter {
  doctor(): Promise<RuntimeCapabilities>;
  importWorkflow(prepared: PreparedWorkflow, runId: string, testId: string,
                 signal?: AbortSignal): Promise<RuntimeHandle>;
  activate(handle: RuntimeHandle, signal?: AbortSignal): Promise<void>;
  trigger(handle: RuntimeHandle, input: CompiledInput, marker: string,
          signal: AbortSignal): Promise<TriggerAttempt>;
  observe(handle: RuntimeHandle, marker: string,
          signal: AbortSignal): Promise<ExecutionObservation>;
  tables(handle: RuntimeHandle, signal: AbortSignal): Promise<TableEvidence[]>;
  cleanup(handle: RuntimeHandle): Promise<void>;
  recover(testId?: string): Promise<void>;
}
~~~

PreparedWorkflow retains workflow/sourceHash/changes and replaces webhook-only fields with a trigger descriptor (kind, nodeId, nodeName, path and file field when applicable), logical resource requests and validated binding descriptions. RuntimeHandle contains the created workflow ID/version, prepared copy and exact scoped resource IDs. Credential values never enter reportable handle/state objects; generated values are kept in private state owned by the adapter.

TableEvidence is { tableId, resourceId, rows, complete: true, capturedAt }; tableId is the logical suite ID. Evidence adds tables, trigger attempt and model calls to current execution/request observations. All observations are actual; compiled/planner outputs never substitute for them.

GatewayTransport in src/gateway/transport.ts permits both in-process and Docker transports. Use Awaitable<T> = T | Promise<T> for register/snapshot/seal, so the existing Gateway's direct unit tests remain valid; the runner awaits every operation. Preserve register, drain, snapshot, seal and close semantics. No network control/inspection API is added.

RuntimeOptions in factory.ts has runtime, stateDirectory, optional Cloud origin/private key, optional ImageSet, startupTimeoutMs (default 180000), keepOnFailure (default false) and optional trusted model endpoint. CLI selection resolves before reading Cloud configuration. ImageSet is defined by B2a; LLM policy by C1. Per-case deadlines and tokens start only after run-level startup. Gateway snapshots add modelCalls (empty for legacy non-model traffic); transport loss is an evidence error.

Raise the generic version 2 node ceiling to 200 and test it independently of the receipt target; retain the legacy profile's validation semantics. Inventory and planning are not limited to the executable subset; report which capability or limit needs extension.

## Task 0: Separate the workflow project and prove the package boundary

**Files:** move examples/receipt-intake/ and tests/receipt.test.ts plus tests/receipt-workflow.test.ts into /Users/friday/dev/n8n-workflows/receipt-intake/ and /Users/friday/dev/n8n-workflows/tests/; modify the consumer imports/fixture paths, its private state resolution and its new package.json/.gitignore; modify CLI README/example packaging only where necessary.

**Interfaces:** the separate project is an ordinary wfcheck consumer with its own test command and editable suites. No module imports cross back into the CLI. CLI package contents retain generic examples.

- [ ] Verify both checkouts, applicable instructions, dirty changes and target absence before touching files. The destination did not exist during plan creation; recheck. Stop on a conflicting existing checkout instead of overwriting it.
- [ ] Write a packaging test asserting CLI npm-pack contents contain no receipt-core.mjs, receipt provisioning scripts or live workflow export. Run it and observe the current failure.

    const packed = JSON.parse(execFileSync('npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts'], {encoding:'utf8'}));
    expect(packed[0].files.some((file: {path:string}) =>
      file.path.includes('receipt-intake'))).toBe(false);
- [ ] Preserve receipt subtree history using git subtree split into a local migration branch, import that history into the new repository and place it under receipt-intake/. Copy the two domain test files with source-commit provenance. Do not rewrite existing shared Git history or push.
- [ ] Relocate only the receipt project's private ownership/auth files from the task worktree's .wfcheck/receipt-intake into the new project's .wfcheck/receipt-intake. Verify hashes and modes without printing contents. Leave source files until the target is verified; then remove the obsolete copy. Do not copy the Cloud/Yolo secret env files into Git.
- [ ] Update only consumer-side relative imports/fixture and private-state paths. Keep workflow.json byte-identical. Keep existing local secret files accessible through explicit environment-file paths. Carry forward exact live IDs unchanged.
- [ ] Run both projects' tests/build where defined, the packaging test and git diff --check. Expected baseline: 43 generic CLI tests and 31 consumer tests preserved; do not enforce those counts after new tests are added. Verify the original export hash remains 31ea3aec844288aacd670bd38eb0efc89b0d03486abe1eaed5ae1f5c28d6b75b.
- [ ] Commit the consumer import and CLI separation independently; document both commit IDs and recovery paths. No live n8n lifecycle operation is needed.

## Task 1: Prove the complete generic onboarding path

**Files:** add tests/e2e/docker.test.ts and examples/suites/generated-smoke.yaml using unrelated generic workflows; add executable suites in the separate receipt project; update docs/support-matrix.md, docs/feasibility.md, README.md, SECURITY.md and docs/acceptance/generic-workflow-testing.md.

**Interfaces:** consumes analyzeWorkflow/buildDraft/validatePlan, createRuntime, runCompiled and the LLM transports from A/B/C. Produces fresh acceptance records tied to source, runtime/catalog and fixture hashes, actual IDs, assertions and cleanup.

- [ ] Use the opt-in npm run test:docker command from B2b and add test:local-llm. Ordinary npm test must never pull images, start runtimes or invoke a model. Maintain default/integration Vitest configurations so E2E tests cannot run accidentally.
- [ ] From a clean temporary consumer directory, install npm pack output, inspect/plan an unfamiliar generic Webhook -> fields -> HTTP workflow, supply a separately authored expectation, then run in Docker. Also inspect an export containing an unknown node and assert full diagnostics and zero attempted execution.
- [ ] Run all synthetic receipt cases from the external project unchanged: clear image, decimal PDF, missing number, blurry unknown amount, seeded duplicate/manual-note preservation, different date, instruction-like text, malformed fields/provider error and exact-owned missing-table fault. Maximum 20 serial executions per invocation. Assert native table rows and source reference, not just successful execution.
- [ ] Run the same completed receipt suite in authorized n8n Cloud through a temporary gateway tunnel. Verify retained project workflow/table/credential IDs and data before/after; only new journaled test resources may change.
- [ ] Run a deliberately wrong amount/mapping expectation that observes successful n8n execution and exits 1; bad source pin/unknown integration/missing evidence must exit 2 before mutation where preflight can decide.
- [ ] Run deterministic mock twice, one synthetic local-model request, explicit private record then replay without an inference service, and assisted plan generation. Record mode/digest/seed/settings/requests/outputs and prove no expected fixture was rewritten.
- [ ] Exercise interrupt, partial bootstrap/create and cleanup-failure recovery; prove an unrelated sentinel container/table/workflow is preserved. Audit zero owned service/network/volume/credential/table leftovers; shared pulled images are documented caches.
- [ ] Run npm test, npm run build, opt-in integration commands, npm pack --dry-run and git diff --check. No lint script currently exists. Inspect installed CLI init/help/inspect/plan/run/cleanup behavior and scans for actual secret values without displaying values.
- [ ] Write acceptance evidence with exact commands, source/fixture/catalog/image hashes, runtime versions, resource/execution IDs and cleanup. Separate verified/unsupported/manual/bootstrap limits and smoke/baseline/behavior results. Commit evidence and docs; request one independent whole-branch review, fix findings within scope and rerun affected checks. No publish/release/merge is part of this plan.

## Completion and handoff

Milestone 1 is generic offline analysis and plan generation; milestone 2 is actual isolated deterministic execution; milestone 3 is local-model/replay/assistant integration; milestone 4 is external workflow acceptance. Do not call the entire extension complete at an earlier milestone. Each phase remains usable if a later adapter/provider capability is blocked.

The most important early gate is B2a's unattended bootstrap. If it fails under the approved boundaries, retain the analyzer and Cloud improvements, record the exact bootstrap limitation and do not present manual setup as automatic Docker support.

Review this roadmap and its linked plans before execution. The recommendation is inline/native implementation; the owner may select subagent-driven execution instead.
