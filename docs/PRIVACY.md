# Data and privacy

Samsarix does not operate a service, create accounts, collect telemetry, or persist prompts/source/model responses.

## Per-action disclosure

| User action | Destination | Payload |
| --- | --- | --- |
| Configure or Test | Configured Ollama origin, `GET /api/tags` | No source code; normal HTTP request metadata only. |
| Send / Explain / Review | Configured Ollama origin, `POST /api/chat` | System instruction, typed or fixed task question, the one displayed selection if attached, and up to 12 prior in-memory conversation turns. |
| Repair diagnostics | Configured Ollama origin, `POST /api/chat` | Fixed repair instruction, up to 25 active-file diagnostic summaries, active file relative path/language, and bounded complete content. |
| Propose edit | Configured Ollama origin, `POST /api/chat` | System instruction, typed edit instruction, active file relative path/language, and bounded complete active-file content. |
| Apply/Revert | VS Code extension host only | In-memory before/after buffers and one `WorkspaceEdit`; no network action. |

There is no passive typing request, workspace scan, repository index, hidden attachment, retry, cloud fallback, or request to a Samsarix-owned domain.

## Storage

- Endpoint/model/remote opt-in/limits are VS Code machine-user settings.
- Chat messages, the attached selection, and the last edit snapshot are extension memory only.
- Nothing is written to SecretStorage because this release does not request credentials.
- Prompt/source/model output is not written to logs.

Reloading VS Code clears the memory-only data. Applying an edit changes the editor buffer; saving and Git history follow normal VS Code behavior and are outside Samsarix retention.

## Local and remote meaning

Loopback is local to the VS Code extension host. For a normal desktop window that is the desktop. For SSH, Dev Containers, WSL, or Codespaces it is typically the remote environment.

Remote endpoints are disabled by default. Enabling them requires HTTPS and a User Setting opt-in. Samsarix does not implement authentication or certificate pinning, so operators are responsible for access control, transport, Ollama configuration, provider retention, and legal/privacy obligations.

## Cost and resource use

Samsarix charges no token fee and makes no paid API call. Ollama uses operator-controlled CPU/GPU, memory, storage, energy, and time. Models have their own licenses and resource requirements. Samsarix reports duration but cannot estimate energy or guarantee performance/accuracy.
