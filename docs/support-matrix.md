# Qualified support — 8 October 2026

Inventory accepts up to 500 nodes/1 MiB. V2 execution accepts up to 200 qualified nodes; v1 retains its original 20-node profile. A recognized type alone never grants execution. Parameter shapes, edges, expressions and dependency bindings are validated before mutation.

| Capability | Qualified subset | Fresh verification |
| --- | --- | --- |
| Offline inspect/plan | Full node/dependency/edge inventory, diagnostics, deterministic draft scenarios; optional inferred local suggestions | Unit tests, installed-package onboarding, real local assistant |
| Managed Docker | n8n/runner 2.42.4 by architecture-specific digest; documented entity bootstrap, ephemeral owner/key/project/state | macOS arm64 Docker 29.5.3, actual native execution; amd64 pins unqualified here |
| Docker containment | n8n/runner internal network; gateway alone has uplink; fixed ingress peer, loopback port, no host socket/mounts | Startup and explicit IPv4/IPv6/DNS/host-model reachability probes |
| Cloud | Authenticated public discovery/API, exact per-run copies | Authorized yaumo.app.n8n.cloud; runtime version not exposed by used public APIs |
| Webhook v2 | POST/onReceived or lastNode, selected intake | Actual Cloud/Docker; unique saved correlation marker; synchronous errors still require saved terminal evidence |
| Form Trigger v2.2 | Single ASCII-named file field, Basic auth, actual multipart; lastNode/onReceived; native completion text | Actual image/PDF upload, unauthorized GET rejected, filename/metadata correlation |
| Code v2 | runOnceForAllItems, up to 256 KiB, exact source/Code hash and noExternalEffects review; source-pinned expression review | Actual receipt and unchanged bundled Scout Code on external runner; arbitrary unreviewed Code rejected |
| Extract from File v1 | PDF, bounded pages, joinPages, native binary property | Actual text PDF fast path; no simulated PDF output |
| Set v3.4 / If, Filter v2.2 / NoOp v1 | Existing strict assignments/conditions, simple $json paths and literal empty-string fallback | Mapping, branches, filtering; other allowed scalar operators unit/schema verified |
| HTTP Request v4.2 | Exact source string binding (literal or reviewed expression), JSON bodies, bounded retries, JSON/text/RSS/malformed/status/delay mocks, redirects disabled | Actual requests/error branches/retry; Gmail API read and RSS validation over isolated mock HTTP; source credentials stripped |
| Data Table v1/v1.1 | row get/upsert/update, equality write filters, declared columns/owned mapping, bounded complete row evidence | Native rows, seeded manual-column preservation, repeated Scout ingestion, exact missing-table fault |
| Schedule v1.2 / Execute Workflow Trigger v1.1 | Alternate roots inventoried; recurring triggers disabled in test copies | Actual Scout copies; source exports unchanged |
| Execute Workflow v1.3 | One level, database/literal pinned source ID, once/wait/passThrough; managed Docker, shared declared owned tables | Actual email/RSS parents and native processing children; child published first, external child intakes disabled |
| Gmail v2.1 send boundary | Explicit parameter-hash-pinned replacement with authenticated mock HTTP, original recipient/subject/message expressions | Scout preview/confirmed/uncertain delivery and replay; native Gmail transport/OAuth unqualified by these tests |
| Durable steps | Up to eight JSON replays in deterministic mock mode, same native workflow/tables, distinct saved correlations, per-phase request evidence | Repeat ingestion, manual status preservation, duplicate digest suppression and uncertain-send hold |
| Chat OpenAI v1.3 + Basic LLM Chain v1.9 | Qualified ai_languageModel edge, one model per chain, non-streaming chat completion, responsesApi false | Native deterministic mock, actual physical local inference and strict replay |
| Local service | Installed physical Ollama artifacts, explicit local endpoint, capability/digest frozen; compatible service needs operator manifest | Earlier qwen2.5:0.5b native inference/replay; fresh qwen3.5:9b structured planning with advertised thinking disabled; no hosted alias inference |
| Recording/replay | Immutable private bounded recordings with explicit approval hash/source/fixture/model/settings/request/response checks | Record then replay with inference unavailable; exhausted/mismatched records fail |
| Observations | Stable node/run/output/item indices, request assertions, bounded schema subset, table rows/count | Actual intermediate outputs/table evidence; missing evidence is error |
| Recovery | Exact intents/IDs/names/parents/daemon/labels; independent deletion; no prefix pruning | Partial-create/cleanup-failure unit tests, actual Docker/Cloud cleanup and sentinel preservation |
| CLI/package | init/help/inspect/plan/doctor/run/cleanup, exit 0/1/2; private JSON/JUnit reports | Clean consumer installed from npm pack |
| HTTPS tunnel | Automatic cloudflared or externally managed temporary HTTPS | Fresh Cloudflare Quick Tunnel passed 10/10 Cloud cases; Localtunnel later produced HTTP 408/502; earlier Cloudflare DNS failure retained |

Other providers, streaming/tools/agents, unreviewed expressions, shell/DB/community nodes, native email transports, multi-file triggers, recursive/Cloud children, child outbound/model transports, wait/resume and other table operations are inventoried but rejected until separately qualified. Other model-node versions do not inherit native execution support. Inline vision bodies are bounded at 64 KiB; larger image workflows need a separately qualified transport. Ollama is discovered, not automatically installed/downloaded.

Docker containment reduces accidental external effects but is not a hostile-code sandbox. Cloud cannot prove instance-wide outbound containment. Current broad-coverage evidence and known limits are in [acceptance](acceptance/generic-workflow-testing.md).
