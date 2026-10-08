# Contributing

Use Node 24, npm ci, npm test and npm run build. Keep the CLI as one package with the existing internal modules. Add strict schema/allowlist support with focused tests before claiming additional nodes or operations. Unit stubs are for harness behavior, not integration evidence.

Changes go through a pull request. Both required CI checks must pass on an up-to-date branch: `verify` covers build, unit tests, dependency audit and installed-package onboarding; `docker-e2e` executes the pinned real n8n runtime with deterministic mocks. See [repository safeguards](docs/repository-policy.md). Local model tests are explicitly opt-in with `npm run test:local-llm` and require an existing qualified model service.

Live tests require an explicitly authorized development n8n instance, private local API key and approved HTTPS tunnel. Keep calls serial, print planned executions and retain the hard limit of 20 per invocation. Never point tests at real upstream services or customer data. Record exact commands, actual outputs, failures and cleanup in docs/feasibility.md; distinguish advertised, tested and unverified capabilities.

Use original examples and Apache-2.0-compatible contributions. Never bundle or copy n8n runtime internals. Do not publish repositories, packages or releases from a local testing task without the owner's explicit authorization.

Application workflows, business fixtures and project reports belong in consumer
repositories. Tool tests use minimal synthetic graphs and protocol doubles.
See [repository boundaries](AGENTS.md) before adding fixtures or documentation.
