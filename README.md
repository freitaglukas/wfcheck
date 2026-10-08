# wfcheck — generic n8n regression CLI (alpha)

Inspect an exported workflow, generate a reviewable test plan, and execute authored tests against real n8n. Deterministic mocks are the default; local models and approved record/replay are opt-in. Application workflows and their business expectations belong in separate consumer projects.

One TypeScript package, Node **24 LTS**, Apache-2.0 original code. No telemetry, account registration, default report uploads or hosted model fallback. No packages/releases are published by the development commands.

```sh
npm ci
npm test                         # offline unit tests; no Docker or inference
npm run build
node dist/cli/main.js --help
node dist/cli/main.js inspect examples/workflows/chat.json
node dist/cli/main.js plan examples/workflows/chat.json --out artifacts/chat-draft.yaml
node dist/cli/main.js run examples/suites/chat.yaml --runtime docker
```

Docker starts a disposable digest-pinned n8n **2.42.4**, matching external task runner, isolated state and authenticated gateway. It bootstraps the fresh owner/project/API key using documented n8n entity export/import commands; there is no editor API login, arbitrary database access or manual owner setup. Startup performs actual network containment probes before executing a workflow. Docker must already be installed and running. arm64 is live-qualified; amd64 pins require qualification on that platform. Shared pulled/built images remain caches after cleanup.

## Testing a new workflow

```sh
wfcheck inspect workflow.json --json artifacts/inventory.json
wfcheck plan workflow.json --out tests/draft.yaml --requirements requirements.txt
```

Inventory includes every node, main/AI edge, trigger and dependency. Unsupported nodes remain visible. The planner proposes missing-input, branch, dependency-failure and retry cases with provenance, but **does not infer business correctness from current output**. Drafts cannot run. Review requirements, author fixtures/oracles, supply exact HTTP/table bindings and any reviewed Code hashes, and remove the draft marker only when ready.

```sh
wfcheck run tests/behavior.yaml --runtime docker --json artifacts/result.json --junit artifacts/result.xml
wfcheck cleanup .wfcheck/journal-THE-RUN-ID.json
```

Use [suite v2 documentation](docs/test-schema-v2.md), [JSON Schema](docs/suite-schema-v2.json) and the [qualified support matrix](docs/support-matrix.md). Version 1 suites retain their original restricted profile. Unknown integrations, operations, parameter shapes or expressions fail preflight; registry inventory is broader than execution support. Code requires an exact source/hash/effects review. Dependency destinations are selected by trusted suite configuration, never by model suggestions.

## Optional local models

```sh
wfcheck run examples/suites/chat.yaml --runtime docker --llm local --model qwen2.5:0.5b
wfcheck run examples/suites/chat.yaml --runtime docker --llm local --model qwen2.5:0.5b --record .wfcheck/chat-record.json
# Review the private recording independently; supply its SHA-256 explicitly:
wfcheck run examples/suites/chat.yaml --runtime docker --llm replay --replay .wfcheck/chat-record.json --replay-hash APPROVED_SHA256
wfcheck plan workflow.json --out tests/assisted-draft.yaml --assist local --model qwen2.5:0.5b
```

The model service must already exist locally; physical Ollama artifacts are discovered and digest-pinned. Cloud aliases are rejected. `auto` selects only eligible installed artifacts; no automatic download or paid fallback. OpenAI-compatible services require an operator-authored locality/capability identity manifest. Native Chat OpenAI/Basic LLM Chain and explicitly bound chat HTTP requests use the same gateway protocol. Replay makes no inference requests and fails on changed source, fixture, messages, settings, identity or exhausted responses. Recordings are private and never establish an oracle. Multi-case recording paths must be distinct because files are immutable.

Optional assistance receives redacted workflow inventory and supplied requirements, with Code excluded unless explicitly requested. Suggestions remain marked inferred and cannot create credentials, grant effects, bind production destinations, clear blockers or approve expected values.

## n8n Cloud

Create a private `.env` locally, mode 600:

```dotenv
N8N_BASE_URL=https://your-development-instance.example/
N8N_API_KEY=
```

Fill the key in a local editor; never echo it, pass it on a command line or put it into workflow JSON. Read-only authenticated public discovery/list operations precede mutations. The key needs the advertised workflow/execution operations plus credential/table operations used by the suite. Only exact IDs created by that run are mutated or deleted.

A temporary HTTPS gateway is required. Automatic cloudflared is supported. Cloudflare Quick Tunnel has passed synthetic Cloud integration tests; fresh-hostname DNS can fail. External Localtunnel worked in the original spike but produced HTTP 408/502 in the later run. Both temporary transports remain dependent on provider connectivity:

```sh
npx --yes localtunnel@2.0.2 --port 43199 --local-host 127.0.0.1
# In the wfcheck terminal, use the printed temporary URL:
export WFCHECK_GATEWAY_PORT=43199
export WFCHECK_GATEWAY_URL=https://THE-PRINTED-HOST.loca.lt
wfcheck doctor --tunnel external
wfcheck run tests/behavior.yaml --runtime cloud --tunnel external
# Stop the externally managed tunnel with Ctrl-C when finished.
```

The gateway exposes only authenticated bounded test traffic/probes, not control APIs. Tunnel providers are trusted transport for synthetic data. Cloud isolation is copy validation, **not instance-wide egress containment**. No permanent DNS/firewall/ingress changes are made.

## Evidence, exit codes and recovery

- **0**: all authored assertions pass with required actual evidence and cleanup.
- **1**: observed regression, even when n8n reports success.
- **2**: preflight, unsupported behavior, missing evidence, infrastructure, interruption or cleanup failure.

Execution is serial, at most 20 planned executions per invocation including replay steps and a conservative bound on native child calls; `--max-executions` lowers the limit. Triggers are submitted once. Expected n8n errors require actual terminal/error evidence. Reports include source/fixture hashes, transport changes, saved intermediate outputs, per-phase requests, native table rows and model provenance. Binary/base64 payloads and credentials are redacted.

Private ownership journals are written before resource creation. Recovery verifies exact IDs, names, parent workflows and Docker daemon/labels. A lost create response remains an explicit uncertain intent; never recreate or delete by prefix. Confirm its exact ID manually before cleanup. SIGINT/SIGTERM attempt cleanup; SIGKILL, outages and power loss require journal recovery. `--keep-runtime-on-failure` explicitly retains Docker resources and prints recovery information. See [security boundaries](SECURITY.md) and [fresh acceptance evidence](docs/acceptance/generic-workflow-testing.md).

## Verification and packaging

```sh
npm test
npm run build
npm run test:docker      # opt-in; real Docker, no model service required
npm run test:local-llm   # opt-in; existing Ollama qwen2.5:0.5b required
npm pack --dry-run
npm pack                # local tarball only
```

No lint script currently exists. `wfcheck init` copies generic examples only. Application workflows, fixtures and business expectations stay in your own consumer project. See [runtime boundaries](docs/feasibility.md), [license texts](THIRD_PARTY_NOTICES.md) and [licensing questions](docs/licensing-questions.md).
