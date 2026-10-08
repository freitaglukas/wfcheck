# Version 2 suites

Version 2 adds JSON/file input, node-ID HTTP bindings, isolated typed tables/seeds, immutable Code review declarations, native table/schema assertions and explicit smoke/baseline/behavior labels. Legacy version 1 parsing remains strict and compatible.

Generated suites carry draft: true. They are ordinary editable project files, but the CLI rejects draft execution until fixtures, bindings and expectations are reviewed. plan --smoke removes the business-oracle requirement, never input/effect/runtime blockers. Planning does not execute Code or infer expected outputs from the implementation.

JSON Schema assertions support bounded type/required/properties/additionalProperties/enum/items/string-number-array limits, depth at most 8 and 64 KiB. References, custom formats and unknown keywords are rejected. All runnable tests require execution.status.

Native table tests create declared schemas and seed rows through the public API, bind native row get/upsert/update nodes to owned IDs, and collect complete rows before cleanup. Writes must use explicit `defineBelow` mappings; filter/mapping columns must belong to the trusted schema. Id/date system columns cannot be declared. An owned missing-table fault creates and deletes an extra exact table before the native write; the ordinary table stays separate. No application table is read for seeding.

`table.count` and `table.row` require complete named evidence. A row key must select exactly one record. Missing observations and incomplete pagination are evidence errors, never a zero count. `node.schema` and `request.schema` evaluate the bounded JSON Schema subset without executable validators or ignored keywords. See `examples/suites/native-table.yaml` for a keyed upsert that preserves a manual column.

## Inputs, bindings and review

A test declares `input: {kind: json, fixture: fixtures/input.json}` or `input: {kind: file, fixture: fixtures/input.pdf, field: Document, mimeType: application/pdf}`. Paths resolve relative to the suite and must remain in the consumer project after symlink resolution. Files are sniffed by bytes; JSON is bounded at 64 KiB and one file at 8 MiB. Form input uses the native multipart transport and disposable Basic auth. Inline images in bound model requests must also fit the 64 KiB request budget.

A literal HTTP dependency needs a binding with `nodeId`, `expectedUrl`, `mockPath`, and optional `protocol: openai-chat`. Source mismatch fails before mutation. HTTP production credentials are stripped only for qualified known credential types; unknown credential types are rejected. Native table bindings similarly pin `expectedResourceId` and reference a trusted logical table ID.

Reviewed Code declares `trust.sourceHash` and `reviewedCode: [{nodeId, codeHash, noExternalEffects: true}]`. Hashes are SHA-256 of exact UTF-8 source bytes. Review is a human/operator trust decision, not static proof that arbitrary code is safe. Code is not changed by the runtime; test-copy changes are transport, authentication, resources, paths and evidence settings.

Nontrivial expressions require `trust.reviewedExpressions: true` with an exact source hash. Dynamic HTTP/table expressions still require their exact source string in `expectedUrl`/`expectedResourceId`; the expression never selects a destination or table. The trusted binding supplies the isolated resource. Code is bounded at 256 KiB per node, within the existing 1 MiB workflow limit. Only the selected Webhook/Form intake remains enabled; scheduled intakes are disabled in the copy.

An explicit Gmail-send substitution uses `nodeMocks: [{nodeId, expectedParametersHash, mockPath}]`. Its pin is SHA-256 of `JSON.stringify(sourceNode.parameters)`. Only the qualified message/send shape is supported. The replacement sends the original recipient, subject and message expressions to the authenticated mock gateway. This verifies workflow delivery decisions and content, not native Gmail OAuth or delivery.

## Native children and durable replays

`subworkflows: [{nodeId, expectedWorkflowId, workflow, triggerId, trust, tableBindings}]` qualifies one level of native Execute Workflow calls in managed Docker only. The source child ID and child source/Code hashes must match. The child must have exactly one enabled native Execute Workflow Trigger; its external Webhook/Form/schedule intakes are disabled. It is published before the parent and shares only the parent's declared owned tables. Recursive children, child HTTP/model/email transports and Cloud child execution remain unsupported. Child `triggerId` must identify its single enabled native Execute Workflow Trigger. No external intake is required, and the native entry is preserved without intake path or authentication rewriting.

