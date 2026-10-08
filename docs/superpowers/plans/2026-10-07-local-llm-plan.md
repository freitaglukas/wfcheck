# Generic Local LLM and Planning Assistance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Substitute supported workflow LLM calls with deterministic fixtures, local models or replay, and optionally use a local model to suggest generic test plans.

**Architecture:** A bounded model client and known provider adapters sit behind the authenticated test gateway. Workflow model substitution and planning assistance are separate consumers; assistant output is proposal data validated by the deterministic planner and cannot grant execution permissions.

**Tech Stack:** TypeScript/Node 24, Undici, Zod, existing gateway, Ollama/OpenAI-compatible local APIs, Vitest and opt-in real model tests.

**Spec:** [Approved design](../specs/2026-10-07-receipt-cli-support-design.md). [Roadmap/shared interfaces](2026-10-07-generic-workflow-testing-plan.md).

## Global Constraints

All roadmap constraints apply. Mock is default; no hosted fallback or forwarded provider credentials. Use installed local models only unless an explicit configured managed Ollama image/model source is selected. Never auto-download models, modify other applications' routing or update expected fixtures. Non-streaming OpenAI-compatible chat is the first qualified protocol, not universal provider support.

## Review Focus

- A model listed at a local endpoint may be remotely backed and must be rejected (C1).
- Detecting an LLM-looking URL does not authorize rewriting an arbitrary HTTP request (C1/C2).
- Replay miss, truncated response or lost capture must error instead of inventing a fixture (C2).
- Planner prompt injection must not mutate effect permissions/source code/expected truth (C3).
- A frozen local model configuration must not change after an automatic discovery decision (C1).

---

## File structure and interfaces

Create src/llm/{types,discovery,client,policy,recordings}.ts and providers/openai-chat.ts plus providers/ollama-chat.ts; add an n8n native-chat descriptor/adapter under analysis/descriptors and security/bindings. Create src/planning/{assistant,prompt}.ts. Modify gateway server/sidecar transport, CLI commands/config, normalized suite and report metadata. Use minimal unrelated chat/structured-output examples, never receipt prompts.

~~~ts
interface ModelSelection {
  endpoint: string; model: string; digest: string; runtimeVersion: string;
  capabilities: string[]; remote: false;
}
interface GenerationSettings {
  temperature: number; seed?: number; maxOutputTokens: number;
  contextTokens: number; timeoutMs: number;
}
type LlmMode = 'mock' | 'local' | 'replay';
interface ChatRequest { messages: unknown[]; responseFormat?: unknown; }
interface InferenceContext { purpose: 'workflow' | 'planning'; nodeId?: string; }
interface ModelCall {
  purpose: 'workflow' | 'planning'; nodeId?: string; mode: LlmMode;
  status: 'success' | 'error' | 'canceled';
  requestHash: string; responseHash?: string;
  selection?: ModelSelection; settings?: GenerationSettings;
  durationMs: number; response?: unknown; error?: {code: string; message: string};
}
function resolveLlmPolicy(cli: LlmOverrides, test: LlmDefaults,
  suite: LlmDefaults): ResolvedLlmPolicy;
function discoverModels(endpoint: string, signal: AbortSignal):
  Promise<ModelSelection[]>;
function selectModel(models: ModelSelection[], choice: string | 'auto',
  required: string[], preferences: string[]): ModelSelection;
function chat(selection: ModelSelection, request: ChatRequest,
  settings: GenerationSettings, context: InferenceContext,
  signal: AbortSignal): Promise<ModelCall>;
function assistPlan(draft: DraftPlan, input: AssistantInput,
  selection: ModelSelection, signal: AbortSignal): Promise<PlanProposal[]>;
~~~

C1 defines the named LlmOverrides/Defaults/ResolvedLlmPolicy types: mode, local provider kind (ollama or openai-compatible), trusted endpoint, exact model or auto choice, ordered model preferences, generation settings, record path/replay path and per-case call limit. Precedence is CLI > case > suite > default; endpoints never originate from workflow/model output. Default limits: non-streaming, 1 concurrent inference request, 10 calls per case (hard 20), 60-second inference timeout capped by case deadline, 8,192 context tokens and 2,048 output tokens; generation temperature defaults to 0 and seed to 0 where supported. Record unsupported generation controls rather than claiming reproducibility.

C2 defines canonicalChatHash(request: ChatRequest): string, writeRecording(path: string, recording: Recording): Promise<void> and readReplay(path: string, identity: ReplayIdentity, request: ChatRequest): Promise<unknown>. ReplayIdentity carries approved recording hash, source/fixture hashes and model/settings identity. Recording contains formatVersion 1, provider protocol, canonical request hash, fixture/source identity, model/runtime/digest/settings, response hash and synthetic response. Canonical hashing preserves messages/order/schema and hashes inline binary content; strips only explicitly defined transport/auth fields. It must not collapse two semantically different requests.

