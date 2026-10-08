# Generic workflow testing acceptance — 8 October 2026

The approved implementation extends wfcheck as a workflow-agnostic analyzer, deterministic planner and real isolated n8n test runner. Application behavior and expected values remain in an external project. There is no Grid integration, approval ledger, OCR implementation or receipt normalization in CLI runtime code. The original Grid-heavy proposal was replaced by the owner's later standalone-workflow and generic-CLI direction.

## Verified vertical slices

- Offline inventory retains complete supported/unknown node graphs, AI edges, dependencies and provenance without executing exports or exposing Code/body/credential contents by default. Planner drafts remain blocked until independent fixtures, effect review, bindings and oracles are supplied. Local assistance can propose data, not authority.
- Actual n8n 2.42.4 boots unattended in an owned empty volume through documented entity export/import commands. Matching external runner executes reviewed Code, native file/PDF nodes and HTTP requests. Startup probes prove n8n/runner cannot reach public IPv4/IPv6, external DNS or host models. Only the gateway has a trusted uplink. No Cloud credentials or tunnel are needed for Docker.
- A clean temporary consumer installed npm-pack output and used help/init/inspect/plan/run/cleanup. Its independently authored order-reference expectation reached the actual HTTP request. An unfamiliar custom node retained full inventory and exited 2 with zero execution. A changed source pin also exited 2 before mutation. An unrelated running sentinel container survived exact-ID cleanup and was removed separately by its exact recorded ID.
- The unchanged external receipt export passed all ten authored cases on actual Docker and actual authorized Cloud runtimes: native PDF fast path, synthetic OCR/field mocks, review draft rows, unreadable amount staying null, seeded duplicate/human correction preservation, different date, instruction-like text, malformed fields, provider failure and exact-owned missing-table fault. Assertions read actual native table rows before cleanup. A repeat passed those ten cases and rejected a deliberately wrong amount with exit 1 despite successful n8n execution. Expectations were not regenerated from output.
- Native Chat OpenAI/Basic LLM Chain uses authenticated deterministic gateway mocks. A physical qwen2.5:0.5b model produced the independent synthetic JSON expectation via a private local relay. The relay was stopped and confirmed unreachable before replay of the same approved recording. Replay passed with zero inference service access. Local assistant suggestions remained inferred and could not clear unsupported-runtime/oracle blockers.
- Recovery covers interrupted real bootstrap, partial-create/lost-response simulations, changed identities, paginated credential identity checks, cleanup failures and exact resource preservation. A prior uncertain execution intent was reconciled only when its journaled backing state volume was confirmed removed; no execution ID was invented.

These are alpha qualification results, not universal node support or production readiness. Actual receipt OCR/model accuracy remains the external project's separate earlier live evidence; this suite mocks those dependencies. Docker preserves the export's Cloud document URL and proves the identity components rather than an openable Cloud permalink. Development execution retention is not a durable receipt archive.

## Reproduction and evidence

Use Node 24.18.0 (repository engines require major 24), npm and the existing Linux Docker daemon. Commands run from the CLI worktree `/Users/friday/.codex/worktrees/receipt-draft/n8ntest`:

```sh
npm test
npm run build
npm run test:docker
npm run test:local-llm
npm run test:integration -- tests/e2e/docker.test.ts tests/e2e/native-chat.test.ts
npm pack --dry-run
git diff --check
```

Ordinary `npm test` is offline and excludes all opt-in runtime/model E2E tests. `test:docker` excludes local-model/assistant tests; `test:local-llm` requires existing native Ollama plus qwen2.5:0.5b. The broader `test:integration` configuration is also explicit opt-in. Optional `WFCHECK_E2E_EVIDENCE_DIR` captures private proof artifacts; tests do not depend on task scratch directories. Fresh gates: 147/147 unit tests, 11/11 Docker E2E tests across ten files (644.23 seconds), 3/3 local-model/assistant tests (72.52 seconds), 3/3 installed/provenance/native-mock checks, 31/31 consumer tests, build, package dry-run and diff checks passed. No lint script exists. One initial installed-consumer test incorrectly expected inspect exit 0 for an unresolved external binding; that test was corrected to the documented configuration-needed exit 2 and rerun, without changing its business oracle.

The [machine-readable acceptance record](generic-workflow-testing.json) contains actual installed-consumer resource IDs, runtime/catalog/source/fixture hashes, model settings/request/response hashes, recording identity and observations. Source release/package publication is out of scope. All commits/tarballs stay local.

The external project at `/Users/friday/dev/n8n-workflows`, final evidence commit `259a21e`, contains executable suites and full synthetic receipt evidence in `receipt-intake/evidence/wfcheck-generic-acceptance-2026-10-08.json`. Source SHA-256: `31ea3aec844288aacd670bd38eb0efc89b0d03486abe1eaed5ae1f5c28d6b75b`; unchanged human-authored expected fixture SHA-256: `a707e8e495d1b445619b9e1d1b223112b13b2040e8c59c34b5b1d10088f6f140`.

