# Generic runtime verification

wfcheck accepts an n8n export as its analysis input. Inspection inventories the
whole graph, including unsupported nodes, and planning produces a reviewable
suite. Execution uses qualified node adapters and explicit fixtures, dependency
bindings, effect review and assertions. Application logic, commercial rules,
deployment state and integration fixtures belong in the consumer project.

## Reproduce

From any clean checkout with Node 24:

```sh
npm ci
npm run build
npm test
node .github/scripts/package-smoke.mjs
npm run test:docker
```

The Docker suite requires a running Linux Docker daemon. It creates disposable
n8n and task-runner containers, isolated state and an authenticated mock gateway.
It does not require Cloud or model credentials. Local-model qualification is a
separate opt-in `npm run test:local-llm` using an already installed Ollama service
and the model named by those integration tests.

## Recorded CI evidence

[GitHub CI for commit 30134ee](https://github.com/freitaglukas/wfcheck/actions/runs/37793541536)
passed both required jobs:

- `verify`: 201 offline tests across 58 files, TypeScript build, production audit
  and a clean installed-package smoke test.
- `docker-e2e`: 13 real Docker integration tests across 12 files on Ubuntu ARM.

This record identifies a verified revision; subsequent changes have their own
CI checks. The [machine-readable record](generic-workflow-testing.json) contains
only tool/runtime/CI metadata. Consumer-specific reports and operator resources
are not shipped with the tool.

## What the generic integration tests establish

- Documented entity bootstrap, database readiness and the matching external
  Code runner on the digest-pinned n8n 2.42.4 runtime.
- Actual containment probes, scoped ownership journals and exact cleanup/recovery.
- Native webhook/Form/file/PDF/Code/table execution and saved intermediate outputs.
- Deterministic HTTP/model substitutions with observed outbound requests.
- Correct exit 1 when a deliberately wrong assertion fails despite n8n success.
- Retained Unicode request and assertion evidence when runtime cleanup fails or
  the operator explicitly retains the runtime.
- Installed-package init, inspection, planning and rejection of unresolved drafts.

Native observations are distinct from unit-test doubles. Known runtime and node
limits are in the [support matrix](../support-matrix.md). These tests qualify
specific adapter versions and operations; they do not certify arbitrary workflow
business behavior or every native integration.

## Consumer workflow testing

```sh
wfcheck inspect path/to/workflow.json --json artifacts/inventory.json
wfcheck plan path/to/workflow.json --requirements requirements.txt --out tests/draft.yaml
# Review fixtures, dependency bindings, effect permissions and expectations.
wfcheck run tests/behavior.yaml --runtime docker --json artifacts/result.json
```

Keep the generated suite and its fixtures in the consumer repository. The tool
reads the selected export and trusted suite configuration; no application profile,
private repository or hard-coded business mock is required. A reviewed baseline
can establish regression preservation, while independent requirements establish
expected behavior. Model suggestions do not approve either.

Each run reports its own source/fixture hashes, saved executions, actual requests,
resource observations and cleanup status. Raw captures and recovery journals are
private by default. Recover the exact owned resources with
`wfcheck cleanup .wfcheck/journal-THE-RUN-ID.json`.
