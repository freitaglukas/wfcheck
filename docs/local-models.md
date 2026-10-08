# Local model policy

Mock is the default. `--llm local --model NAME|auto --llm-endpoint http://127.0.0.1:11434` selects installed physical Ollama content. Discovery reads version, tags, digest and capabilities; remote-host/cloud aliases are excluded, even when their name looks ordinary. Selection freezes before a case. No model pulls, host-service rebinding or hosted fallback occur.

Planning uses schema-constrained output with at most four concise proposals. If
Ollama's actual show metadata advertises `thinking.values` containing false, the
planner sends `think: false` so reasoning does not consume its bounded completion
budget. Other models receive no unsupported thinking option. The 5,000-byte
redacted projection includes compact node/edge dictionaries, full immutable hashes
and explicit omissions. Fresh qwen3.5:9b plans for exported workflows produced valid inferred
suggestions; their large bundled Code was not included for semantic review.

CLI overrides case settings, which override suite defaults. Limits: one concurrent call, default 10 calls per case (hard 20), 60-second timeout, 8192 context tokens and 2048 output tokens, temperature 0 and seed 0. Native Ollama receives `num_ctx`/`num_predict` per request. The context check conservatively budgets text bytes; it does not claim deterministic vision tokenization. Failed, canceled, oversized, tool-based or truncated responses produce errors and no fabricated completion.

Only validated non-streaming chat/text or inline PNG/JPEG/WebP image content is accepted. Images cannot name external URLs. Forwarding drops source account/auth headers. The model endpoint comes exclusively from trusted configuration. Request/response envelopes stay within 64 KiB. Generation controls are reported as typed numeric metadata; arbitrary token fields retain normal secret redaction.

A generic OpenAI-compatible `/v1/models` listing does not prove local execution. `--llm-provider openai-compatible --llm-identities <private.json>` requires operator-authored identity metadata (schemaVersion 1, models with exact model/digest/runtimeVersion/capabilities/remote:false and contextBudgetField `context_tokens` or `num_ctx`). Qualify that service's enforcement independently. The built-in runtime does not infer this contract from a model response.

Fresh local transport proof: installed physical `qwen2.5:0.5b`, digest `a8b0c51577010a279d933d14c2a8ab4b268079d44c5c8830c0a93900f1827c67`, host runtime 0.35.1, generated independently specified synthetic JSON under temperature 0 / seed 0 / context 8192 / output 32 controls. This establishes transport/control behavior, not model accuracy or workflow correctness.

Workflow gateway routing, approved recording/replay and optional local planning assistance are integrated. They preserve independently authored expectations and do not grant runtime authority. Managed model containers remain unqualified; the verified local inference path uses an already installed native Ollama service and physical model artifact, without adding model infrastructure or downloads.

Native Chat Model 1.3 + Basic LLM Chain 1.9 are now qualified for non-streaming Chat Completions (responsesApiEnabled:false), with immutable prompt preservation and fresh disposable OpenAI credentials pointing only at the gateway. Responses API, tools, extra-body/provider variants and streaming remain unsupported. Earlier model versions are inventoried but unqualified. Explicit OpenAI chat HTTP bindings use the same mock/local/replay protocol; URL appearance alone grants no permission.

--record writes an immutable mode-600 synthetic recording only when requested. It never updates expected fixtures. Replay requires --llm replay --replay <path> --replay-hash <independently-approved-sha256>. The file hash, source/fixture identity, model/settings identity, message order/schema/media hashes and ordered response hashes must match. Missing, exhausted or tampered records error. Replay performs zero inference.

Docker maps a trusted host-loopback model endpoint to the gateway's resolved host.docker.internal private address; the existing Ollama binding stays unchanged. Actual gateway reachability and a native local-model workflow succeeded, then an independently specified synthetic JSON expectation approved the test recording and exact replay succeeded. That project test gate does not automatically approve ordinary user recordings.
