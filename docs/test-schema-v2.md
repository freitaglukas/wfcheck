# Version 2 suites

Version 2 adds JSON/file input, node-ID HTTP bindings, isolated typed tables/seeds, immutable Code review declarations, native table/schema assertions and explicit smoke/baseline/behavior labels. Legacy version 1 parsing remains strict and compatible.

Generated suites carry draft: true. They are ordinary editable project files, but the CLI rejects draft execution until fixtures, bindings and expectations are reviewed. plan --smoke removes the business-oracle requirement, never input/effect/runtime blockers. Planning does not execute Code or infer expected outputs from the implementation.

JSON Schema assertions support bounded type/required/properties/additionalProperties/enum/items/string-number-array limits, depth at most 8 and 64 KiB. References, custom formats and unknown keywords are rejected. All runnable tests require execution.status.

Native table tests now create declared schemas and seed rows through the public API, bind native row get/upsert nodes to owned IDs, and collect actual complete rows before cleanup. Writes must use explicit `defineBelow` mappings; filter/mapping columns must belong to the trusted schema. Id/date system columns cannot be declared. An owned missing-table fault creates and deletes an extra exact table before the native write; the ordinary table stays separate. No application table is read for seeding.

`table.count` and `table.row` require complete named evidence. A row key must select exactly one record. Missing observations and incomplete pagination are evidence errors, never a zero count. `node.schema` and `request.schema` evaluate the bounded JSON Schema subset without executable validators or ignored keywords. See `examples/suites/native-table.yaml` for a keyed upsert that preserves a manual column.

## Inputs, bindings and review

A test declares `input: {kind: json, fixture: fixtures/input.json}` or `input: {kind: file, fixture: fixtures/input.pdf, field: Document, mimeType: application/pdf}`. Paths resolve relative to the suite and must remain in the consumer project after symlink resolution. Files are sniffed by bytes; JSON is bounded at 64 KiB and one file at 8 MiB. Form input uses the native multipart transport and disposable Basic auth. Inline images in bound model requests must also fit the 64 KiB request budget.

A literal HTTP dependency needs a binding with `nodeId`, `expectedUrl`, `mockPath`, and optional `protocol: openai-chat`. Source mismatch fails before mutation. HTTP production credentials are stripped only for qualified known credential types; unknown credential types are rejected. Native table bindings similarly pin `expectedResourceId` and reference a trusted logical table ID.

Reviewed Code declares `trust.sourceHash` and `reviewedCode: [{nodeId, codeHash, noExternalEffects: true}]`. Hashes are SHA-256 of exact UTF-8 source bytes. Review is a human/operator trust decision, not static proof that arbitrary code is safe. Code is not changed by the runtime; test-copy changes are transport, authentication, resources, paths and evidence settings.

## Models

Suite/test `llm` defaults and explicit CLI flags select `mode: mock | local | replay`; default is mock. A native Chat OpenAI v1.3/Basic LLM Chain v1.9 connection has the mock path `/native-model/NODE_ID/v1/chat/completions`. Supply an independently authored OpenAI chat-completion JSON response in its ordered mock rule. Bound HTTP chat paths use their declared `mockPath`.

Local fields: `provider`, `endpoint`, `model`, `preferences`, `temperature`, `seed`, `maxOutputTokens`, `contextTokens`, `timeoutMs`, `maxCalls`. Defaults are temperature 0, seed 0, one concurrent call, bounded time/output/context and at most 10 calls/case (hard limit 20). Runtime discovery freezes eligible physical models before starting Docker or mutating Cloud. Unsupported vision capabilities/cloud artifacts/no candidate fail preflight without hosted fallback. OpenAI-compatible services require `identities` pointing at an operator-authored version-1 manifest with `models: [{model, digest, runtimeVersion, capabilities, remote: false, contextBudgetField: context_tokens | num_ctx}]`; the declared service must actually enforce that budget.

`record` writes an immutable private recording after observed successful local calls. Use a distinct path per test; no file is overwritten. Replay requires `replay` and explicit independently approved `replayHash`, plus matching source/fixture/settings and requested model identity. Request messages and image bytes participate in the request hash. Replay makes no service call and fails on exhausted/mismatched records. Recording approval establishes an accepted baseline, never business truth: keep authored behavior assertions too.

`verificationKind` labels smoke (structural outcome), baseline (reviewed prior observation) or behavior (independent requirement). A label does not synthesize assertions or prove their provenance; the project owner authors/reviews the actual oracle.

Unsupported non-default `stop`, `top_p`, frequency/presence penalties and `logprobs` are rejected by the model gateway; they are not silently dropped. Temperature/seed/output controls remain explicit suite generation-policy overrides. Results carry `verificationKind` in JSON and JUnit. Model work is cancelled at its case deadline and when the case is sealed, independently of the transport token's grace lifetime. Cancellation also reaches create/import/seeding operations, with pending ownership accounting settled before teardown.
