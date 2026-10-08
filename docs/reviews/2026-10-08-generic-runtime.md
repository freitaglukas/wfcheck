# Independent generic runtime review — 8 October 2026

One fresh-context read-only review used gpt-6-astra with max reasoning against `5eac506..1d6b1f4`. No reviewer subagents, live workloads or checkout mutations were used. The executing-plans workflow required one review and one verified fix pass, not repeated reviews. The initial verdict was **With fixes**: one Critical, six Important and two advisory Minor findings.

| Finding | Final grade / correction | Regression evidence |
| --- | --- | --- |
| Any property named jsCode bypassed expression checks | Critical: exempt only the reviewed Code implementation, inspect other fields normally | preparation/dependency tests reproduce nested environment expression; RED then GREEN |
| Recovery could overwrite newly added ownership from a stale snapshot | Important: lifecycle lock before loading/recovery plus optimistic exact disk snapshot check | cleanup-lock and stale journal tests; RED then GREEN |
| Cancellation did not reach import/create/seed operations | Important: case signals through credentials/tables/workflow, checks before later mutations, settle pending preparation accounting before runtime teardown | interrupted table/credential and pending response tests; RED then GREEN |
| Missing n8n server aborted independent recovery | Important: record API recovery limitation, continue exact independent Docker cleanup, reconcile removed owned state | fake-engine RED/GREEN plus real removed-server E2E |
| Invalid container listing and truncated network IDs could misclassify absence | Important: resource-specific valid listings and full network IDs | fake existing-network/absent-container tests; RED then GREEN |
| Schema predicates could pass for missing items | Important: distinguish absent item/non-JSON capture from actual null and throw evidence error | permissive empty schema tests; RED then GREEN |
| Accepted stop/sampling/logprob controls were discarded | Important: reject unsupported non-default controls; suite generation-policy overrides remain explicit | gateway protocol test; RED then GREEN |
| Verification level disappeared from results | Regraded Important: lost confidence-level metadata affects saved evidence; retain in JSON/JUnit | runner and reporter tests; RED then GREEN |
| Model work used token grace expiry beyond case deadline | Regraded Important: resource/execution budget must end with the case; separate deadline and cancel on sealing before cleanup | delayed inference and seal tests; RED then GREEN |
| Reports could overwrite source/fixtures/journals/recordings | Additional author Important: preflight protected paths, allow replacement of existing reports only, preserve private modes | offline rejected-run source overwrite RED/GREEN; supplemental alias tests |

The two advisory Minor findings were regraded by their effect and fixed in the same pass. No deferred minors remain. All substantive regressions were reproduced before their implementation fix, and the entire offline suite/build and affected live paths were rerun. No re-review was performed or claimed.

The reviewer declined to assess consumer OCR accuracy, amd64/other image versions and managed Ollama provisioning. Those boundaries stand: synthetic dependency tests do not establish OCR accuracy; unqualified platforms need fresh acceptance; optional managed models need supplied artifacts/a qualified image. These are explicit limits rather than hidden qualification claims.

No push, merge, publication or release is authorized by this work. The feature branch and external consumer commits remain local.
