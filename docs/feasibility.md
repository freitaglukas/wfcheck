# Runtime boundaries

Offline `inspect` and `plan` accept exported n8n workflow JSON and require no
instance credentials. Inventory and execution support are separate: unknown nodes
remain visible in analysis, while execution needs a qualified type/version/
operation, validated parameters and trusted dependency bindings.

Managed Docker uses digest-pinned n8n and a matching external task runner. It
bootstraps a disposable owner/project/key through documented entity export/import,
waits for database readiness, imports test copies through the public API and
records saved native executions. Workloads receive isolated state and no host
Docker socket or arbitrary host mount. Startup probes establish the qualified
network containment boundary; the authenticated gateway serves configured mocks.

Cloud uses an operator-configured development instance and the documented public
API. A temporary HTTPS gateway is required. This adapter isolates owned copies
and resources, but cannot establish instance-wide network containment. Native
child execution is currently qualified only in managed Docker. Tunnel availability
and runtime/API capability mismatches are explicit errors.

Every trigger is submitted once and correlated with its saved execution. Missing
terminal observations are evidence errors. A successful n8n execution can still
fail an authored assertion. Reports preserve both the native result and any
regression/infrastructure/cleanup errors, including retained runtime state.

The runtime creates and cleans only exact journal-owned resources. Interruptions
and lost create responses preserve recovery intent. Cleanup does not prune Docker
globally or delete by a name prefix. Consumer application resources, fixtures,
expected values and business decisions stay outside the tool repository.

Use the [support matrix](support-matrix.md) for the current qualified subset,
[suite schema](test-schema-v2.md) for configuration,
[recovery guide](recovery.md) for exact cleanup and
[generic verification record](acceptance/generic-workflow-testing.md) for recorded
CI evidence and reproduction commands.