C3 defines AssistantInput as optional requirement text and explicitly reviewed sanitized Code fragments (nodeId/hash/source). PlanProposal is a strict discriminated union for fixture candidate, assertion candidate, inferred intent and unresolved-requirement explanation, each with controller-assigned inferred/model provenance. parseProposals(raw: string, provenance: Provenance): PlanProposal[] validates model output; it never accepts a model claim of user authority. Trusted bindings/trust/runtime/effect permissions are absent from that schema.

## Task 1 (C1): Bounded local discovery and gateway model policy

**Files:** llm types/discovery/client/policy, providers/openai-chat.ts; gateway transport/server/sidecar; CLI run/plan flags; tests/llm-policy.test.ts, llm-discovery.test.ts, llm-client.test.ts.

**Interfaces:** produces resolveLlmPolicy/discoverModels/selectModel/chat; consumed by C2 workflow gateway and C3 assistant.

- [ ] Write tests flags_override_case_and_suite, mock_never_calls_model, remote_host_model_rejected, missing_local_model_has_no_hosted_fallback and auto_selection_is_frozen. Test exact name/digest, required capabilities and an installed cloud alias whose name looks ordinary.
- [ ] Add local_endpoint_is_trusted_configuration, original_authorization_is_not_forwarded, unknown_route_never_forwarded, response_size_timeout_and_call_limit and assistant_has_no_tool_execution tests. Use a real loopback fake model HTTP server to inspect actual forwarded bodies and headers.

~~~ts
expect(resolveLlmPolicy({mode:'local',model:'test-model'},
  {mode:'replay'}, {mode:'mock'}).mode).toBe('local');
expect(resolveLlmPolicy({}, {}, {}).mode).toBe('mock');
~~~

- [ ] Run npm test -- tests/llm-policy.test.ts tests/llm-discovery.test.ts tests/llm-client.test.ts; observe missing client/policy failures.
- [ ] Implement native Ollama discovery via /api/version, /api/tags and supported capability metadata. Require locally backed installed content and digest. Generic OpenAI-compatible endpoints need trusted configured model identities/capabilities because /v1/models alone cannot prove local backing; do not infer locality from hostname alone.
- [ ] Implement explicit choice or deterministic auto selection: trusted preference order, required capabilities and lexical name/digest tie-break; freeze before case execution. Never pull/change installed models. Report no compatible local model as a configuration/capability error.
- [ ] Implement non-streaming chat forwarding and protocol validation within 64 KiB request/response bounds, 1 concurrent inference call, configured token/call/time budgets and case cancellation. Add providers/ollama-chat.ts when native /api/chat per-request controls are needed to enforce context budgets; translate the supported chat/schema format, preserving messages. An OpenAI-compatible endpoint that cannot enforce a required budget must report that limitation or be rejected, not claim the control was applied. Failed/canceled calls are recorded with status/error, not fabricated responses. Preserve prompt/messages/schema; substitute only model selection and permitted generation/transport settings. Remove incoming auth/account headers; local transport may use a separately configured local service credential kept private.
- [ ] Expose --llm mock|local|replay, --model NAME|auto and trusted endpoint/settings configuration. Resolve these before Cloud/Docker startup; invalid overrides fail preflight. Make default mock require no model service. Record effective policy and model calls in reports. Add validated_numeric_budgets_visible_sensitive_tokens_redacted: allow only typed numeric generation-budget fields in the trusted model-metadata projection; preserve existing redaction for arbitrary token/credential fields.
- [ ] Test host-native Ollama reachability from Docker gateway using the approved bridge mapping without changing its bind address. Add opt-in managed Ollama service using a pinned image and existing supplied model volume/artifact; no automatic new model downloads. Journal/clean only the managed service; never stop host Ollama.
- [ ] Re-run targeted tests/build and one synthetic real local request with exact installed model/digest. Keep model-call proof separate from workflow/runtime evidence. Commit local transport/policy.

## Task 2 (C2): Native chat substitution, deterministic mock and record/replay

**Files:** llm/recordings.ts, capability/native-chat descriptor, security/bindings, gateway, suite schema/reporters; tests/llm-bindings.test.ts, llm-replay.test.ts, native-chat.test.ts; generic examples/workflows/chat.json and suites/chat.yaml.

**Interfaces:** gateway produces ModelCall observations for recognized bound nodes; native models use fresh test credentials. Recording lookup returns an exact stored protocol response or throws; no default synthesized success.

