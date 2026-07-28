# Helix — local, review-first AI for VS Code

Helix is a small VS Code coding companion for developers who run [Ollama](https://ollama.com). It answers questions about code you explicitly attach and can propose one complete edit to the active file. Every write waits for your approval in a native VS Code diff.

This repository is independent: it needs no Helix account, subscription, hosted API, marketplace, or companion repository.

> Release status: the implementation can be packaged locally, but public Marketplace publication remains blocked until an authorized owner confirms the license, publisher, repository, brand, and icon rights described in [the productization plan](docs/PRODUCTIZATION.md#owner-decisions-and-blockers).

## What it does

- Local Ollama chat with a visible endpoint and model.
- Optional editor-selection context with filename, line range, and size shown before Send.
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

Helix runs as a workspace extension. In Remote Development, `127.0.0.1` refers to the remote extension host, so Ollama normally needs to run there.

## Install from a verified VSIX

From a clean checkout:

```bash
npm ci
npm run check
code --install-extension dist/helix-vscode-extension-1.0.0.vsix
```

`npm run check` lints, type-checks, tests, packages, normalizes the archive for reproducible hashing, inspects every VSIX entry against an allowlist, and writes adjacent `.sha256` and `.contents.txt` evidence files.

## First run

1. Open the Helix activity-bar view or run **Helix: Open Local Chat**.
2. Choose **Configure**. Helix asks for the Ollama origin, fetches `/api/tags` only after that action, and lets you choose an installed model.
3. Choose **Test**. A failed connection explains which endpoint could not be reached; zero installed models gives the exact `ollama pull` next step.
4. Enter a question and choose **Send**.

The default endpoint is `http://127.0.0.1:11434`; the default model name is `qwen2.5-coder:7b`. Helix does not download or start models.

## Ask about selected code

1. Select the exact text in an editor.
2. Choose **Add editor selection** in the panel, use the editor context menu, or run **Helix: Add Editor Selection to Local Chat**.
3. Verify the displayed workspace-relative path, line range, and character count.
4. Enter a question and choose **Send**.

The attachment remains in memory until you clear it or the extension session ends. Helix sends no other file or workspace data.

## Propose a one-file edit

1. Open a saved local file inside a trusted workspace.
2. Describe one change in the Helix prompt and choose **Propose edit**, or run **Helix: Propose Edit to Active File…**.
3. Review the native diff. The title shows the complete workspace-relative target path.
4. Choose **Apply** or **Reject** in the modal. Reject writes nothing.

Apply changes the editor buffer but does not save it. **Helix: Revert Last Applied Edit** restores the exact pre-edit buffer while VS Code remains open, unless the file has changed again. Git remains the durable rollback mechanism.

Helix refuses edits when the workspace is untrusted, the target is untitled/non-file/outside the workspace (including a symlink escape), the file is empty/binary/oversized, or the document changes during generation.

## Commands

| Command | Behavior |
| --- | --- |
| Helix: Open Local Chat | Opens the local assistant sidebar. |
| Helix: Configure Ollama | Tests a user-entered origin and selects an installed model. |
| Helix: Test Ollama Connection | Fetches `/api/tags` after the command is invoked. |
| Helix: Add Editor Selection to Local Chat | Attaches only the current selection. |
| Helix: Propose Edit to Active File… | Generates one whole-file proposal and opens a diff. |
| Helix: Revert Last Applied Edit | Restores the in-memory snapshot when it is still safe. |
| Helix: Show Data & Privacy Details | Opens this document. |

`Ctrl+Shift+H` (`Cmd+Shift+H` on macOS) opens the panel.

## Settings

All settings use machine/user scope; commands write global values. Workspace settings cannot silently redirect code.

| Setting | Default | Notes |
| --- | --- | --- |
| `helix.ollama.endpoint` | `http://127.0.0.1:11434` | Origin only; URLs with credentials, paths, queries, or fragments are rejected. |
| `helix.ollama.model` | `qwen2.5-coder:7b` | Must be installed in Ollama. |
| `helix.ollama.allowRemoteEndpoint` | `false` | Remote endpoints require this opt-in and HTTPS. |
| `helix.requestTimeoutSeconds` | `60` | Runtime-clamped to 5–120 seconds. |
| `helix.maxContextCharacters` | `60000` | Runtime-clamped to 1,000–100,000 characters. |

## Data, privacy, and cost

Helix has no telemetry and no Helix-operated backend.

- **Configure/Test** sends only `GET /api/tags` to the displayed endpoint.
- **Send** sends the prompt and the displayed selection, if attached, to `/api/chat`.
- **Propose edit** sends the instruction, active file’s relative path/language, and bounded complete content to `/api/chat`.
- Chat, attachment, and the last edit snapshot are memory-only. Settings persist through VS Code.
- Prompt/source/model output is not logged.

Loopback Ollama traffic remains on the extension host. If you enable a remote endpoint, prompts and explicitly shared code cross the network to infrastructure you control; Helix does not implement authentication in this release. Remote use needs its own transport and access controls.

Ollama inference has no Helix token fee, but it uses your compute, memory, power, and time. Helix shows generation duration and does not retry automatically.

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

The release compiler has an explicit source allowlist. Historical hosted-platform code remains in the repository for owner review but is not imported, compiled, contributed, or packaged. See [Productization](docs/PRODUCTIZATION.md), [Testing](docs/TESTING.md), and [Releasing](docs/RELEASING.md).

## Troubleshooting

- **Cannot reach Ollama**: run `ollama serve`, verify the displayed origin, and choose Test. In SSH/Containers/Codespaces, remember the extension runs remotely.
- **Model returns HTTP 404**: run `ollama list`, then Configure and select an installed model.
- **No models installed**: run `ollama pull qwen2.5-coder:7b` (or another model), then Configure again.
- **Context/edit button disabled**: grant Workspace Trust and open/select a regular workspace file.
- **Edit is stale**: the buffer changed during generation. Review those changes and request a new proposal.
- **Remote endpoint rejected**: use HTTPS and enable `helix.ollama.allowRemoteEndpoint` in User Settings only after reviewing the disclosure above.

## License

See [LICENSE](LICENSE). Repository history contained conflicting Apache-2.0, MIT, and Business Source/custom claims. The manifest now avoids asserting a standard SPDX license; an authorized owner must resolve the underlying legal text before public distribution.