`steps: [{id, input: {kind: json, fixture}, assertions}]` submits up to eight additional fixtures to the same workflow and durable tables, with a new saved correlation marker per step. Root and steps all require `execution.status` and validated mock/table references. Steps currently require JSON intake and deterministic mock mode. Each step's request counts cover only requests observed since the preceding phase. Table snapshots show state after that phase. Late requests are audited at the suite cutoff and attributed to the last observed phase. Terminal execution/request evidence is retained even if table collection or assertions fail.

The hard ceiling of 20 executions includes parent replays and native child calls. Before startup, the planner conservatively counts every main-graph path from the selected trigger to each bound child node, including mutually exclusive branches. Reported `plannedExecutions` can therefore exceed observed executions; `--max-executions` can lower the ceiling. Triggers are never retried.

Planning readiness uses the same preparation checks as execution. Private
`workflowSources` must include every root and child path, and `validatedInputs`
must include each root/step fixture. Child plans also require managed Docker
capabilities. Invalid child entries/transports, step assertion nodes or an
execution bound above 20 cannot be marked ready.

Text mock responses may declare `contentType: application/rss+xml | application/xml | text/xml | text/plain`; the default remains text/plain. This exercises feed validation against actual HTTP response headers without contacting a public source.

## Models

Suite/test `llm` defaults and explicit CLI flags select `mode: mock | local | replay`; default is mock. A native Chat OpenAI v1.3/Basic LLM Chain v1.9 connection has the mock path `/native-model/NODE_ID/v1/chat/completions`. Supply an independently authored OpenAI chat-completion JSON response in its ordered mock rule. Bound HTTP chat paths use their declared `mockPath`.

Local fields: `provider`, `endpoint`, `model`, `preferences`, `temperature`, `seed`, `maxOutputTokens`, `contextTokens`, `timeoutMs`, `maxCalls`. Defaults are temperature 0, seed 0, one concurrent call, bounded time/output/context and at most 10 calls/case (hard limit 20). Runtime discovery freezes eligible physical models before starting Docker or mutating Cloud. Unsupported vision capabilities/cloud artifacts/no candidate fail preflight without hosted fallback. OpenAI-compatible services require `identities` pointing at an operator-authored version-1 manifest with `models: [{model, digest, runtimeVersion, capabilities, remote: false, contextBudgetField: context_tokens | num_ctx}]`; the declared service must actually enforce that budget.

`record` writes an immutable private recording after observed successful local calls. Use a distinct path per test; no file is overwritten. Replay requires `replay` and explicit independently approved `replayHash`, plus matching source/fixture/settings and requested model identity. Request messages and image bytes participate in the request hash. Replay makes no service call and fails on exhausted/mismatched records. Recording approval establishes an accepted baseline, never business truth: keep authored behavior assertions too.

`verificationKind` labels smoke (structural outcome), baseline (reviewed prior observation) or behavior (independent requirement). A label does not synthesize assertions or prove their provenance; the project owner authors/reviews the actual oracle.

Unsupported non-default `stop`, `top_p`, frequency/presence penalties and `logprobs` are rejected by the model gateway; they are not silently dropped. Temperature/seed/output controls remain explicit suite generation-policy overrides. Results carry `verificationKind` in JSON and JUnit. Model work is cancelled at its case deadline and when the case is sealed, independently of the transport token's grace lifetime. Cancellation also reaches create/import/seeding operations, with pending ownership accounting settled before teardown.

Completed test evidence survives runtime teardown failures or explicit retention. JSON retains the original `tests`, records a separate `runtimeError` and returns suite `exitCode: 2`. JUnit preserves test assertions and adds an infrastructure error case named `Runtime cleanup`; that case does not represent another n8n execution. Recovery instructions remain in the redacted error message and private ownership journal.
