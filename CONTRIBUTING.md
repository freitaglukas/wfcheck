# Contributing

Use Node 24, npm ci, npm test and npm run build. Keep the CLI as one package with the existing internal modules. Add strict schema/allowlist support with focused tests before claiming additional nodes or operations. Unit stubs are for harness behavior, not integration evidence.

Live tests require an explicitly authorized development n8n instance, private local API key and approved HTTPS tunnel. Keep calls serial, print planned executions and retain the hard limit of 20 per invocation. Never point tests at real upstream services or customer data. Record exact commands, actual outputs, failures and cleanup in docs/feasibility.md; distinguish advertised, tested and unverified capabilities.

Use original examples and Apache-2.0-compatible contributions. Never bundle or copy n8n runtime internals. Do not publish repositories, packages or releases from a local testing task without the owner's explicit authorization.
