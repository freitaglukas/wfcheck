# Workflow Analysis and Test Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Analyze any export completely and produce a generic, provenance-rich draft suite without executing workflow code.

**Architecture:** A tolerant inventory parser feeds a strict type/version/operation capability registry and graph analyzer. The planner converts known inputs/effects into suite drafts; the compiler independently validates executable configuration and keeps guessed expectations separate from authored contracts.

**Tech Stack:** TypeScript ESM, Node 24, Zod, YAML, Commander and Vitest; use existing dependencies.

**Spec:** [Approved design](../specs/2026-10-07-receipt-cli-support-design.md). [Roadmap and shared interfaces](2026-10-07-generic-workflow-testing-plan.md).

## Global Constraints

All roadmap constraints apply. Analysis requires no API key, Docker daemon, tunnel or inference service. Never evaluate expressions/Code. Unsupported inventory is preserved; executable unknown effects fail closed. Existing version 1 suites remain compatible.

## Review Focus

- New fields, duplicate identities and AI connections must not cause the analyzer to stop after its first gap (A1).
- Metadata is descriptive, not proof of effects or complete input schemas (A2).
- Secret strings in Code, URLs or body fields must not leak through summaries (A1).
- A workflow's own outputs cannot establish its expected business result (A3).
- Assistant/draft configuration must not become an executable permission grant (A3, C3).

---

## File structure and locked interfaces

Create src/analysis/types.ts (inventory, facts/provenance, diagnostics), export.ts (bounded parse/projection), graph.ts (typed edges/topology), registry.ts (capability lookup), descriptors/core.ts (generic core node semantics), descriptors/integrations.ts (HTTP/table/model effects) and index.ts (analysis entry point). Create src/planning/types.ts, deterministic.ts and validate.ts for draft/requirements/readiness. Create src/spec/schema-v2.ts and normalized.ts; preserve src/spec/schema.ts as version 1 and dispatch in load.ts. CLI gains inspect/plan; execution-specific preparation remains in src/security/workflow.ts.

~~~ts
type FactSource = 'deterministic' | 'catalog' | 'user' | 'inferred' | 'unknown';
interface Provenance { source: FactSource; pointer?: string;
  artifactHash?: string; note?: string; }
interface AnalysisOptions { catalog?: NodeCatalog; }
interface NodeCatalog { runtimeVersion: string; sha256: string;
  nodes: Array<{ type: string; versions: number[]; description: unknown }>; }
interface WorkflowAnalysis {
  schemaVersion: 1; sourceHash: string; catalogHash?: string;
  nodes: NodeAnalysis[]; edges: TypedEdge[]; triggers: TriggerAnalysis[];
  requirements: PlanRequirement[]; diagnostics: Diagnostic[];
}
function analyzeWorkflow(source: string,
  options?: AnalysisOptions): WorkflowAnalysis;
function buildDraft(analysis: WorkflowAnalysis,
  requirements?: BehaviorContract[]): DraftPlan;
function validatePlan(draft: DraftPlan,
  configuration: PlanConfiguration): PlanValidation;
function normalizeSuite(raw: unknown): NormalizedSuite;
~~~

A1 defines NodeAnalysis with id/type/typeVersion, safe summary, capability lookup key, referenced credential *types only*, facts with provenance and local diagnostics. TypedEdge contains from/to/connectionType/outputIndex/inputIndex; preserve unknown connection types. TriggerAnalysis gives the driver/schema facts or an explicit unsupported requirement. Diagnostic has stable code/severity/nodeId/pointer/summary without raw source values.

A2 defines CapabilityDescriptor: type, versions, operation selector, effect ('pure' | 'read' | 'write' | 'llm' | 'state' | 'clock' | 'sub-workflow' | 'opaque'), driver, input/output schema facts, execution/mock/observation/isolation state and required bindings. NodeCatalog augments descriptions but cannot elevate a registry capability. Code/expressions are opaque until a user-supplied reviewed source/effect declaration is provided; that declaration is recorded as trust, not a static safety proof.

