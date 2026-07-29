# Samsarix productization plan

Status: verified release candidate; Marketplace publication externally gated
Date: 2026-07-28  
Release target: `1.0.0` only after every P0 gate below passes

## Executive decision

Samsarix will ship as a **local-first VS Code coding companion for small, reviewable edits**. It connects only to an Ollama server chosen by the user, sends context only after an explicit action, and never changes a file until the user reviews a native VS Code diff and approves it.

The previous repository described a much broader hosted “multi-agent coordination platform.” That legacy product is not independently shippable from this repository: its primary paths require an undocumented hosted API, several visible surfaces use hard-coded or generated mock data, many declared commands have no implementation, and activation starts remote traffic without a user action. Those surfaces are not part of the release.

## Problem, audience, and job to be done

### Primary user

An individual developer or a small team that already runs Ollama and wants coding help inside VS Code without creating an account or sending source code to a vendor-operated service.

### Pain

Local-model users can already assemble broad agent systems, but the useful core interaction is easy to obscure behind provider setup, autonomous tools, and large feature surfaces. For a focused change, the developer needs to know exactly what code is shared and exactly what will be written.

### Job to be done

> When I am working in a file, help me reason about an explicitly selected piece of code and propose a bounded edit that I can inspect before anything changes, using a model that I control.

### Product promise

1. No account, subscription, marketplace, telemetry, or Samsarix cloud dependency.
2. No network request during activation or passive typing.
3. The UI identifies the endpoint, model, and attached context before a request.
4. Edit proposals are limited to the active workspace file.
5. Every write is preceded by a native diff and an explicit Apply action.
6. The last applied edit can be reverted during the current VS Code session.

## Category and market baseline

Samsarix belongs in the **local AI code-assistant** category, not the multi-agent platform category.

Current products establish a high baseline:

- Continue offers editor chat/agent experiences and documented local Ollama/offline configurations. Its final 2.0.0 release also removed authentication and anonymous telemetry. ([Continue docs](https://docs.continue.dev/index), [local-model guides](https://docs.continue.dev/guides/overview), accessed 2026-07-28.)
- Cline makes human control central: its documentation says file edits and terminal commands require approval, with Plan and Act modes and visible diffs. ([Cline IDE guide](https://docs.cline.bot/usage/ide), accessed 2026-07-28.)
- Ollama itself now documents a local-model workflow in VS Code. ([Ollama VS Code integration](https://docs.ollama.com/integrations/vscode), accessed 2026-07-28.)

Samsarix cannot credibly compete on breadth. Its wedge is a smaller and more inspectable contract:

- one provider (Ollama), one file at a time, and no tool or shell execution;
- explicit selection attachment rather than implicit workspace harvesting;
- a short data-flow disclosure in the UI, not only in a privacy document;
- loopback endpoints by default, with remote endpoints requiring an explicit opt-in;
- a small release artifact whose source and packaged contents are easy to audit.

This is intentionally narrower than general agents. The goal is trustworthy completion of the core journey, not feature-count parity.

## Core user journey

### First run

1. The user opens the Samsarix sidebar.
2. Samsarix shows “Not connected,” the configured endpoint, the configured model, and setup instructions. It does not make a request.
3. **Configure Ollama** fetches the model list only after the click. The user selects an installed model; the choice is stored in user settings, not workspace settings.
4. **Test connection** gives a bounded, actionable result.

### Ask with explicit context

1. The user selects code and clicks **Add editor selection**, or sends a question with no code attached.
2. Samsarix shows the relative filename, line range, and character count before sending.
3. On Send, Samsarix posts the question and the displayed context to the configured Ollama `/api/chat` endpoint.
4. The response is rendered as text. No response HTML is interpreted.

### Propose and apply an edit

1. In a trusted workspace, the user opens a file, describes a change, and clicks **Propose edit**.
2. Samsarix explicitly sends that file (bounded by the documented size limit) and the instruction to Ollama.
3. The model returns a structured whole-file proposal. Samsarix validates the shape and size.
4. A native VS Code diff opens with the complete workspace-relative path.
5. A modal offers Apply or Reject. Apply is unavailable if the document changed after generation.
6. On Apply, Samsarix performs one `WorkspaceEdit`. The previous content is retained in memory only for session-scoped revert.

## Scope

### P0 — required to call the repository shippable

- Replace startup activation with the local-only runtime; no polling, WebSocket, OAuth, MCP process, or passive-completion startup behavior.
- Implement Ollama configuration, connection testing, bounded chat, explicit selection context, one-file edit proposal, diff approval, apply, and session revert.
- Validate all webview messages and model responses; use a restrictive CSP and DOM text nodes rather than HTML injection.
- Restrict file edits to a regular file in the active trusted workspace and reject stale, oversized, binary, notebook, untitled, or outside-workspace targets.
- Make loopback the default and require user-level opt-in for non-loopback HTTP(S) endpoints.
- Add timeouts, cancellation, response-size bounds, clear error states, and request de-duplication.
- Reduce manifest commands, settings, menus, views, dependencies, and activation events to implemented behavior.
- Declare Workspace Trust behavior and restrict endpoint/model configuration against workspace override.
- Replace fictional setup, product, publishing, and licensing claims with repository-accurate documentation.
- Add deterministic lint, type-check, unit-test, package, and package-content CI gates.
- Produce a VSIX and inspect its exact file list for secrets, mocks, test data, and dead runtime modules.
- Use one standard license, preserve attribution in source and packaged artifacts, and separate source-code rights from Samsarix trademark rights.

### P1 — high-value follow-up

- Streaming responses with cancellation and back-pressure.
- Multi-turn session history with an explicit clear button and documented in-memory retention.
- Partial edit format with robust conflict handling instead of whole-file proposals.
- First-party VS Code integration tests in an Extension Development Host.
- Remote Ollama support with an authenticated transport design and per-endpoint disclosure.
- Accessibility and localization review with keyboard-only and screen-reader testing.

### P2 — intentionally deferred

- Multiple providers or hosted inference.
- Repository indexing, embeddings, passive inline completion, or automatic context gathering.
- Multi-file agents, terminal execution, browser automation, MCP, auto-approval, or autonomous loops.
- Accounts, subscriptions, team sync, marketplaces, agent personas, coordination dashboards, workflows, or performance gamification.
- Images, audio, long-term memory, checkpoints, or cross-device history.

### Removed from the current tree and release surface

The verified release slice replaced and then removed the old hosted API/auth/WebSocket services, marketplace and subscription UX, agent/spiral/coordination webviews, agent polling, memory sync, MCP subprocesses, browser/terminal managers, passive inline completions, checkpoint system, generated mock metrics, and their stale tests/assets. Git history preserves the prior implementation without making it part of the current security or maintenance surface.

## Architecture

```text
VS Code command/sidebar
        |
        | validated UI message + explicit user action
        v
Local extension host
  - selection snapshot
  - request/size/time bounds
  - workspace/path/trust checks
        |
        | HTTP POST to configured endpoint
        v
User-controlled Ollama /api/chat
        |
        | bounded text or structured edit JSON
        v
Text rendering OR virtual diff -> modal approval -> WorkspaceEdit
```

### Modules

- `extension.ts`: registration only; no startup I/O.
- `local/OllamaClient.ts`: endpoint validation, model discovery, chat/edit requests, timeout and response bounds.
- `local/ChatViewProvider.ts`: webview state, explicit context capture, message validation, CSP, and text-only rendering through the two allowlisted `assets/chat.*` files.
- `local/EditController.ts`: trusted-workspace and path policy, edit parsing, diff preview, stale-document check, apply/revert.
- `local/previewProvider.ts`: read-only virtual documents for native diffs.
- `local/policy.ts`: pure validation helpers covered by unit tests.

No service container, global singleton graph, background timer, child process, shell, secret store, database, or remote Samsarix service is required.

## Trust boundaries and data flows

### Inputs treated as untrusted

- Webview messages.
- Workspace filenames and file contents.
- VS Code workspace settings.
- Ollama endpoint responses, including model-generated JSON.
- Endpoint and model strings entered by a user.

### Data sent

| Action | Destination | Data | Trigger |
| --- | --- | --- | --- |
| Configure/Test | Configured Ollama endpoint | `GET /api/tags` | Explicit click/command |
| Chat | Configured Ollama endpoint | System instruction, question, and displayed attached selection (if any) | Explicit Send |
| Propose edit | Configured Ollama endpoint | Instruction, active file’s workspace-relative path, language, and bounded full content | Explicit Propose edit |

There is no telemetry. Nothing is sent to a Samsarix-operated endpoint. The extension does not discover, index, or upload the workspace in the background.

### Storage and retention

- Endpoint, model, and remote-endpoint opt-in are stored as VS Code **global/user settings**.
- Chat messages and attached selection are memory-only and disappear when the view/extension session is disposed.
- One pre-edit and post-edit snapshot is held in extension memory to support Revert. It is replaced by the next applied edit and disappears when VS Code exits or the extension reloads.
- No credentials are requested or stored in P0.

### Workspace Trust

Chat without workspace content may work in Restricted Mode. Reading editor context and proposing/applying edits require `vscode.workspace.isTrusted`. Endpoint/model/remote-opt-in settings are declared as restricted configurations, and configuration commands write only to the global target. The runtime also enforces trust and path rules because hidden commands can still be invoked.

VS Code recommends static Workspace Trust declarations, runtime command guards, and restricted configurations for settings that can be influenced by a workspace. ([Workspace Trust extension guide](https://code.visualstudio.com/api/extension-guides/workspace-trust), accessed 2026-07-28.)

## Security requirements

1. Webview CSP starts with `default-src 'none'`; only nonce-authorized local script and CSP-source styles are allowed.
2. Dynamic UI values use `textContent`; no workspace/model/response value reaches `innerHTML`.
3. Host handlers accept only enumerated message types and bounded primitive fields.
4. Loopback HTTP is allowed. Non-loopback endpoints require HTTPS plus an explicit user-level opt-in. Credentials in URLs are rejected.
5. Requests have configurable but bounded timeouts and response-size checks. Errors do not include source content.
6. Model names and prompts have length bounds; edit JSON must have exactly the supported fields and a bounded string body.
7. A proposed edit can target only the active regular `file:` document inside one open workspace. Symlink/canonical-path behavior is checked before apply.
8. The preview shows the workspace-relative path and the current document must still match the captured version/content hash before apply.
9. No shell, child process, `eval`, arbitrary command dispatch, OAuth callback, token persistence, or model-provided path is reachable in the release runtime.
10. Package inspection and secret scanning are release gates.

VS Code extensions execute with the user’s permissions, and the Marketplace exposes runtime-security signals to help users assess that trust. ([Extension runtime security](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security), accessed 2026-07-28.)

## Reliability, performance, and cost

- Activation performs registration only and should finish without network access.
- Only one chat request and one edit request may run at a time per view/controller. A second action receives a clear busy state.
- Requests use `AbortController`; disposal cancels in-flight work. The configured timeout is clamped to 5–120 seconds.
- Context and files are bounded before serialization. The P0 defaults are intentionally small enough for common local models.
- Response bodies are rejected when their declared or observed size exceeds the limit.
- Local model inference has no vendor token charge, but it consumes user CPU/GPU, memory, power, and time. The UI reports request duration; Samsarix makes no “free” or performance guarantee.
- There are no retries in P0, preventing duplicate expensive generations. The user decides when to retry.
- No logs include prompts, source content, or model output. Errors log only operation, status/category, and timing when an output channel is explicitly opened.

## Baseline repository findings

| Severity | Finding | Disposition |
| --- | --- | --- |
| P0 | Activation connected to an undocumented hosted WebSocket and polled agents even though `autoConnect` defaulted to false. Failures could break activation. | Replace activation graph; no startup I/O. |
| P0 | Passive inline completion defaulted on and sent surrounding source plus an absolute filename on typing. | Remove from contributions and runtime; do not compile/package. |
| P0 | Chat and edits depended on undocumented `/api/copilot/*` endpoints, while local-model settings were unused. | Implement a documented Ollama client and remove cloud dependency. |
| P0 | Marketplace prices, ratings, agents, metrics, workflows, and several fallback outputs were mock/generated but presented as real features. | Remove from manifest and package. |
| P0 | OAuth URI handling accepted a token without state/PKCE and copied bearer tokens from SecretStorage into plaintext global state. | Remove accounts/OAuth from P0 runtime and package. |
| P0 | Chat webview used unescaped workspace-derived values in `innerHTML` and had no CSP, enabling workspace-controlled webview injection. | Replace the webview with CSP + text-node rendering and test it. |
| P0 | Agent edit trusted a backend-supplied file path and could preview/apply outside the workspace; the UI showed only a basename. | Model never supplies a path; controller locks to the captured active file and displays the full relative path. |
| P0 | `package.json`, README, `LICENSE`, and `LICENSING.md` contradicted one another (Apache-2.0, MIT, and BSL/custom terms). | Resolved to unmodified MPL-2.0 with Samsarix LLC attribution, an SPDX manifest value, packaged notices, and a separate trademark policy. |
| P0 | README and publishing docs described Python commands, missing workflows, missing scripts, and a different repository. | Replace with tested instructions and release gates. |
| P1 | MCP could auto-spawn workspace-configured processes, used a Windows shell, and did not bound non-newline stdout. | Exclude from release; revisit only with a separate threat model and consent flow. |
| P1 | The old source tree was much larger than the P0 product and contained unreachable `eval`, shell execution, mock data, and stale tests/assets. | Completed: compile/package allowlists were verified, then 81 obsolete tracked files were removed from the current tree while Git history preserved them. |

## Test strategy and release gates

### Automated

- TypeScript strict compilation for only the release modules.
- ESLint with no warnings.
- Unit tests for endpoint policy, workspace/path policy, response bounds, structured edit parsing, request formatting, timeout/error normalization, stale edit protection helpers, and webview CSP/text-rendering invariants.
- Package smoke test that normalizes the VSIX for reproducible hashing, unpacks it, asserts an allowlist of runtime files, and checks for forbidden tokens/paths.
- CI on supported Node versions using `npm ci`, lint, compile, tests with coverage, dependency audit, VSIX packaging, and package inspection.

### Manual acceptance

1. Fresh VS Code profile, Ollama stopped: activation is silent; panel explains setup; Test gives one actionable error.
2. Ollama running with zero models: Configure explains how to pull one.
3. Installed model: selection attachment preview is accurate and Send returns text.
4. Workspace filename/content containing HTML is displayed literally and cannot execute in the webview.
5. Edit preview shows the complete relative path; Reject writes nothing.
6. Apply writes exactly the previewed content; Revert restores exactly the captured content.
7. Modify the document while generation runs: Apply is rejected as stale.
8. Restricted Mode: file context/edit actions are blocked; no workspace endpoint override is honored.
9. Oversized/binary/outside-workspace/untitled files are rejected before a request.
10. Non-loopback HTTP and credential-bearing URLs are rejected; remote HTTPS requires explicit global opt-in.
11. Disable network after activation: no error occurs until the user starts a request.

### Packaging

The official `vsce` flow is the release mechanism. VS Code’s current guidance notes package security constraints and the December 1, 2026 retirement of global Azure DevOps PATs; automated publication should use Microsoft Entra ID rather than a long-lived global PAT. ([Publishing extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension), accessed 2026-07-28.)

The release is blocked unless:

- `npm ci`, `npm run lint`, `npm run compile`, `npm test -- --runInBand`, and `npm run package` succeed from a clean checkout;
- the VSIX contents match the allowlist and contain no source maps, test fixtures, stale webviews, lockfile secrets, `.env` files, or unrelated services;
- `npm audit --omit=dev` has no high/critical production finding, and dev-only exceptions (if any) are recorded with owner and expiry;
- the installed VSIX passes the manual core journey;
- the MPL-2.0 license/notice files are present and the intended Marketplace publisher identity is controlled by the owner.

## Release and operations plan

1. Produce a local VSIX artifact in CI and retain the exact SHA-256 and file manifest.
2. Have a second person install that artifact in a clean profile and sign off on the manual acceptance list.
3. Publish first as a pre-release; monitor Marketplace install errors and repository issues. There is no telemetry, so operational visibility is intentionally limited to user-submitted diagnostics.
4. Promote the exact tested artifact/version only after sign-off.
5. Roll back by unpublishing/deprecating the affected version and publishing a corrected patch; the extension has no server-side kill switch.
6. Never publish from a developer workstation with an ad-hoc token. Use protected CI environment approval and Microsoft Entra automated publishing when marketplace publication is authorized.

## Owner decisions and external gates

The owner has confirmed the Samsarix brand, Samsarix LLC company identity, and the `contact@samsarix.com` / `support@samsarix.com` contact channels. The repository now uses unmodified MPL-2.0, identifies Samsarix LLC and contributors in `NOTICE`, and keeps brand permissions separate in `TRADEMARKS.md`.

The legacy double-helix icon was replaced with a new project-created S/X mark that is distinct from the retired product identity.

Public Marketplace publication remains blocked by:

- **Publisher**: create or confirm control of the exact `samsarix` Visual Studio Marketplace publisher declared by the manifest.
- **Repository identity (complete)**: the canonical repository and manifest URLs use `Deathcharge/samsarix-vscode`; the post-rename VSIX contents check passes.
- **Brand clearance**: perform a professional trademark search for the Samsarix name and the new S/X mark, document provenance, and decide whether to pursue registration before a broad public launch.
- **Copyright chain**: confirm that Samsarix LLC owns or has assignments for the copyrights it claims. Repository history is overwhelmingly owner-authored but includes automation identities.
- **Privacy/legal review**: approve the local/remote endpoint disclosure and remote-endpoint opt-in before enabling non-loopback support in a public release.
- **Human acceptance**: install the exact hashed VSIX in a clean Extension Development Host with a chat-capable Ollama model and complete the manual matrix above.

Marketplace publication must remain a deliberate owner action. None of these gates requires an undocumented legacy or Samsarix-hosted service.
