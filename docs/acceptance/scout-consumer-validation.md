# External workflow validation — 8 October 2026

The private `n8n-workflows` consumer ran its unchanged receipt and four Scout
exports against real managed n8n/runner 2.42.4 on macOS ARM64 Docker. Application
fixtures, source generators and authored suites remain in that consumer repository.
No Cloud account credential, mailbox content or actual email delivery was used.

Native acceptance at `ceb918215b2ebc5a44f115957106787bc8ca52b9`:

- Process: the 17-opportunity batch and replay/manual-status/enterprise-fit phases
  passed. Replay created zero duplicates. Two more projects yielded 19 rows;
  primary enterprise fit scored 98 versus secondary automation 88. A separate
  deliberate wrong expiry oracle failed, exit 1, despite n8n success.
- Email/RSS collectors: supplied events and native processing children passed.
  Mock Gmail list/full MIME bodies decoded into three projects; replay retained
  three rows. Valid RSS HTTP content type/XML ingested a project. HTTP 503 recorded
  visible source failure without creating opportunities.
- Digest: preview, confirmed and uncertain send decisions passed with their replay
  phases. Exact fake recipient/subject/reviewed text were checked. Replay made
  zero additional delivery requests; UNKNOWN was held for manual recovery.
- Receipt: all ten native cases passed, including the expected saved write error.

There were 19 passing cases and one deliberate failed oracle, with 34 observed
n8n executions including native children/replays. All 19 private ownership
journals were cleaned and no test containers remained. Reports retain run,
workflow, saved execution, source, fixture, catalog and runtime identities.

Subsequent independent review repaired planning readiness for steps, child
sources/entries and the conservative execution ceiling, plus boolean disabled
flags and the 256 KiB UTF-8 Code limit. All consumer suites passed fresh preflight.
The latest source passed 199 offline CLI tests and TypeScript build; the consumer
passed 92 tests and its checks. Installed-package smoke passed and production
npm audit found zero vulnerabilities. The focused review had no remaining findings.

Actual installed qwen3.5:9b local planning returned four schema-validated inferred
suggestions for each of five exports. The unchanged 5,000-byte projection ceiling
now accommodates complete node/edge inventories for these workflows by dictionary
indices, including full source/Code hashes and explicit omitted counts. Thinking
is disabled only when actual Ollama discovery advertises support. No full bundled
Code body or private content was submitted. Inferred suggestions remain drafts;
operator-authored fixtures, effects/bindings and business oracles govern execution.

Qualification remains bounded: native Gmail send is substituted at a pinned mock
boundary; these tests do not prove Gmail OAuth, real alert templates, real source
availability or actual client/project suitability. Native children are managed
Docker only, one level, with shared declared owned tables and disabled external
intakes. Child outbound/model transports remain rejected. Full Docker CI status
is recorded separately on the existing PR at its final head; this local evidence
must not be presented as a passing CI result.
