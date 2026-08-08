# Samsarix — local, review-first AI for VS Code

Samsarix is a small VS Code coding companion for developers who run [Ollama](https://ollama.com). It answers questions about code you explicitly attach and can propose one complete edit to the active file. Every write waits for your approval in a native VS Code diff.

This repository is independent: it needs no Samsarix account, subscription, hosted API, marketplace, or companion repository.

> Release status: this is a verified release candidate. Public Marketplace publication still requires control of the `samsarix` publisher, brand/trademark clearance, and a human acceptance run with a chat-capable Ollama model. See [the productization record](docs/PRODUCTIZATION.md#owner-decisions-and-external-gates).

## What it does

- Streamed, cancellable Ollama chat with a visible endpoint and model.
- Memory-only multi-turn follow-ups with an explicit Clear chat action.
- Optional editor-selection context with filename, line range, and size shown before Send.
- One-click local explanation/review of a selection and diagnostics-aware repair.
- One-file edit proposals for the active workspace file.
- Native diff review, explicit Apply/Reject, stale-file protection, and session-scoped revert.
- No activation network request, telemetry, passive completion, shell execution, or account.

What it deliberately does not do: autonomous terminal/browser work, repository indexing, background context collection, multi-file agents, MCP, cloud inference, auth, subscriptions, or a marketplace.

## Prerequisites

- VS Code 1.85 or later.
- Ollama reachable from the VS Code extension host.
- At least one installed model, for example:

```bash
ollama pull qwen2.5-coder:7b
```

Samsarix runs as a workspace extension. In Remote Development, `127.0.0.1` refers to the remote extension host, so Ollama normally needs to run there.

## Install from a verified VSIX

From a clean checkout:

```bash
npm ci
npm run check
code --install-extension dist/samsarix-vscode-1.0.0.vsix
```

`npm run check` lints, type-checks, tests, packages, normalizes the archive for reproducible hashing, inspects every VSIX entry against an allowlist, and writes adjacent `.sha256` and `.contents.txt` evidence files.

## First run

1. Open the Samsarix activity-bar view or run **Samsarix: Open Local Chat**.
2. Choose **Configure**. Samsarix asks for the Ollama origin, fetches `/api/tags` only after that action, and lets you choose an installed model.
3. Choose **Test**. A failed connection explains which endpoint could not be reached; zero installed models gives the exact `ollama pull` next step.
4. Enter a question and choose **Send**.

The default endpoint is `http://127.0.0.1:11434`; the default model name is `qwen2.5-coder:7b`. Samsarix does not download or start models.

## Ask about selected code

1. Select the exact text in an editor.
2. Choose **Add editor selection** in the panel, use the editor context menu, or run **Samsarix: Add Editor Selection to Local Chat**.
3. Verify the displayed workspace-relative path, line range, and character count.
4. Enter a question and choose **Send**.

The attachment remains in memory until you clear it or the extension session ends. Samsarix sends no other file or workspace data.

For a faster review loop, use **Explain selection** or **Review selection** in the panel/editor context menu. These actions attach the visible selection and send a fixed, inspectable task prompt. Follow-up messages include up to the last 12 in-memory conversation turns; **Clear chat** removes them immediately.

## Repair active-file diagnostics

1. Open a saved file with Problems reported by VS Code or a language extension.
2. Choose **Repair diagnostics…** or run **Samsarix: Repair Active File Diagnostics…**.
3. Samsarix sends up to 25 diagnostic summaries plus the bounded active file to Ollama.
4. Review and explicitly apply or reject the native diff.

This action is on-demand. Samsarix does not watch, scan, or automatically repair Problems, and it never suppresses checks by default.

## Propose a one-file edit

1. Open a saved local file inside a trusted workspace.
2. Describe one change in the Samsarix prompt and choose **Propose edit**, or run **Samsarix: Propose Edit to Active File…**.
3. Review the native diff. The title shows the complete workspace-relative target path.
4. Choose **Apply** or **Reject** in the modal. Reject writes nothing.

Apply changes the editor buffer but does not save it. **Samsarix: Revert Last Applied Edit** restores the exact pre-edit buffer while VS Code remains open, unless the file has changed again. Git remains the durable rollback mechanism.

Samsarix refuses edits when the workspace is untrusted, the target is untitled/non-file/outside the workspace (including a symlink escape), the file is empty/binary/oversized, or the document changes during generation.

## Commands

| Command | Behavior |
| --- | --- |
| Samsarix: Open Local Chat | Opens the local assistant sidebar. |
| Samsarix: Configure Ollama | Tests a user-entered origin and selects an installed model. |
| Samsarix: Test Ollama Connection | Fetches `/api/tags` after the command is invoked. |
| Samsarix: Add Editor Selection to Local Chat | Attaches only the current selection. |
| Samsarix: Explain Editor Selection Locally | Attaches and explains the current selection. |
| Samsarix: Review Editor Selection Locally | Attaches and reviews the selection for prioritized issues. |
| Samsarix: Repair Active File Diagnostics… | Sends visible diagnostic summaries with the active file, then opens a reviewed diff. |
| Samsarix: Propose Edit to Active File… | Generates one whole-file proposal and opens a diff. |
| Samsarix: Revert Last Applied Edit | Restores the in-memory snapshot when it is still safe. |
| Samsarix: Show Data & Privacy Details | Opens this document. |

## Settings

All settings use machine/user scope; commands write global values. Workspace settings cannot silently redirect code.

| Setting | Default | Notes |
| --- | --- | --- |
| `samsarix.ollama.endpoint` | `http://127.0.0.1:11434` | Origin only; URLs with credentials, paths, queries, or fragments are rejected. |
| `samsarix.ollama.model` | `qwen2.5-coder:7b` | Must be installed in Ollama. |
| `samsarix.ollama.allowRemoteEndpoint` | `false` | Remote endpoints require this opt-in and HTTPS. |
| `samsarix.requestTimeoutSeconds` | `60` | Runtime-clamped to 5–120 seconds. |
| `samsarix.maxContextCharacters` | `60000` | Runtime-clamped to 1,000–100,000 characters. |

## Data, privacy, and cost

Samsarix has no telemetry and no Samsarix-operated backend.

- **Configure/Test** sends only `GET /api/tags` to the displayed endpoint.
- **Send** streams the prompt, displayed selection (if attached), and up to 12 prior in-memory turns through `/api/chat`.
- **Repair diagnostics** additionally sends up to 25 VS Code diagnostic summaries for the active file.
- **Propose edit** sends the instruction, active file’s relative path/language, and bounded complete content to `/api/chat`.
- Chat, attachment, and the last edit snapshot are memory-only. Settings persist through VS Code.
- Prompt/source/model output is not logged.

Loopback Ollama traffic remains on the extension host. If you enable a remote endpoint, prompts and explicitly shared code cross the network to infrastructure you control; Samsarix does not implement authentication in this release. Remote use needs its own transport and access controls.

Ollama inference has no Samsarix token fee, but it uses your compute, memory, power, and time. Samsarix shows generation duration and does not retry automatically.

See [Privacy](docs/PRIVACY.md), [Architecture](docs/ARCHITECTURE.md), and [Security policy](SECURITY.md).

## Development and verification

Use a supported Node.js LTS release (CI uses Node 20):

```bash
npm ci
npm run lint
npm run typecheck
npm test -- --runInBand
npm run package
npm run inspect:package
npm run audit:prod
```

The current source tree contains only the release runtime and its focused tests. The abandoned hosted-platform, agent, MCP, browser, terminal, and mock-dashboard implementations were removed after productization and remain recoverable from Git history. The compiler and VSIX inspector still enforce explicit allowlists. See [Productization](docs/PRODUCTIZATION.md), [Testing](docs/TESTING.md), and [Releasing](docs/RELEASING.md).

## Troubleshooting

- **Cannot reach Ollama**: run `ollama serve`, verify the displayed origin, and choose Test. In SSH/Containers/Codespaces, remember the extension runs remotely.
- **Model returns HTTP 404**: run `ollama list`, then Configure and select an installed model.
- **No models installed**: run `ollama pull qwen2.5-coder:7b` (or another model), then Configure again.
- **Context/edit button disabled**: grant Workspace Trust and open/select a regular workspace file.
- **Edit is stale**: the buffer changed during generation. Review those changes and request a new proposal.
- **Remote endpoint rejected**: use HTTPS and enable `samsarix.ollama.allowRemoteEndpoint` in User Settings only after reviewing the disclosure above.

## License

Samsarix is open-source software under the [Mozilla Public License 2.0](LICENSE). Distributed modifications to Samsarix-covered files remain available under MPL-2.0, while separate files in a larger work may use other terms. See [Licensing](LICENSING.md), [Attribution](NOTICE), and [Trademarks](TRADEMARKS.md).

Copyright © 2024–2026 Samsarix LLC and contributors. General inquiries: [contact@samsarix.com](mailto:contact@samsarix.com). Support and private security reports: [support@samsarix.com](mailto:support@samsarix.com).
