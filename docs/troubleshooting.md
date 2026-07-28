# Troubleshooting

## Connection

- Start Ollama with `ollama serve`, then run **Samsarix: Test Ollama Connection**.
- The default origin is `http://127.0.0.1:11434`. Samsarix accepts only an origin—no credentials, path, query, or fragment.
- In Remote Development, Samsarix runs on the workspace extension host. Loopback therefore refers to the SSH host/container/Codespace, not necessarily your desktop.
- If the selected model returns 404, run `ollama list`, then **Samsarix: Configure Ollama**.
- If no models are listed, run `ollama pull qwen2.5-coder:7b` or choose another model appropriate for your hardware.

## Context and edits

- Workspace Trust is required before Samsarix reads a selection or active file.
- Context requires a non-empty editor selection inside an open workspace.
- Edits require a saved, non-empty, text `file:` document no larger than 200,000 characters.
- Symlinks resolving outside the workspace are rejected.
- If a document changes while Ollama is generating, Samsarix rejects the stale proposal. Request a new proposal against the current buffer.
- Revert is session-scoped and works only if the applied content has not changed again.

## Remote endpoints

Non-loopback endpoints require HTTPS and the `samsarix.ollama.allowRemoteEndpoint` User Setting. Samsarix does not add authentication. Use remote mode only behind access controls you operate and after reviewing [Privacy](PRIVACY.md).

## Diagnostics to include in an issue

Include the Samsarix version, VS Code version, local/remote extension-host type, OS, endpoint origin with credentials removed, model name, exact error text, and reproducible steps. Do not attach prompts, source code, model output, tokens, or private URLs.

Send private support or security details to [support@samsarix.com](mailto:support@samsarix.com). General product and partnership inquiries go to [contact@samsarix.com](mailto:contact@samsarix.com).
