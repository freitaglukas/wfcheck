# Validate the existing generic-runtime PR against the actual workflows

Scope approved in the testing request: repair the reproduced Docker migration race,
continue real Docker testing, and improve wfcheck where the unchanged Scout exports
expose missing coverage. Keep account credentials and retained Cloud resources out
of this test. Do not modify workflows to fit the harness.

1. Reproduce liveness-before-migration export, wait for documented database readiness,
   and prove bootstrap plus containment on the pinned ARM64 n8n/runner images.
2. Fix local planning's bounded structured-output call for installed models whose
   default thinking consumes the response budget. Keep schema validation and quotas.
3. Qualify the needed native Data Table 1.1 operations, bounded reviewed Code and
   expressions, and explicitly selected triggers with schedules disabled in test copies.
   Bind dynamic destinations/resources by their exact source strings; never evaluate
   a source URL or table expression to choose an external resource.
4. Exercise process/ranking/state and briefing in real Docker. Extend isolated
   subworkflow and outbound-email boundaries only with explicit pinned test bindings;
   distinguish native behavior from substituted delivery. Preserve independent oracles.
5. Run receipt regression and deliberate negative checks, Scout replay/manual-state/
   date/ranking/source-failure checks, local LLM plans, and exact-owned cleanup.
6. Store sanitized suites/evidence in n8n-workflows and generic fixes in wfcheck.
   Update existing PR #1 without creating a duplicate PR or merging it.
