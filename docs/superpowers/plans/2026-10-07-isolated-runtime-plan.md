# Isolated n8n Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Execute generic normalized suites using isolated Cloud copies or an automatically managed Docker n8n instance, with actual input/output/table evidence and recoverable cleanup.

**Architecture:** A runtime factory owns run-level services; adapters own per-case resources and use shared public n8n lifecycle/observation logic. Docker runs an internal n8n/task-runner network with a gateway sidecar controlled through local stdio, and Cloud retains its temporary HTTPS gateway path.

**Tech Stack:** Node 24/TypeScript, child_process.spawn with argument arrays, Docker CLI, pinned official n8n/task-runner/Node images, Zod, existing gateway/Undici and Vitest.

**Spec:** [Approved design](../specs/2026-10-07-receipt-cli-support-design.md). [Roadmap/shared interfaces](2026-10-07-generic-workflow-testing-plan.md).

## Global Constraints

All roadmap constraints apply. No Docker socket inside workloads or unrelated mounts/services. Exact-ID intent journal before mutations; public API discovery before Cloud writes. Keep current quotas/serial limits. Fully automatic bootstrap and actual trigger fidelity are independently qualified.

## Review Focus

- Unknown create outcomes or journal persistence failure must remain visible and recoverable (B1).
- A failing bootstrap must not lead to private-editor API/SQL shortcuts (B2a).
- Form response timeouts and duplicate execution markers must not be retried or guessed (B3).
- Seeded rows/manual columns and true empty vs incomplete table observations must differ (B4).
- Host/IPv6 egress bypass and stray containers/networks must be tested, not assumed contained (B2b).

---

## File structure and interfaces

Create src/runtime/factory.ts and journal.ts; keep manifest.ts as legacy compatibility/loading façade. Extract shared lifecycle/client/observation logic into src/adapters/n8n-api/{client,lifecycle,observe,resources}.ts while retaining current n8n-cloud import exports. Create src/adapters/docker/{engine,images,bootstrap,index}.ts and images.json, fixtures/bootstrap/<version>/, src/gateway/{transport,sidecar,docker}.ts and docker/gateway.Dockerfile. Create src/runtime/inputs.ts and security/bindings.ts. Expand runner/types, CLI config/setup and assertion/report modules in focused tasks.

~~~ts
type ResourceKind = 'workflow' | 'execution' | 'credential' | 'table'
                  | 'container' | 'network' | 'volume';
interface OwnedRecord {
  intentId: string; runId: string; testId?: string; kind: ResourceKind;
  name: string; id?: string; ownerIdentity: string; parentId?: string;
  state: 'creating' | 'owned' | 'cleaned';
}
interface RuntimeSession {
  adapter: RuntimeAdapter; gateway: GatewayTransport; gatewayUrl: string;
  capabilities: RuntimeCapabilities; journal: ResourceJournal;
  close(): Promise<void>;
}
function createRuntime(options: RuntimeOptions,
  signal: AbortSignal): Promise<RuntimeSession>;
function loadInput(spec: NormalizedInput, projectRoot: string):
  Promise<CompiledInput>;
~~~

B1 ResourceJournal constructor is (directory: string, runId: string, ownerIdentity: string). It exposes begin(input: Omit<OwnedRecord,'intentId'|'id'|'state'>): Promise<OwnedRecord>, confirm(intentId: string, id: string): Promise<void>, markCleaned(intentId: string): Promise<void>, leftovers(): OwnedRecord[] and static load(path: string): Promise<ResourceJournal>. ownerIdentity is the Cloud origin or Docker daemon/context identity. Legacy Manifest loading translates workflow/execution records without granting new ownership.

B2a/B2b RuntimeOptions selects cloud or docker and includes trusted image pins, state directory, gateway settings, resource limits, keep-on-failure flag and optional model-service endpoint. DockerGateway implements the roadmap's GatewayTransport through framed stdin/stdout IPC (command IDs/acknowledgements and validated request/error events); it has no network control routes. The gateway alone can use a model uplink after C1.

B3 implements RuntimeAdapter/PreparedWorkflow/RuntimeHandle changes from the roadmap. The API client accepts HTTPS Cloud origins exactly as today or an HTTP loopback origin returned by the owned Docker session; arbitrary insecure origins remain rejected.

## Task 1 (B1): Resource journal and recovery across partial creation

**Files:** runtime/journal.ts/manifest.ts; adapters/n8n-api/resources.ts; cli cleanup; tests/journal.test.ts, ownership.test.ts, partial-creation.test.ts; docs/recovery.md.

**Interfaces:** produces ResourceJournal and adapter recover(testId?), required before Docker or table/credential creation.

