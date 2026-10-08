# CodeRabbit corrections for PR 1

CodeRabbit reviewed `fc88d0e6712ef48c20761965767ad96fd94b2e68` and posted five
issues: three major correctness issues and two minor documentation issues.
All five were verified against the implementation.

- Planning: offline inventory no longer uses the v1 workflow preflight to
  reject v2 features. Shared core parameter diagnostics remain intact.
  Candidate readiness requires private per-workflow source bytes matching the
  inspected hash and runs the actual v2 preparation rules. Regression cases
  cover literal HTTP bindings, native tables/chat, Form/PDF/reviewed Code,
  invalid parameters, missing source and source drift.
- Reports: completed observations and assertions survive explicit Docker
  retention or teardown errors. JSON preserves the real tests and adds
  `runtimeError` with exit 2; JUnit retains failures and includes an independent
  harness error. The CLI transfers ownership before closing so its finalizer
  does not close the retained session again.
- IPC: stdout uses stateful UTF-8 decoding, with incremental pending-frame
  byte accounting and the existing 8 MiB limit. Tests split German text, euro
  and emoji characters at every byte and exercise consumed/oversized frames.
- Documentation: runtime/model/recovery descriptions reflect implemented
  features and their qualified limits. The README describes the separate
  private consumer without an author-specific filesystem path.

The three bugs were reproduced with failing regressions before their fixes.
Initial local verification passed 174 offline tests, TypeScript build, installed
package smoke and production dependency audit (zero vulnerabilities).

A real pinned Docker n8n execution also verified report preservation: n8n
reported success, an independently specified wrong request expectation failed,
the actual Unicode request remained in JSON, explicit retention returned 2,
and exact journal-based recovery removed every owned resource. This is local
Docker evidence; no Cloud executions or model inference were used in this pass.
The checked-in opt-in test is `tests/e2e/retained-report.test.ts`.

A fresh CodeRabbit CLI delta review completed with one additional major issue:
candidate `test.workflow` could change while validation reused unrelated shared
source bytes. A failing regression reproduced this. Validation now looks up
the source resolved for each exact candidate path; absent/mismatched source
blocks readiness. The additional regression brings the offline suite to 175
tests. No paid review credits were enabled.

The follow-up CLI review and GitHub review through `98c5482` completed with
zero new findings. A subsequent Scout/replay commit (`ceb9182`) advanced the
PR while CI was running. The GitHub app rate-limited that change; a free
open-source CLI delta review completed across its 38 files with two minor
findings. Both were reproduced before fixing: malformed node entries could
throw during single-trigger graph reachability, and grouped assistant
requirements omitted the intended 25-unique-node limit. Inspection now keeps
malformed-node diagnostics without throwing, and each requirement kind caps
unique IDs at 25 and reports `omittedNodeIds`. Regression tests cover mixed
non-object entries, duplicate requirement IDs and independent kind groups.

Post-fix CI and any independent re-review are recorded on the PR against the
updated commit; the original CodeRabbit result is not represented as a
post-fix review.
