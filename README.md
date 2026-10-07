# wfcheck — local n8n regression CLI (alpha)

Execute Git-tracked synthetic workflows against a real n8n Cloud runtime, capture actual outbound HTTP requests and saved intermediate outputs, and fail on semantic regressions even when n8n reports success. `wfcheck` is a working command name; package-name availability is not claimed.

One TypeScript package. Apache-2.0 original code. No telemetry, account registration, database, frontend or default report uploads. The n8n runtime is not included.

## Setup

Use Node **24 LTS** (the supported/tested major) and npm. From this repository:

```sh
npm ci
npm test
npm run build
cp .env.example .env
chmod 600 .env
# Edit .env locally. Never put the API key in a command or a report.
node dist/cli/main.js --help
```

Set `N8N_BASE_URL` to an HTTPS instance origin, and `N8N_API_KEY` to a local API key with workflow create/read/list/publish/unpublish/delete and execution list/read/stop/delete capabilities. Authenticated `/api/v1/discover` must advertise the required public API operations. n8n's API permissions may be broad; use a development instance. No account settings are changed.

For a new project after installing the locally packed package:

```sh
wfcheck init my-workflow-tests
cd my-workflow-tests
cp .env.example .env
chmod 600 .env
# Edit .env, then select a tunnel below.
```

## HTTPS gateway

The gateway listens on loopback and exposes **only test traffic and a token-authenticated reachability probe**. It has no HTTP control or inspection API. Captures remain in the CLI process. It never forwards to an upstream service.

Automatic temporary Cloudflare tunnel (install `cloudflared` separately):

```sh
wfcheck doctor
wfcheck run examples/suites/correct.yaml --json artifacts/correct.json --junit artifacts/correct.xml
```

The automatic tunnel is stopped on completion/interruption. A fresh hostname can fail DNS resolution in either the controller or Cloud runtime. Doctor proves an authenticated HTTPS request from the local controller; it cannot prove Cloud-origin reachability without an execution. Cloudflare transport was reachable here using a scoped DNS resolver, but fresh hostnames failed resolution inside n8n Cloud. **The successful Cloud demonstrations used an external Localtunnel connection.** No paid infrastructure or DNS/account settings were changed.

Reproduce with a temporary external tunnel in another terminal:

```sh
npx --yes localtunnel@2.0.2 --port 43199 --local-host 127.0.0.1
# Use the printed HTTPS URL, then in the CLI terminal:
export WFCHECK_GATEWAY_PORT=43199
export WFCHECK_GATEWAY_URL=https://THE-PRINTED-HOST.loca.lt
wfcheck doctor --tunnel external
wfcheck run examples/suites/demo.yaml --tunnel external --json artifacts/demo.json --junit artifacts/demo.xml
# Stop Localtunnel with Ctrl-C after testing.
```

External tunnels are user-managed: `wfcheck` closes its loopback server but does not stop the externally started process. Tunnel providers carry synthetic traffic and short-lived gateway tokens, so they are part of the trusted transport boundary. An HTTPS probe that returns an interstitial, wrong body, redirect or status fails setup before any workflow import.

Optional `WFCHECK_GATEWAY_DNS_SERVER=1.1.1.1` chooses an isolated resolver for the controller's gateway probe only. It neither changes host DNS nor affects n8n Cloud's resolver. TLS verification stays enabled.

## Demonstrations and exit codes

```sh
wfcheck run examples/suites/correct.yaml --tunnel external  # exit 0
wfcheck run examples/suites/broken.yaml --tunnel external   # exit 1 despite n8n success
wfcheck run examples/suites/demo.yaml --tunnel external     # one pass + one deliberate failure, exit 1
wfcheck run examples/suites/acceptance.yaml --tunnel external # includes deliberately wrong filter, exit 1
```

The correct export maps `body.email`; the broken export maps `body.name`. Both can complete successfully in n8n, but downstream request and intermediate-value assertions detect the wrong email. Source JSON stays unchanged. Every copy gets a new exact resource ID, unique webhook path, gateway namespace and token. Reports record source/fixture SHA-256 and test-only transformations.

- **0**: every assertion passes with required evidence and cleanup.
- **1**: observed regression assertion failure, with no harness error.
- **2**: invalid configuration, unsupported workflow, missing evidence, infrastructure failure, interruption or cleanup failure. Errors take precedence over failures.

Expected n8n errors are declared with `execution.status: error`; they pass only when the required actual observations also match. A trigger/probe/API failure never becomes an expected workflow failure. Empty suites, unsupported tests and unexecuted cases cannot pass.

Executions are **serial**, with a hard maximum of **20 per invocation**, printed before starting. `--max-executions 5` lowers the limit. Webhook triggers are never retried; HTTP-node retries are bounded and occur within one n8n execution. Polling is bounded to 120 iterations and the test deadline. Publication waits three seconds for observed asynchronous Cloud registration, then triggers once; slower registration remains an explicit infrastructure failure.

## Authoring and observations

See [version 1 schema](docs/test-schema-v1.md), its [JSON Schema](docs/suite-schema-v1.json), and the [support matrix](docs/support-matrix.md). Workflow expressions are restricted to simple `$json.field` references; arbitrary Code nodes and executable suite hooks are rejected.

HTTP Request nodes must use the literal `{{WFCHECK_GATEWAY}}/path` placeholder. Only the disposable transport configuration is rewritten. n8n credential objects must be absent/empty; examples use fake literal header values. The allowlist validates versions, parameter shapes, graph structure and supported operations before any Cloud mutation.

Mocks support method/path/selected headers/body-field matching, JSON/text/malformed JSON, controlled status, bounded delay and ordered responses. Sequence exhaustion and other unexpected requests fail automatically. Missing observations never count as matching values; missing and JSON null differ. Requests are suite-level observations, with no invented HTTP-to-node attribution. Node assertions use stable IDs, run/output/item indices and JSON Pointers; branch runs are not collapsed.

## Ownership and recovery

Private `.wfcheck/manifest-<run>.json` journals contain exact workflow and execution IDs. Cleanup stops running owned executions, deletes their observations in n8n, unpublishes and deletes the exact owned workflow. Cleanup never searches by prefix. API conflicts get bounded exact-ID deletion retries. Already-absent IDs can be reconciled after a crash.

```sh
wfcheck cleanup .wfcheck/manifest-THE-RUN-ID.json
```

Failures print exact leftover IDs and this recovery command. If a create response is lost, an intent with the exact unique name remains. Inspect that name in n8n and record its confirmed ID/state in the private manifest before recovery; the tool never guesses or deletes by prefix. A stale `.wfcheck/run.lock` is only removable after verifying no active wfcheck process remains. `SIGINT`/`SIGTERM` invoke cleanup; abrupt process death, power loss or unavailable Cloud APIs require manifest recovery.

## Packaging and contribution

```sh
npm test
npm run build
npm pack
# Install the returned .tgz into a clean directory/prefix; no publication occurs.
```

All examples are original and synthetic. Runtime dependency license texts are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). See [SECURITY.md](SECURITY.md), [observed feasibility evidence](docs/feasibility.md), and [commercial licensing questions](docs/licensing-questions.md). No native integration interception, full runtime fidelity or network containment is claimed.
