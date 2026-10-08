# Generic workflow testing repository

This repository owns a reusable n8n export analyzer, test planner and runtime.
Application projects are external consumers of the tool.

- Keep application workflow exports, alert/API mock payloads, business fixtures,
  schemas, expected business results, deployment code and project validation
  reports in the consumer repository. Project planning and operator records also
  belong there, including private environment paths, instance URLs and resource IDs.
- Tests here use small synthetic graphs and protocol doubles to exercise generic
  capabilities. Name them after the adapter or behavior they test. Do not import
  consumer repositories or copy an application's full pipeline into a test.
- Runtime adapters select behavior by n8n node type, version, operation and trusted
  suite configuration. Do not select by application name, business field, node
  label or known consumer workflow ID.
- Public documentation explains reusable interfaces, supported operations,
  reproduction commands and limitations. Record generic CI/runtime qualification;
  keep consumer case studies and raw operator evidence outside this repository.
- Use Node 24. Run npm test, npm run build and the installed-package smoke check
  for changes. Run the appropriate real Docker checks for runtime behavior changes.
  Verify that npm pack includes only generic source, documentation and examples.
- Preserve source exports and independently authored expectations. Record all
  permitted test-copy transformations and exact resource ownership. Use the
  documented n8n public API and existing qualified runtime boundaries.