- [ ] Write journals_intent_before_create, lost_create_response_is_not_retried, save_failure_keeps_recovery_intent, changed_exact_name_refuses_cleanup, legacy_manifest_recovers and cleanup_preserves_unrelated_resource tests. Include generated table/auth creation followed by a failed workflow import.

~~~ts
const entry = await journal.begin({runId:'run',testId:'case',kind:'table',
  name:'wfcheck-dev-exact',ownerIdentity:'https://fake.example.test'});
expect(entry.state).toBe('creating');
expect(entry.id).toBeUndefined();
expect(journal.leftovers()).toContainEqual(entry);
~~~

- [ ] Run npm test -- tests/journal.test.ts tests/ownership.test.ts tests/partial-creation.test.ts; observe new failures.
- [ ] Implement strict mode-600 atomic journals and a per-run lock. Persist intent first and exact ID immediately after creation; never put credential values in records. Clean known partial resources even when no RuntimeHandle was returned. Retain uncertain intents and fail exit 2; never recover them by prefix search.
- [ ] Implement dependency-ordered recovery: stop/delete owned executions and workflow, then credentials/tables; stop owned containers before volumes/networks. Verify runtime identity and names/labels; tolerate confirmed 404/absent exact IDs. Attempt independent safe cleanup after one deletion fails and report all remaining IDs/intents.
- [ ] Extend cleanup <manifest> to dispatch by recorded runtime without requiring a Cloud key for Docker. Never change a manifest's runtime origin to fit current environment. Provide exact uncertain-create recovery instructions.
- [ ] Re-run targeted tests, build and diff check. Commit journal/recovery separately.

## Task 2 (B2a): Qualify unattended bootstrap and image/catalog pins

**Files:** docker engine/images/bootstrap, images.json and bootstrap fixtures; n8n-api/client.ts; tests/docker-engine.test.ts, docker-bootstrap.test.ts and opt-in tests/e2e/bootstrap.test.ts.

**Interfaces:** produces qualifyBootstrap(stateDirectory: string, pins: ImageSet, signal: AbortSignal): Promise<BootstrapQualification> for the qualification test, and bootstrap(options: BootstrapOptions, signal: AbortSignal): Promise<BootstrappedInstance> for B2b. BootstrappedInstance carries exact journaled IDs, loopback API origin, private ephemeral key and NodeCatalog; never serialize its key. BootstrapQualification carries status, actual execution observations, image/catalog hashes, diagnostics and leftovers. No workflow execution is part of normal runtime startup.

- [ ] Test spawn_arguments_are_not_shell_commands, no_workload_docker_socket_or_host_secrets, loopback_dynamic_port and startup_deadline_cleanup. Docker commands are spawned with shell:false; passwords/tokens go through private files/stdin, not command text.
- [ ] Run targeted unit tests and observe failures. Add opt-in integration tests fresh_volume_bootstraps_without_cloud_key and real_webhook_execution_has_run_data; normal npm test must not start Docker.
- [ ] Qualify candidate n8n 2.42.4 and matching runner before implementing the broad adapter. Registry-only discovery during planning confirmed n8n linux/arm64 digest sha256:2e2e1cd958335d058d3a82354529b512eecada0d65729036eb45c39455ebd78f and linux/amd64 digest sha256:667c1ec79603670c5b4bfbc38f344016814cca79971dca72e58ea139d8a4023b. This is availability, not runtime proof. The matching runner is docker.io/n8nio/runners:2.42.4 (the docker.n8n.io mirror did not expose that runner tag): arm64 sha256:8da6ea7f99f217484fd1ab3aacbfb6b79d85af04425cc6e50c0766f8f65c00fe; amd64 sha256:3b1a7102c37c2c976f0cc17d44dfdc4adcea3dd6ef1628f60ff3c1500b26e164. Gateway base node:24.18.0-alpine: arm64 sha256:eef73a25205e27bd016ce672af71560ad6b681142ddf00ff63c7b3098eafcd4d; amd64 sha256:4ba75f835bb8802193e4c114572113d4b26f95f6f094f4b5229d2a77773e0afc. Record these candidate pins in images.json; verify actual image versions/capabilities before calling them qualified.

~~~ts
const proof = await qualifyBootstrap(tempDirectory, imagePins, AbortSignal.timeout(180000));
expect(proof.status).toBe('qualified');
expect(proof.executions.some(e => e.status === 'success')).toBe(true);
expect(proof.leftovers).toEqual([]);
~~~

- [ ] In a journaled disposable volume, use documented server CLI operations to initialize/import a version-checked minimal synthetic owner/project/API seed with generated secrets. Verify public API discovery and a saved, correlated Webhook execution. No private editor endpoints, arbitrary SQL or fake node-output evidence. If unattended API bootstrap fails, record the blocker and do not claim this task complete; CLI execution is a separate explicitly limited capability, not a replacement for a real Form/Webhook test.
- [ ] Implement the proven bootstrap only, using bounded readiness (180 seconds), explicit version/schema guard and no printed setup secrets. Extract supported node-description metadata inside the owned pinned image, sanitize it, compute catalog hash and hand NodeCatalog to A2; fail clearly if that image cannot supply it.
- [ ] Re-run qualification/unit/build checks, record supported CLI bootstrap/schema and actual trigger evidence, and commit the bootstrap/catalog capability.

