# Support matrix — 7 October 2026

Only the named instance and tested subset below are verified. n8n runtime version is not exposed by the documented public API endpoints used here; no runtime version is invented. The retrieved public OpenAPI identifies its API specification version as 1.1.1. Current Cloud lifecycle includes publish/unpublish; activation/deactivation aliases are advertised too.

| Area | Implemented support | Verification |
| --- | --- | --- |
| Runtime adapter | n8n Cloud public API + POST production webhooks | Real yaumo.app.n8n.cloud executions, saved includeData and exact-ID cleanup |
| Webhook | n8n-nodes-base.webhook v2, POST, immediate response, one trigger | Real Cloud; 200 alone never means completed |
| Edit Fields/Set | n8n-nodes-base.set v3.4, manual string/number/boolean assignments, simple $json references | String mapping and handled-error assignment verified live; numeric/boolean fields not live verified |
| If | n8n-nodes-base.if v2.2, strict string/number/boolean condition allowlist, AND/OR | String notEmpty with true/false branches verified live; other operations unit/schema only |
| Filter | n8n-nodes-base.filter v2.2, same explicit condition grammar | String equals and dropped-item detection verified live |
| No Operation | n8n-nodes-base.noOp v1 | Rejected input branch verified live |
| HTTP Request | n8n-nodes-base.httpRequest v4.2; literal gateway URL; fake x-api-key/x-fake-* headers; JSON field body; redirects disabled; response JSON/text; onError stop/regular/error output; explicit bounded retries | POST JSON, fake header, 429 then success, 500 error output, timeout, malformed JSON and text verified live. Other methods/regular error continuation not live verified |
| Destinations | {{WFCHECK_GATEWAY}}/literal-path only | Copy validation and real captured requests; not transparent interception |
| Correlation | unique workflow plus marker in saved Webhook headers; exact ID detail confirmation | Real Cloud; never latest-execution selection |
| Intermediate evidence | each actual node run/output/item normalized under stable node ID | Real Cloud mapping, branch/filter, HTTP/error path |
| Missing evidence | strict failure if required saved data/terminal correlation is absent | Unit and actual Cloud saving-disabled capability probe; no fabricated intermediate results |
| Gateway | auth, method/path/header/body matching, status, ordered sequences, JSON/text/malformed, delay, quotas, sealed namespace/body-drain isolation | Real local HTTP tests; listed fault responses and capture verified from Cloud |
| Reporters | console, versioned JSON, JUnit failure/error distinction | Unit tests and live Cloud report artifacts |
| CLI | init, doctor, run, manifest cleanup | Source CLI verified; package evidence recorded in feasibility |
| Automatic Cloudflare tunnel | process lifecycle + authenticated local HTTPS probe | Tunnel/probe worked with isolated resolver; Cloud-origin hostname DNS failed. Full Cloud execution via this transport unverified |
| External Localtunnel | configure HTTPS origin + fixed loopback port | Actual Cloud traffic and repeat suites verified; user-managed tunnel lifecycle |
| TLS | standard HTTPS verification retained | Successful ordinary HTTPS; no interception or test CA |
| Cleanup | precise workflow/execution IDs, stop/delete, bounded 409 retry, already-absent recovery | Real Cloud cleanup/recovery plus unit tests; preservation/interrupt evidence in feasibility |
| Node 24 / package | one TypeScript package, npm lockfile, Apache-2.0 original code | Build/test/pack evidence in feasibility |
| Container runtime | future adapter interface only | Docker daemon 29.5.3 available, but no user-supplied pinned n8n image |
| Native integrations and unchanged destinations | unsupported | No native operation/interception proof; separate gate unverified |
| Instance-wide outbound containment | unsupported | Cloud gateway is not an egress firewall; no bypass/IPv4/IPv6 containment proof |
| Other workflow nodes/versions/operations | rejected | Unsupported tests exit 2 before mutation |

The initial failed transport/timeout/cleanup attempts are preserved in feasibility. Successful configurable-URL HTTP tests do not establish native-node support, unmodified-destination interception, containment or universal runtime fidelity.
