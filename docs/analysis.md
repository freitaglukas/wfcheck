# Offline workflow inspection

Use Node 24 and run wfcheck inspect workflow.json --json artifacts/inspection.json. Inspection requires no API key, tunnel, Docker or model. It inventories all nodes and typed connections, reports unsupported/malformed constructs together, and hashes source and Code without evaluating it.

Public reports omit source Code, names, arbitrary parameters, credential references/values and account metadata. Runtime projection is a separate operation and rejects pinned/static state and unknown runtime fields. Supported inventory is not a claim of business correctness or arbitrary native-node execution.

Optional local assistance: `wfcheck plan workflow.json --out tests.draft.yaml --assist local --model qwen2.5:0.5b`. Without --assist, planning performs zero inference. The assistant sees a bounded inventory/requirements projection, never sharing/history metadata or Code by default. --include-code is explicit hash/redaction review; do not use it on sensitive or secret-bearing code. Projection hashes and model digest provenance are recorded.

Only fixture/assertion/intent/unresolved suggestions are accepted. Bindings, credentials, runtime endpoints, source changes and effect grants are absent from the proposal schema. Inferred suggestions never replace authored expectations or clear deterministic blockers. Invalid/truncated output preserves the deterministic draft with a visible assistance error and exit 2. Ordinary reviewed suites run without invoking the assistant.