## Runtime/model identity

macOS arm64, Docker daemon 29.5.3, n8n/runner 2.42.4, Node 24.18.0. Architecture-specific pins are in `src/adapters/docker/images.ts` and `docker/images.json`. Actual n8n catalog hash: `cb79cf8506c6da9ab7cf6413355cacb7abaa125ae26a8511bbfd0017e644daa8`.

- n8n arm64: `sha256:2e2e1cd958335d058d3a82354529b512eecada0d65729036eb45c39455ebd78f`
- runner arm64: `sha256:8da6ea7f99f217484fd1ab3aacbfb6b79d85af04425cc6e50c0766f8f65c00fe`
- gateway Node base arm64: `sha256:eef73a25205e27bd016ce672af71560ad6b681142ddf00ff63c7b3098eafcd4d`
- physical model: qwen2.5:0.5b, digest `a8b0c51577010a279d933d14c2a8ab4b268079d44c5c8830c0a93900f1827c67`, Ollama 0.35.1, temperature/seed 0, output 32, context 8192, timeout 60000 ms in the synthetic qualification.

Cloud runtime version is not exposed by the public APIs used; API metadata is not substituted for runtime identity. The local model service/physical artifacts were already installed. No hosted inference, model download, service rebinding or purchase was performed during this extension.

## Cloud transport and unchanged resources

Authenticated read-only discovery plus workflow/execution/credential/table lists preceded Cloud mutations. The key remained in the existing mode-600 `/Users/friday/dev/n8ntest/.env`, read locally without printing it. Copy the example `.env`, set `N8N_BASE_URL=https://yaumo.app.n8n.cloud/`, fill blank `N8N_API_KEY=` only in a local editor, and keep mode 600. Use trusted process environment or a private dotenv file; never put the key on a command line, in exports, suites, reports or documentation.

A temporary Localtunnel URL produced two HTTP 408/502 failures before any request reached the local gateway (Cloud executions 123–132, eight passes/two failures). That evidence is retained rather than hidden by retries. A fresh Cloudflare Quick Tunnel then passed an actual one-case transport probe (execution 133) and the complete unchanged suite (executions 134–143). Actual fresh URL was `https://analog-large-companies-cornwall.trycloudflare.com`; it is stopped and must not be reused. Cloudflare's earlier DNS failure remains historical evidence in feasibility. This is transport requalification, not a timeout increase, skipped assertion or rewritten fixture.

The before/after audit confirmed unchanged exact ID sets, unchanged retained workflow contents and unchanged seven-row table contents. Retained task resources: inactive workflow `MFS4hcpthuPvaIbX`, table `bR4orW1uV8GjoSUV`, Basic Form credential `eRdIaS4tTHrS4kHS`, hosted model header credential `SgVzRRga7oUlvbA8`. All new copies/credentials/tables/executions were journaled and removed by exact identity. No Grid resources/data or unrelated production resources were modified.

## Cleanup and remaining limits

Cloud/receipt test journals are clean. Temporary tunnels were explicitly stopped. Docker test containers/networks/volumes and disposable API resources are removed; shared pulled/generated image caches remain. The prior stale execution intent now records `owned-state-volume-removed`, backed by exact parent/volume/daemon proof. Cleanup never searches by prefix or performs global prune. Private original project manifests and synthetic retained data remain intentionally available.

Recover exact journaled IDs with `wfcheck cleanup .wfcheck/journal-THE-RUN-ID.json`. A lost create response with surviving state requires manual exact-ID identification; never blindly repeat creation or trigger. Bootstrap/version/schema or unsupported credential lookup failures remain explicit recovery errors. Other image versions, amd64 qualification, additional native integrations/operations/AI node versions and managed model provisioning are unqualified. A compatible local service requires an operator-authored identity/context enforcement manifest. No new credentials/accounts are needed for the verified Docker/mock path.

Highest-value follow-ups: qualify amd64/current image upgrades in CI; add generic native-integration/provider adapters with isolated dependencies; improve deterministic graph-to-scenario coverage while keeping user requirements/oracles authoritative. Run this suite as an external consumer rather than copying application business logic into the CLI.

## Final independent review and requalification

[One independent review](../reviews/2026-10-08-generic-runtime.md) found execution-policy, cancellation, recovery and model-control gaps. All substantive findings were fixed in one RED/GREEN pass; two advisory findings were regraded by effect and fixed too. Fresh final checks: 163/163 offline tests, build/pack/diff checks, 4/4 affected Docker E2E checks including real removed-server recovery, 3/3 local-model/record/replay/assistant checks, and unchanged external receipt suites: Docker ten passes plus deliberate wrong amount exit 1; Cloud 10/10 at executions 144–153. The retained Cloud resources/seven rows remained unchanged. Exact ownership journals are clean; the last temporary tunnel is stopped. No re-review or production-readiness claim is made.