## Task 3 (B2b): Managed runtime and gateway sidecar with cleanup

**Files:** docker/index.ts, runtime/factory.ts; gateway/transport.ts, sidecar.ts, docker.ts and docker/gateway.Dockerfile; cli config/setup; tests/gateway-ipc.test.ts, runtime-factory.test.ts and opt-in tests/e2e/runtime.test.ts; vitest.config.ts, vitest.integration.config.ts and package.json.

**Interfaces:** consumes bootstrap -> BootstrappedInstance and ResourceJournal; produces createRuntime(options, signal) -> RuntimeSession and GatewayTransport. ImageSet in images.ts has n8n/runner/gatewayBase pins per linux arm64/amd64. BootstrapOptions is the Docker subset of RuntimeOptions plus journal; its private runtime key never enters capabilities/reports.

- [ ] Test ipc_missing_ack_is_error, sidecar_exposes_no_http_control_route, interrupt_closes_owned_session, missing_gateway_capture_is_error and keep_on_failure_reports_exact_ids. Add opt-in real runtime cleanup and network tests; exclude tests/e2e/** from ordinary Vitest config, and include them only via explicit integration scripts/config.

~~~ts
const session = await createRuntime({runtime:'docker',stateDirectory:tempDirectory},signal);
expect(session.capabilities.kind).toBe('docker');
await session.close();
expect(session.journal.leftovers()).toEqual([]);
~~~

- [ ] Run npm test -- tests/gateway-ipc.test.ts tests/runtime-factory.test.ts; observe missing implementation failures.
- [ ] Create runtime with random run identity and exact recorded IDs: 1 internal network, 1 private volume, n8n, matching external JavaScript task runner and gateway. Gateway sidecar runs packaged code in a pinned Node 24 image, starts through managed stdio IPC and exposes only authenticated mock/probe HTTP. No Assistant/web search/privileged services. Initial configurable limits: n8n 2 CPUs/2 GiB, runner 1 CPU/1 GiB, gateway 1 CPU/256 MiB.
- [ ] Publish n8n on 127.0.0.1 with an ephemeral host port. Drop capabilities, use no-new-privileges, narrowly mount only owned state/config; use writable owned volumes/tmpfs only where the qualified images require them. Restrict Code builtin modules to declared supported uses (initial crypto) and block environment access. Never mount a consumer checkout or its env file into n8n.
- [ ] Keep n8n/runner on the internal network. The gateway alone may have a separate model uplink, with configured destination allowlisting and no arbitrary proxy/control route. Reuse native host Ollama through qualified Docker host reachability; do not rebind the existing host model service. If Linux loopback cannot be reached, require a configured endpoint or managed model container.
- [ ] Prove successful gateway traffic and blocked direct public IPv4/IPv6/DNS/host-service paths from both n8n and runner, including a known HTTP-node request and reviewed Code attempt. Failed containment proof blocks the containment claim and safe auto-smoke readiness; do not hide it behind a passing local probe.
- [ ] Implement --runtime docker in doctor/run and --keep-runtime-on-failure; default Cloud behavior remains compatible. Bootstrap happens before per-case deadline/token creation. On all exit paths close runtime and journal leftovers; shared pulled images remain as documented caches. Docker doctor may create/delete a run-level runtime but performs zero workflow executions.
- [ ] Re-run unit/build checks and the opt-in real bootstrap tests. Commit the qualified runtime/gateway vertical slice with image/version/catalog and cleanup evidence.

## Task 4 (B3): Generic preparation, real file triggers and correlation

**Files:** runtime/inputs.ts/types.ts/runner.ts; security/workflow.ts/bindings.ts; n8n-api/client/lifecycle/observe and n8n-cloud wrappers; tests/inputs.test.ts, preparation.test.ts, correlation.test.ts, runtime.test.ts, orchestration.test.ts.

**Interfaces:** consumes NormalizedSuite and capability descriptors; produces compiled immutable inputs, prepared isolated copies and TriggerAttempt/ExecutionObservation.

- [ ] Write tests file_path_symlink_escape_rejected, bytes_match_mime, oversized_fixture_rejected, source_and_binary_hashes_stable, unbound_http_or_table_rejected, live_credentials_removed and reviewed_hash_change_rejected. JSON inputs remain <= 64 KiB; file inputs <= 8 MiB and byte-sniffed PNG/JPEG/WebP/PDF. Known inline image routes must budget the 64 KiB JSON envelope; reject incompatible fixture/budget before execution when determinable.
- [ ] Write tests form_filename_correlates_exact_detail, ambiguous_marker_is_error, upload_timeout_is_never_retried, correlated_form_error_is_not_success and unauthorized_trigger_is_infrastructure_error. A response/body timeout may return an uncertain trigger attempt and proceed to exact execution correlation; no correlated evidence remains exit 2. Preserve strict immediate Webhook rejection semantics.

~~~ts
await expect(loadInput({kind:'file',fixture:'../outside.png',field:'file',
  mimeType:'image/png'},projectRoot)).rejects.toThrow(/escapes/);
expect(triggerCalls).toHaveLength(1); // timeout/correlation fixture; never a retry
~~~

- [ ] Run targeted tests and observe new feature failures while existing runtime tests remain valid.
- [ ] Implement loadInput with realpath containment under the consumer project root and file hashing; source hashes cover original bytes, not projected JSON. Build the test copy from only runtime fields. Pin reviewed Code and separately user-declared effects; unknown external effects remain blocked. Model-generated trust is never accepted.
- [ ] Strictly validate supported node versions/operations, selected trigger, acyclic main graph and referenced AI-model connections. Keep dynamic URLs/resource locators/unknown credential types blocked. Match every declared binding to original literal URL/table reference before substituting gateway/owned resource IDs. Preserve JSON-object body expressions and business code unchanged; bounded retries and disabled redirects apply.
- [ ] For Form, provision fresh Basic Auth through public credential APIs and post multipart once using the runtime's actual field transport; add a unique marker to filename while preserving extension/bytes. Do not confuse the form label with n8n's multipart field index. Keep passwords private. Webhooks preserve marker headers.
- [ ] Observe saved trigger binary metadata/header marker for the exact owned workflow and revalidate execution detail. Retain stable node IDs/run/output/item positions; do not infer missing nodes or use latest execution selection. Record trigger HTTP outcome separately from terminal n8n state.
- [ ] Add bounded evidence serialization that omits inline binary/data URLs and records length/hash. Assertions still evaluate real structured values before report projection; reports/JUnit never contain binary or secrets.
- [ ] Re-run targeted and legacy tests/build; prove one generic real JSON Webhook and one Form upload in Docker. Commit transport/preparation support.

## Task 5 (B4): Actual isolated table operations and outcome assertions

**Files:** n8n-api/resources.ts; assertion module (split table/schema evaluators into focused files); runner evidence collection; tests/tables.test.ts, table-assertions.test.ts, schema-assertions.test.ts, table-cleanup.test.ts; generic examples/suites/native-table.yaml.

**Interfaces:** RuntimeAdapter.tables -> TableEvidence[]; evaluate consumes table/schema assertions defined by A3 and actual evidence.

- [ ] Write seed_upsert_preserves_manual_columns, stable_key_retry_has_one_row, wrong_external_table_id_is_blocked, empty_table_differs_from_missing_evidence and multiple_key_matches_are_error tests. Also assert a named logical table with zero rows has complete evidence.
- [ ] Write native_write_fault_touches_only_owned_table: create an extra isolated table for a declared missing-table fault, journal/delete its exact ID before triggering the write, then assert native error and unchanged normal table. Do not accept arbitrary nonexistent production IDs as fault configuration.

~~~ts
expect(evaluate([{target:'table.count',tableId:'records',equals:1}], evidence)
  .every(result => result.passed)).toBe(true);
await expect(adapter.tables(handle,signal)).rejects.toThrow(/evidence/);
// The second fixture returns an incomplete/paginated API response, not zero rows.
~~~

- [ ] Run targeted tests and observe missing table support failures.
- [ ] Create explicit typed tables and bounded seed rows through discovered public APIs; replace all mapped references with owned IDs before workflow import. Read no live application table for test setup. Support row get/upsert only and explicit owned mapping; leave other operations unsupported.
- [ ] Collect bounded rows before cleanup; assert API shape/pagination completeness and exact logical-table mapping. Never return an empty array after API failure. Table row assertions select exactly one stable key; missing/duplicate matches fail evidence instead of being conflated with JSON null.
- [ ] Implement actual schema assertions against node/request JSON, with A3's bounded subset and no executable validator extensions. Missing node/output/table data stays an error.
- [ ] Integrate resource cleanup after observation on pass/fail/error/interrupt; fault resources confirmed absent remain recorded as cleaned. Re-run generic tests/build and native-table Docker suite; commit native operation evidence support.

## Phase exit

A new temporary consumer can run JSON/file/native-table suites without Cloud credentials. Sources and unrelated resources remain unchanged. Exact ownership, source/fixture/image/catalog hashes and actual observations are documented. Docker startup/containment and Cloud fidelity each have independent evidence.
