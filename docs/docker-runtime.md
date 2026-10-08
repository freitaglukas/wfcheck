# Managed Docker runtime

Candidate pins are recorded in `src/adapters/docker/images.json`. The n8n 2.42.4 arm64 image has now been qualified locally with fresh owned volumes, documented CLI export/import, authenticated public API discovery and a saved real Webhook execution. The matching runner, gateway traffic, reviewed crypto Code, a blocked native HTTP request, and direct IPv4/IPv6/DNS/host-service containment have also passed actual runtime tests on arm64. AMD64 pins remain available but unqualified on this machine. Normal `npm test` never starts Docker; `npm run test:integration -- tests/e2e/bootstrap.test.ts` explicitly does.

Bootstrap starts a fresh private instance, exports its default entities with a disposable encryption key, and constructs a version-checked archive containing only migrations, owner, personal project/relation, owner-setup setting and disposable API key. It imports through `n8n import:entities`, with migration validation enabled. It never opens SQLite directly or uses private editor routes. Deployment keys are deliberately excluded because n8n prohibits truncating them. Seed files/keys remain inside the owned disposable volume. A generated legacy-format API key is used only in that isolated instance; the pinned version's supported compatibility authentication is tested rather than assumed.

Docker internal-only networks do not publish container ports on the tested daemon. Bootstrap qualification therefore calls the actual localhost HTTP API/trigger through a bounded stdio Docker exec transport. Managed runtime ingress will be a fixed destination gateway TCP bridge, published only on a dynamic loopback port, retaining the internal network for n8n and its runner. It is never a general proxy.

The pinned image advertises no public stop-execution endpoint. Cloud retains its stricter existing requirement. A managed instance reports this limitation and may stop its owned runtime when a case cannot finish; it does not substitute private endpoints.

Catalog metadata is read from the pinned image's packaged node descriptions and hashed. Catalog presence grants no execution permissions: the qualified capability registry and explicit suite bindings still decide execution.

On failure, exact resource intents remain in the private journal. Recover with `wfcheck cleanup <journal>`. Daemon identity, names and run labels must match. Pulled pinned images remain as reusable caches; no image pruning is performed.

Use `wfcheck doctor --runtime docker` without a Cloud key or tunnel. Run a reviewed legacy suite with `wfcheck run examples/suites/correct.yaml --runtime docker`. Startup precedes case deadlines. Each managed startup checks direct egress from n8n and its runner; failure prevents a ready runtime. The gateway is the only container with an uplink, and exposes a fixed n8n TCP ingress on a dynamic loopback port plus authenticated internal mock routes. Control/capture stays on stdio IPC.

The n8n server uses a read-only root, its owned state volume and bounded `/tmp` and `/home/node/.cache` tmpfs. The cache is required by the pinned image’s static-asset generation. The bootstrap key has an explicit runtime-only API scope list validated against that image’s API permissions, independent of migration-time scope rows.

`--keep-runtime-on-failure` deliberately retains an execution’s exact Docker resources and private environment files for operator recovery. A subsequent finalizer does not erase retained resources. Recover via the printed journal; bootstrap failures still attempt safe cleanup. Gateway images and official pulled images remain local caches. No prune or unrelated cleanup occurs.

The documented server CLI used here: [n8n CLI commands](https://docs.n8n.io/hosting/cli-commands/). Internal-network publication behavior: [Docker port publication](https://docs.docker.com/engine/network/port-publishing/).

Normalized version 2 suites now support one byte-sniffed PNG/JPEG/WebP/PDF file through Form 2.2, or a JSON Webhook. Native PDF extraction and reviewed JavaScript Code are supported. Form authentication uses a disposable Basic credential; actual multipart transport uses its field index. Form 2.2 custom paths are under `options.path`. Saved binary filename markers identify the exact execution; timeout does not resend the upload. Reports retain binary length/hash instead of binary or data URLs. Original source and fixture hashes precede any copy changes.

The version 1 restrictive profile remains 20 nodes; version 2 accepts up to 200 qualified nodes. Literal external HTTP destinations require explicit bindings; source credentials are removed. Table/schema assertion execution remains gated until its evaluator and adapter qualification. Unsupported features exit 2 before startup.

Live checks: authenticated Form upload matched the original file hash; a native Extract From File node read an original synthetic PDF; normalized legacy execution passed; an independently changed expectation produced exit 1 while n8n itself succeeded. All ephemeral IDs were journaled and cleaned. Fresh evidence is in the execution-plan workspace until final acceptance documentation collects it.
