# Observed feasibility — 7 October 2026

Target: https://yaumo.app.n8n.cloud/. Original synthetic workflows and fake inline credentials only. No production/customer workflows or account settings were modified. The original handoff predates the current Cloud-first request; its local-container/native-interception gates remain separate.

## Environment and discovery

Observed: macOS arm64, Node v24.18.0, npm 12.0.2, Docker daemon 29.5.3. cloudflared 2026.9.3 was installed locally using `HOMEBREW_NO_AUTO_UPDATE=1 brew install cloudflared`. No service was registered or purchase made. Tailscale already existed; its unrelated local serving configuration was preserved. No user-supplied pinned n8n image was provided, so the local native-node/interception spike was not attempted.

The API key was supplied in a mode-600 local .env, never printed or passed on the command line. Safe GETs returned 200 for `/api/v1/workflows?limit=1`, `/api/v1/executions?limit=1`, `/api/v1/discover` and the discovery-advertised `/api/v1/openapi.yml`. Initial workflow/execution lists were empty. Discovery advertised workflow create/read/delete/publish/unpublish/activation aliases and execution list/read/delete/stop. Instance OpenAPI `info.version` was **1.1.1**; this is the API specification identity, **not** the n8n runtime version, which remains unknown through the used documented APIs.

Primary interface references consulted:

- [Authentication](https://docs.n8n.io/connect/n8n-api/authentication)
- [Workflow lifecycle](https://docs.n8n.io/connect/n8n-api/workflow)
- [Execution reads/includeData](https://docs.n8n.io/connect/n8n-api/executions)
- [Capability discovery](https://docs.n8n.io/connect/n8n-api/discover)
- [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook)
- [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest)
- [Workflow execution saving](https://docs.n8n.io/build/manage-workflows/configure-workflow-settings)
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [Localtunnel client](https://github.com/localtunnel/localtunnel)

No private editor APIs, browser automation, database reads or simulated runtime observations were used.

## Transport blockers and lifecycle observations

`cloudflared tunnel --url <loopback-url> --no-autoupdate --protocol http2` established a real temporary tunnel. The default local DNS resolvers returned ENOTFOUND for fresh generated hostnames, including a bounded 120-second propagation probe. An isolated resolver pointed at 1.1.1.1 resolved them and allowed the authenticated HTTPS probe. Real n8n execution **2** still failed with ENOTFOUND in the HTTP node, capturing zero gateway requests. This was an infrastructure/evidence failure, not a passing integration. That disposable workflow was cleaned.

Tailscale Funnel port 10000 reported the node lacked policy permission. The process was cancelled; no policy, account or DNS setting was changed. The original serving configuration stayed intact.

A temporary external tunnel succeeded:

```sh
npx --yes localtunnel@2.0.2 --port 43199 --local-host 127.0.0.1
# This session printed https://vast-items-bow.loca.lt (ephemeral; do not reuse after teardown).
export WFCHECK_GATEWAY_PORT=43199
export WFCHECK_GATEWAY_URL=https://vast-items-bow.loca.lt
node dist/cli/main.js doctor --tunnel external
```

Doctor returned authentication/discovery and an authenticated local-controller HTTPS probe as verified, with **0 Cloud executions**. Its output explicitly says this probe is not Cloud-origin proof.

Immediate post-publication triggering initially returned 404 and no execution. A one-execution lifecycle probe waited three seconds and observed genuine webhook execution **1** success; exact-ID cleanup succeeded. The adapter now publishes the created version ID, waits a bounded three-second settling interval and triggers only once. This settling interval is an observed workaround, not a guaranteed readiness signal; slower registration fails explicitly.

## First successful semantic regression proof

```sh
WFCHECK_GATEWAY_PORT=43199 WFCHECK_GATEWAY_URL=https://vast-items-bow.loca.lt \
  node dist/cli/main.js run examples/suites/demo.yaml --tunnel external \
  --json artifacts/demo.json --junit artifacts/demo.xml
```

Planned **2**, serial, no trigger retry. Actual result: **1 pass, 1 deliberate failure, 0 harness errors, exit 1**.

| Test | Execution ID | n8n terminal status | Actual gateway JSON | wfcheck |
| --- | --- | --- | --- | --- |
| Correct mapping | 3 | success | `{"email":"customer@example.test"}` | passed |
| Broken mapping | 4 | success | `{"email":"Wrong Mapped Name"}` | failed request.json and node.json |

Actual saved intermediate Map Contact output matched the corresponding request payload in both cases. The broken export maps `$json.body.name`; the correct export maps `$json.body.email`. No business logic was patched to make assertions pass. Only copy name/settings, webhook capability path and HTTP test transport/auth/redirect configuration changed, with hashes/transformations recorded in the JSON report.

Exact workflow IDs: correct `sI5T5t4rZLrMCJpg`, broken `M5RuisT81VhTnjts`. Both and their owned executions were deleted through recorded exact IDs. Source SHA-256 values: correct `0bd4f38d97ee99b265e89c5d4b52b013d7051e3a37cfbef5bab7561ed5d14fd3`; broken `988fed538c0e3cdf4361dadadad4319e04192b365ece7b828b245e0379345ac4`.

## Full Cloud acceptance run

```sh
WFCHECK_GATEWAY_PORT=43199 WFCHECK_GATEWAY_URL=https://vast-items-bow.loca.lt \
  node dist/cli/main.js run examples/suites/acceptance.yaml --tunnel external \
  --json artifacts/acceptance-final.json --junit artifacts/acceptance-final.xml
```

Planned **8**, serial. Actual result: **7 passed, 1 deliberate regression failure, 0 harness errors, exit 1**.

| Check | Execution | n8n | Actual observation / harness result |
| --- | --- | --- | --- |
| A correct | 15 | success | Exactly one correct POST /contacts; passed |
| B missing input | 16 | success | Zero outbound requests, rejection branch ran; passed |
| D broken filter | 17 | success | Actual Filter output count 0 vs expected 1; missing downstream request; failed |
| E retry | 18 | success | Actual response sequence 429 then 201; two captured requests; passed |
| F defined error path | 19 | success | Actual 500 request and Handle Error output `outcome: handled`; passed |
| G delayed response | 20 | error | Captured request, 4-second gateway delay vs 1.5-second node timeout; expected error passed |
| G malformed JSON | 21 | error | Captured request and invalid JSON response; expected error passed |
| Text response | 22 | success | Actual node output `/data: hello synthetic world`; passed |

Each test's workflow/execution cleanup was recorded as cleaned. Correlation used the unique run marker in actual saved Webhook headers and verified workflow ID/detail reads, never latest execution selection.

An earlier acceptance attempt used a 200ms timeout; it aborted before the gateway received a request, so request-count assertions correctly failed. The synthetic fixture was adjusted to distinguish deliberate gateway response delay from connection latency. A subsequent isolated delayed test (execution **12**) passed. An earlier malformed case received transport HTTP 408 and no capture; it failed its count assertion. Cleanup returned transient DELETE 409 for workflow `gdpmQejCAyqFpNWc`; `node dist/cli/main.js cleanup .wfcheck/manifest-d7d11ee8f1534a2fba7c027c410593cc.json` later removed that exact resource. The adapter now bounds retries for idempotent 409 deletion conflicts. Separate response-format verification (executions **13**, **14**) passed before the full final run. Earlier failed results remain local artifacts and are not reported as passes.

## Automated harness verification

`npm test` and `npm run build` verify strict schema, assertions, real local HTTP authentication/capture/sequences/isolation/quotas/malformed/delay, evidence normalization, unsupported/dynamic header/destination/credential/pinned-data rejection, raw/scalar secret redaction, JUnit escaping and exit semantics, interruption paths and exact-ID cleanup/recovery. The latest recorded pre-pack run passed **37 tests across 7 files**. Unit API/runtime stubs test controller behavior only and are not Cloud integration proof.

A bounded independent review identified and drove fixes for in-flight capture, late namespace audit, secret redaction, uncertain-delete recovery, dynamic header names, quota retention and reserved node IDs. Required saved evidence is verified in the successful Cloud runs; deliberate missing-evidence rejection is also verified against a project-owned Cloud copy with successful-execution saving disabled, as recorded below. Native integration operations, unchanged-destination interception and outbound firewall/bypass behavior are unsupported/unverified.

## Packaging, preservation and interruption

The initial tarball was installed with `npm install --prefix <clean-temp-directory> --ignore-scripts --omit=dev /Users/friday/dev/n8ntest/wfcheck-local-alpha-0.1.0.tgz`. Its executable reported version 0.1.0, `wfcheck init project` created runnable examples, and `wfcheck doctor --tunnel external` passed without executions. The installed CLI repeated the real demo with executions **23** (correct/pass/success) and **24** (wrong mapping/fail/success), exit 1, no harness errors. Each namespace held exactly one fresh request and a new run ID, proving no capture reuse. JSON/JUnit were written locally. An independently owned inactive sentinel `s50KZAQwv38PeapG` remained byte-for-byte unchanged across the run (name, active state, nodes and connections), then was cleaned by its own manifest.

`node scripts/interrupt-smoke.mjs` planned one test, waited for journaled workflow creation, then sent SIGINT during publication. The CLI returned 2, cleanup marked exact workflow **FhBM4pI5Ofs7prK7** cleaned and no executions were created. Unsupported-native example: `node dist/cli/main.js run examples/suites/unsupported.yaml --tunnel external --json artifacts/unsupported.json` printed planned count 0, rejected Gmail v2 as unsupported and exited 2 before Cloud mutation.

`node scripts/missing-evidence-smoke.mjs` planned one capability probe against exact workflow **4XwUTHfHHb7odd1w**. The API confirmed per-copy `saveDataSuccessExecution: none`; its real webhook was accepted. The adapter could not obtain saved correlated execution evidence and returned **EVIDENCE** (exit meaning 2) within a 3-second bound. No terminal success was fabricated or claimed. The workflow was cleaned. This deliberate per-copy setup probe did not alter account settings or source exports.

The final tarball is rebuilt after these documentation updates and smoke-tested again locally; final artifact metadata is recorded in artifacts/final-package-smoke.json. No GitHub/npm/release publication occurs.

## Final resource audit

A fresh authenticated GET of workflows/executions (limit 250) returned **0 workflows and 0 saved executions**, with no next page. Every project-root manifest entry is cleaned; package-run manifests were also verified cleaned by their installed-CLI reports. All created sentinels and capability probes are removed. Live source, package and negative probes used no unrelated workflows or account-setting writes.
