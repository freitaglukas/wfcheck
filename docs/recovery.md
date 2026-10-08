# Exact resource recovery

New runtimes write a private schema-version 2 resource journal before each create, then record the exact returned ID. Old version 1 manifests remain readable. Journals contain ownership metadata, never credential values. Do not edit their runtime identity to match another instance.

A create request with a lost response is never retried. Its `creating` intent remains visible. Identify that exact request/resource in the n8n UI or Docker daemon, confirm the exact ID/name and ownership, then record that ID in the private journal before cleanup. Never select resources by prefix, and never use Docker prune. A stale journal lock may be removed only after checking that its controller is gone.

Recovery attempts independent known resources even if one fails. It removes executions before workflows, then scoped credentials/tables; containers before their volume/network. A changed resource name or runtime identity prevents removal. Missing exact IDs are accepted as already absent. Credential APIs without a readable identity require explicit operator recovery rather than assuming a lookup failure means absence.

`wfcheck cleanup <manifest-or-journal>` reads the recorded runtime first. Legacy Cloud recovery requires the same instance's local API key. Docker recovery uses its recorded daemon identity, without a Cloud key. Unknown create intents and remaining IDs produce exit 2 and stay in the journal.

Docker recovery now reads its ephemeral key from the versioned encrypted seed inside the exact owned n8n container, then recovers recorded API resources before the containers/volume/network. No Cloud key is read. Credential identity can be checked through documented server credential export in the owned instance; values are not printed. Execution intents are recorded before submission. Definite authentication/registration rejection may be recorded as not created; a lost response remains uncertain until exact correlation supplies its ID.