- [ ] Write native_chat_binding_preserves_prompts_and_uses_fake_credentials, arbitrary_http_url_is_not_auto_authorized and unsupported_provider_or_streaming_is_reported tests. Native OpenAI Chat Model + Basic LLM Chain AI connections must be inventoried and validated using pinned runtime metadata; record exact node versions only after real execution.
- [ ] Write mock_response_sequence_is_deterministic, replay_exact_request_matches, replay_prompt_model_schema_change_misses, missing_or_tampered_recording_errors and recording_does_not_modify_expected_fixture tests. Include two different message orders and binary-content hashes.

~~~ts
const first = {messages:[{role:'user',content:'First'}]};
const changed = {messages:[{role:'user',content:'Changed'}]};
expect(canonicalChatHash(first)).not.toBe(canonicalChatHash(changed));
await expect(readReplay(recordPath,identity,changed)).rejects.toThrow(/match/);
~~~

- [ ] Run targeted tests and observe missing adapter/replay failures.
- [ ] Qualify actual native node configuration for the pinned image: map base URL through supported node/credential fields to the test gateway, create ephemeral fake/test credentials, preserve prompt parameters and bind AI edges by IDs/type. If the native version cannot configure a safe alternate endpoint, remain unsupported rather than proxying arbitrary hosted traffic.
- [ ] Enable the qualified native chat registry capability and explicitly bound OpenAI-compatible HTTP chat. Preserve deterministic ordered fixture responses in mock; route local only through the same validated protocol/binding; unrecognized integrations do not fall back to real services.
- [ ] Implement explicit --record <private-path> for synthetic local calls and --llm replay --replay <path>. Record to mode-600 files only on request; require independent user/project approval before a recording is accepted as a regression baseline. Replay uses strict format/hash/size validation and performs zero inference calls; missing/exhausted responses fail.
- [ ] Add report 2 model/runtime/recording provenance and verificationKind. Redact transport credentials and omit binary values. Report temperature/seed as settings, not determinism guarantees.
- [ ] Run an unrelated generic native chat workflow in Docker with mock, local and replay. Include an intentionally wrong structured expectation that exits 1 on successful n8n execution. Re-run legacy examples/unit/build checks; commit qualified adapter/replay.

## Task 3 (C3): Optional local planning assistant with deterministic authority

**Files:** planning/assistant.ts/prompt.ts and proposal schema/types; CLI plan integration; tests/planning-assistant.test.ts, assistant-projection.test.ts; docs/analysis.md; generic fixtures with opaque Code and malicious comments.

**Interfaces:** assistPlan returns PlanProposal[] only; A3 validatePlan rechecks merged draft candidates. Uses C1 selection/chat; never RuntimeAdapter or ResourceJournal.

- [ ] Write malicious_workflow_instruction_cannot_grant_effect_permission, proposal_cannot_set_runtime_endpoint_or_credentials, model_guess_cannot_replace_authored_expectation, invalid_or_truncated_json_is_error and deterministic_facts_win tests.
- [ ] Write sanitized_projection_excludes_code_secrets_by_default, code_requires_explicit_include_and_redaction_review and plan_without_assist_makes_zero_inference_requests tests. The assistant receives a bounded projection and requirement text, not arbitrary exported sharing/history/pinned data or environment files.

~~~ts
expect(() => parseProposals(JSON.stringify([
  {kind:'intent',text:'classify input',runtimeEndpoint:'https://unapproved.example.test'}
]), {source:'inferred'})).toThrow();
~~~

- [ ] Run targeted tests and observe missing assistant failures.
- [ ] Implement --assist local --model NAME|auto on plan; no-assist is deterministic. Add explicit --include-code for reviewed sanitized source where needed and list projection hashes in the report. Use a fixed prompt delimiting all workflow content as data, a strict response schema and no tools.
- [ ] Reject permission/binding/code changes and unsupported proposal variants. Append suggestions with model provenance; preserve authored requirements and deterministic diagnostics. Suggestions cannot make a blocked plan ready by themselves. Failed assistance preserves the deterministic draft but returns a visible assistance error; do not silently present it as an assisted success.
- [ ] Run a synthetic unfamiliar workflow through the real local assistant and validate the output with A3. Demonstrate only proposals are written, no source/expected fixtures/resources are modified, and a repeat completed suite runs with assistance disabled.
- [ ] Re-run tests/build/diff check. Commit optional planning assistance and docs.

## Phase exit

A consumer can choose deterministic mocks, a qualified locally backed model or exact replay using the same generic suite. Native/provider gaps are listed honestly. Assisted plans remain ordinary project data and cannot alter runtime authority; model-backed runs and approved regression fixtures remain distinct.
