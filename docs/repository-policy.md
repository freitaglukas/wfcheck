# Repository safeguards

`main` requires a pull request, resolved review conversations and these checks
from GitHub Actions on an up-to-date branch:

- `verify`: Node 24 install/build, offline unit tests, production dependency
  audit and a clean installed-package smoke test.
- `docker-e2e`: opt-in real Docker tests on a standard Ubuntu ARM runner, using
  the digest-pinned n8n and matching runner from this package.

The rules apply to administrators. Force pushes and branch deletion are
disabled. Only squash merges are enabled; merged feature branches are deleted
automatically. Secret scanning and secret push protection are enabled.

There is currently one repository collaborator. Pull requests are mandatory,
but an independent approving review is not a GitHub merge requirement yet
(approval count zero). Add that requirement when an independent reviewer has
repository access. A passing check does not replace review of the behavior,
security boundaries and independently authored expectations.

CI has read-only repository permissions, uses commit-pinned official actions
and does not persist checkout credentials. It receives no Cloud API key or
model credentials. Cloud and local-model qualification remain explicit local
runs; Docker CI uses deterministic mocks. No automatic publication or deploy
job is configured.

Application workflow projects and their history belong in the private
`freitaglukas/n8n-workflows` repository. This public CLI contains generic
runtime code and original synthetic examples only.
