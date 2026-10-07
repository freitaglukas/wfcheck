# Security model

This alpha runs reviewed, synthetic workflows against a real development n8n Cloud instance. It is not a sandbox for hostile workflows or customer uploads.

## Gateway exposure

The local server binds to 127.0.0.1. Only test routes and a token-authenticated HTTPS reachability probe are exposed. There are no HTTP configuration, inspection or cleanup endpoints: these operations remain in process. Each test uses a fresh random 256-bit token, exact run/test namespace and bounded expiry (at most 180 seconds). Tokens are never reused between tests. Auth is checked before reading/capturing a body. Invalid namespace/token requests receive 401/404, not forwarding. Unknown authenticated requests and exhausted response sequences are recorded and fail assertions.

Incoming and response bodies are bounded at 64 KiB, 100 authenticated requests per case, 3,000 total gateway requests, 20 retained cases, 32 request headers and 10-second HTTP request timeouts. Delays are at most 5 seconds. Quota errors are retained once, not appended indefinitely. Cases remain sealed through the suite cutoff; in-flight authenticated request-body capture must drain within two seconds or evidence fails. Captures are destroyed when the gateway closes. Reports persist locally only when requested.

A public HTTPS tunnel is required for Cloud. The tunnel provider can observe synthetic traffic and its run token; trust the selected provider. Use only fake credentials and synthetic fixtures. TLS certificate verification stays enabled. An optional isolated DNS resolver applies only to local gateway probes. No host trust-store, system DNS or global TLS changes are performed. External tunnel processes must be stopped by their owner. Automatic cloudflared processes are terminated by the CLI.

## Cloud isolation limits

**The gateway is not a network firewall around n8n Cloud.** It cannot contain arbitrary outbound traffic, protect unrelated Cloud resources from an account administrator, or transparently intercept native integration nodes. The adapter validates project-owned copies before import: a narrow node/version/operation allowlist, one POST Webhook, acyclic reachable graph, no pinned data/credentials/Code nodes, only simple field-reference expressions and literal gateway-placeholder HTTP destinations. HTTP redirects, custom proxy options, TLS weakening, schedules, sub-workflows, file/shell/database/email/community/native integration nodes are rejected.

This protects the supported path against accidental real destinations. It does not establish instance-wide egress containment. Other users can modify published workflows on a shared instance; dedicate the development instance and avoid concurrent manual edits. The webhook has a fresh unguessable capability path; knowing it permits starting that temporary workflow. No webhook production credential is created. Publication is brief, and copies/owned executions are removed after each case.

Exact resource IDs are journaled in private local manifests. Cleanup never deletes by name prefix and verifies recorded names and execution workflow IDs. Manifests are trusted local ownership records, not signatures against a malicious local administrator. SIGINT/SIGTERM attempt cleanup; SIGKILL, network loss and power failure require exact-ID recovery. Uncertain creates are reported as explicit pending intents and require manual ID confirmation, not guessed deletion.

## Secrets and data

The n8n API key is used only by the local controller in X-N8N-API-KEY, not placed into workflow copies or gateway traffic. Keys and full/partial test tokens are scrubbed from reports. Nested password/secret/token/API-key/authorization/cookie/credential fields, scalar assertions targeting these fields, parsed JSON embedded in raw body strings, identifying proxy IP headers and non-.test email addresses are redacted. Supply `redactValues` for additional sensitive literals. Redaction is not universal discovery of secrets; use synthetic data, inspect reports before sharing, and never rely on it to sanitize arbitrary customer exports.

.env, .wfcheck and artifacts are Git-ignored; private state/report files use mode 600 and directories use mode 700 where applicable. No analytics, default uploads or third-party report submission. Paid Cloud executions are serial and bounded at 20 per CLI invocation; no unattended loops or schedules.

To report a vulnerability before a public maintainer channel exists, contact the repository owner privately. Never include real credentials or unredacted execution data in public issues.