A3 defines DraftPlan: schemaVersion 1, sourceHash, analysisHash, runtime/catalog pins, selected trigger, requirements, proposed suite, unresolved items and proposed oracle provenance. PlanConfiguration in planning/types.ts contains candidateSuite (unknown until normalized), optional runtimeCapabilities, validatedInputs (path/hash/kind metadata supplied by compileSuite) and authoredContracts (BehaviorContract[]); it contains no inferred effect grants. PlanValidation is { ready: boolean, executable: NormalizedSuite | null, diagnostics: Diagnostic[] }; a valid draft is not automatically ready. NormalizedSuite/TestSpec fields are locked by the roadmap. BehaviorContract contains contract ID, fixture ID, assertion and requirement provenance; it is structured project data. Markdown requirements are retained as source for optional C3 interpretation, not turned into guessed assertions by the deterministic planner.

## Task 1 (A1): Export inventory, graph and safe offline inspection

**Files:** analysis types/export/graph/index; src/cli/main.ts; tests/analysis-export.test.ts, analysis-graph.test.ts, inspect-cli.test.ts; tests/fixtures/analysis/*.json; docs/analysis.md.

**Interfaces:** produces analyzeWorkflow(source, options) -> WorkflowAnalysis; deliberately does not use prepareWorkflow's execution allowlist to decide whether inventory can proceed.

- [ ] Write tests inventory_continues_after_unknown_node, ai_edges_are_preserved, duplicate_identity_is_reported, malformed_json_is_config_error and projection_preserves_source_bytes. Use normal public-export metadata and an unknown node beside supported nodes.
- [ ] Add inspection_redacts_source_values: use a fake secret embedded in Code/header/query and assert it is absent from stdout/JSON; Code text is absent by default, only code hash/size/type and opaque status are exposed. Verify no model/network/runtime calls.

~~~ts
const analysis = analyzeWorkflow(await readFile('tests/fixtures/analysis/mixed.json','utf8'));
expect(analysis.nodes.map(node => node.id)).toEqual(['trigger','unknown','output']);
expect(analysis.diagnostics.some(d => d.nodeId === 'unknown')).toBe(true);
~~~

- [ ] Run npm test -- tests/analysis-export.test.ts tests/analysis-graph.test.ts tests/inspect-cli.test.ts; expect missing analyzer/command failures.
- [ ] Implement bounded parsing and a runtime-field projection separately. Record all unexpected runtime fields; strip known account/history metadata from executable copies and reject nonempty pinned/static state. Build all typed edges and report unknown targets, duplicate names/IDs, cycles, disconnected nodes and trigger alternatives rather than aborting inventory.
- [ ] Add inspect <workflow> --json <path> with private redacted output. Exit 0 for executable analysis under supplied configuration, 2 for missing configuration/unsupported/malformed analysis; keep all diagnostics in either case. No credentials are required.
- [ ] Re-run targeted tests, npm run build and git diff --check. Commit the offline inventory/inspection capability.

## Task 2 (A2): Versioned capabilities and dependency discovery

**Files:** registry.ts, descriptors/core.ts, descriptors/integrations.ts; tests/capabilities.test.ts, dependency-analysis.test.ts; docs/support-matrix.md; optional checked catalog fixture tests/fixtures/analysis/catalog.json.

**Interfaces:** produces lookupCapability(type: string, version: number, operation?: string): CapabilityDescriptor | undefined, consumed by analyzeWorkflow and B3 preparation. NodeCatalog identity is recorded; runtime metadata extraction is B2a's responsibility.

- [ ] Write tests data_table_get_is_read_upsert_is_write, literal_http_is_binding_requirement, dynamic_url_is_unknown, catalog_description_does_not_grant_execution and unsupported_version_has_node_diagnostic. Assert all facts have provenance and unknown dependency effects block readiness.
- [ ] Add fixtures for Webhook, one-file Form, Code, PDF extraction, HTTP, If/Filter/Set/NoOp, Data Table get/upsert and native model/AI edges. Verify a 200-node generic version 2 graph is retained/executable when all capabilities/configuration are supported; a 201-node execution request has a clear limit diagnostic and analysis still inventories it. Rename every node in one fixture; dependency results must remain equivalent by stable IDs/type/operation.

~~~ts
expect(lookupCapability('n8n-nodes-base.dataTable',1,'get')?.effect).toBe('read');
expect(lookupCapability('n8n-nodes-base.dataTable',1,'upsert')?.effect).toBe('write');
expect(lookupCapability('n8n-nodes-base.dataTable',999,'upsert')).toBeUndefined();
~~~

- [ ] Run npm test -- tests/capabilities.test.ts tests/dependency-analysis.test.ts and observe the missing registry failures.
- [ ] Implement operation-sensitive descriptors for the existing core versions and proposed Form 2.2, Code 2, PDF 1, Data Table 1 and HTTP 4.2 JSON-object bodies. Preserve per-capability analyzed/executable/mockable/observable/isolatable state; future native chat versions stay analyzed but not executable until C2 qualifies them.
- [ ] Enumerate required input fields, file/binary references, selected literal destinations, error/retry policies and supported cross-node/JSON field references. Treat arbitrary JavaScript as opaque; do not infer purity from a substring blacklist. Collect exact bindings required by each side effect.
- [ ] Re-run targeted tests and build. Commit generic capability/dependency analysis; document the limits independently of application names.

## Task 3 (A3): Versioned suite contract and deterministic draft generator

**Files:** planning/types.ts/deterministic.ts/validate.ts; spec/schema-v2.ts/normalized.ts/load.ts; src/cli/main.ts; tests/planning.test.ts, schema-v2.test.ts, plan-cli.test.ts; docs/test-schema-v2.md and suite-schema-v2.json.

**Interfaces:** buildDraft, validatePlan and normalizeSuite from the file-structure block; used by B/C. normalizeSuite parses version 1 or version 2 into one internal contract, while the exported version 1 suiteSchema remains strict for current tests.

- [ ] Write draft_lists_missing_fixtures_bindings_and_oracle, source_hash_change_blocks_execution, independent_contract_detects_wrong_mapping and no_oracle_is_smoke_only tests. Generate an intentionally broken name-to-email mapping and assert an independently supplied email expectation is retained instead of inferred from that mapping.
- [ ] Test v1_backward_compatibility, v2_rejects_extra_effect_permissions, unknown_assertion_node_or_table_rejected and changed_catalog_invalidates_capability_readiness. Proposals cannot set trusted Code/effect declarations, runtime endpoints or credential grants.

~~~ts
const draft = buildDraft(analyzeWorkflow(await readFile('tests/fixtures/analysis/mixed.json','utf8')));
const checked = validatePlan(draft, {
  candidateSuite: draft.proposedSuite, validatedInputs: [], authoredContracts: []
});
expect(checked.ready).toBe(false);
expect(checked.executable).toBeNull();
~~~

- [ ] Run npm test -- tests/planning.test.ts tests/schema-v2.test.ts tests/plan-cli.test.ts tests/spec.test.ts; observe the new feature failures and keep current strict version 1 expectations.
- [ ] Implement strict version 2 suite syntax: tests retain workflow/mocks/assertions; input is JSON fixture or file fixture/field/MIME; bindings are keyed by node ID with expected literal original destination and logical replacement; tables declare columns/seed rows; trust pins the source and separately declares reviewed Code effects; verificationKind records smoke/baseline/behavior. Include execution.status in each runnable test.
- [ ] Implement generic table assertions: table.count with tableId/equals and table.row with tableId, exact key field/value, RFC 6901 pointer and equals. Implement node/request schema assertions with a bounded JSON Schema subset (type, required, properties, additionalProperties, enum, items, min/max string/number/item limits); reject refs/code/custom formats and nesting > 8. Never silently weaken unknown schema keywords.
- [ ] Generate branch/missing-input/dependency-error/retry candidates from known descriptors and explicit schema/conditions. Retain draft values and unresolved required configuration. An empty/draft-only/unexecuted suite cannot return a test success.
- [ ] Add plan <workflow> --out <suite> --json <analysis> --requirements <file>. Write a draft analysis sidecar and suite with unresolved diagnostics; refuse to overwrite an existing suite without an explicit --force. Generate only safe scaffold paths; never execute generated Code or update expected values. Add --smoke as an explicit automatic structural-test planning policy: it may produce a smoke suite without a business oracle, but cannot clear fixture/binding/effect/runtime blockers or weaken existing authored assertions.
- [ ] Update CLI help and version 2 JSON Schema generated from Zod. Re-run targeted tests, existing generic tests, build and diff check. Commit deterministic planning and normalized contracts.

## Phase exit

Inspect and plan work offline from a clean installed package, including unfamiliar unsupported exports. Every unresolved input/effect/oracle remains visible and maps to a stable node/JSON path. Repeat authored suites need no analysis/model call. Runtime support is not claimed by this phase.
