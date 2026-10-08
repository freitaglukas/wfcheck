# Security boundaries

Use reviewed synthetic workflows on development runtimes. This alpha is not a hostile-code or arbitrary customer-upload sandbox. Never use patient/health or production financial data for qualification.

## Offline preflight and authority

Exports are bounded and inventoried as data, never evaluated by the analyzer. Executable copies require qualified node/version/parameter/graph shapes, one trigger, explicit exact HTTP/table bindings and exact reviewed Code hashes/effects. Only simple $json property references and a literal empty-string fallback are qualified; unknown expressions/effects fail closed. Workflow source and independently authored fixtures/oracles stay unchanged.

Models and document contents have no credential, destination or test-authority role. Assistance uses redacted inventory and supplied requirements; Code is excluded by default. Suggestions are inferred, cannot execute drafts, bind resources or approve an expectation. Source/fixture/output observations never automatically rewrite business oracles.

## Docker

Digest-pinned n8n and matching external runner have an internal-only network; only the authenticated gateway has an uplink. Runtime startup probes public IPv4/IPv6, external DNS and host-model access from n8n and runner and fails on reachable/incomplete evidence. There is no host Docker socket or arbitrary bind mount in those containers, root filesystems are read-only, capabilities are dropped and bounded owned volumes/tmpfs hold state/cache. The controller uses its existing Docker daemon and can create exact task-owned resources.

The gateway has a fixed TCP bridge to its owned n8n peer and short-lived control over stdio, never a public control API. Reviewed Code uses the external runner with crypto permitted, no general network grant. These constraints reduce accidental effects; kernel/container vulnerabilities and a malicious local administrator remain outside the boundary. amd64 pins require separate qualification.

Documented export:entities/import:entities bootstrap is pinned to n8n 2.42.4, with migration checks enabled. Disposable owner/project/API-key records are initialized in an owned empty state volume, not an unrelated database. Bootstrap schema/version changes fail until requalified. Shared images remain caches; no global Docker prune is performed.

## Cloud and gateway

The Cloud API key is controller-only in X-N8N-API-KEY; no key goes into workflow copies, public gateway traffic or JSON exports. Authenticated read-only discovery/list calls precede mutations. Native Form/model credentials created for testing contain disposable Basic/gateway secrets, never copied production secrets.

Cloud has copy validation rather than instance-wide egress containment. Use a development instance and avoid concurrent manual changes to temporary workflows. A webhook capability path permits starting that short-lived copy; Form uploads additionally require disposable Basic auth. APIs operate only on exact journaled resources.

The local gateway binds loopback. Public exposure contains authenticated test routes/probes only. Per-case 256-bit namespace tokens expire within bounded deadlines; auth is checked before body capture. Unknown requests, exhaustion, quotas and undrained evidence fail. Bodies/responses are at most 64 KiB, requests at most 100/case and 3,000 total, 20 retained cases, 32 headers, delay at most 5 seconds. Binary upload is separate, sniffed by bytes and bounded at 8 MiB; inline model image requests must also fit 64 KiB. Reports omit binaries/data URLs.

Cloud needs temporary HTTPS ingress. TLS stays verified. Tunnel providers can observe synthetic traffic/tokens and are trusted transport. Automatic tunnels are stopped by wfcheck; external processes must be stopped by the operator. No permanent DNS, firewall or trust-store changes occur. An optional isolated controller resolver does not alter Cloud/host DNS.

## Local inference and replay

Inference is default-off. Ollama discovery excludes remote/cloud artifacts, freezes physical digest/capabilities and bounds requests, time, output, context and per-case call count. No automatic download, hosted fallback or paid call. Existing loopback/local private services are operator-trusted; OpenAI-compatible endpoints require an authored locality/capability manifest. Only the gateway may reach the selected local service; workflow-supplied hosts/headers/auth are never forwarded.

Recordings use private immutable mode-600 files. Replay requires explicit approval hash, matching source/fixture/settings/model identity and exact request/response hashes. Missing, exhausted, truncated or mismatched responses fail rather than manufacture completions. Recordings do not establish correctness and may contain sensitive prompts/responses; use synthetic data. Conservative text budgets are not a proof of every model's multimodal tokenizer behavior.

## Ownership, interruption and recovery

Private atomic journals record intents before mutations, then exact IDs. Recovery verifies instance/daemon, exact names/labels and execution parents; it never searches/deletes by prefix. Changed identities and uncertain creates remain explicit blockers while independent exact resources can recover. Confirm exact IDs manually for lost create responses. Never blindly repeat create/trigger/write after ambiguity.

SIGINT/SIGTERM attempt exact cleanup. SIGKILL, outages and power loss require journal recovery; keep-runtime-on-failure is explicit. A stale run lock can be removed only after confirming no controller remains. Manifests are trusted local records, not signatures against a malicious administrator. Cleanup errors take exit-code precedence over regressions.

## Reports and secrets

.env, .wfcheck and artifacts are Git-ignored. Keys/tokens, credential/password/authorization/cookie fields and sensitive scalar assertions are redacted. Supply redactValues for additional literals. Redaction cannot discover every secret in arbitrary free text; inspect reports before sharing. Model recordings are intentionally private rather than public reports. No telemetry, default uploads or third-party report submission.

Contact the repository owner privately for vulnerabilities. Do not include credentials or unredacted execution data in public issues.

Recovery acquires the lifecycle lock before loading ownership, and journal writes reject stale snapshots. Cancellation stops subsequent create/seed/import operations and teardown waits for in-flight preparation accounting. Only the actual reviewed Code implementation bypasses expression inspection; a data field named jsCode has no exemption. Report outputs cannot replace protected source/fixtures/recordings or existing non-report files. Non-default unsupported stop/sampling/logprob controls are rejected rather than silently discarded. Model work has a separate case deadline and is cancelled when that case is sealed.
