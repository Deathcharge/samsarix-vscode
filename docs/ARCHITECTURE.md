# Architecture

Samsarix has one runtime entrypoint and six local modules. The TypeScript compiler and VSIX inspector use explicit allowlists, so an unrelated file cannot become executable or enter the package merely by being added to the repository.

```text
extension.ts
  ├─ ChatViewProvider ── explicit action ── OllamaClient ── /api/tags or /api/chat
  ├─ EditController ── PreviewProvider ── native vscode.diff ── WorkspaceEdit
  ├─ configuration ── global/machine settings only
  └─ policy ── endpoint, input, path, response, and edit validation
```

## Activation

Activation constructs providers and registers commands, a webview view, a virtual-document provider, and a configuration listener. It performs no fetch, timer, filesystem read, child-process spawn, token lookup, or user notification.

## Chat

`ChatViewProvider` owns memory-only display messages and one optional selection snapshot. The webview posts an enumerated action with a bounded string. Dynamic values render through DOM `textContent`; its only packaged assets are `assets/chat.js` and `assets/chat.css`. The host calls `OllamaClient` only for Test, Send, or Propose edit.

## Edits

`EditController` captures the active document, workspace-relative path, canonical filesystem path, version, and complete bounded text before generation. The model returns only `summary` and `content`; it never chooses a path. Samsarix opens a virtual read-only proposal with `vscode.diff`, waits for modal approval, rechecks canonical path/version/content, then performs one `WorkspaceEdit` without saving.

Only one previous/applied pair is retained in memory. Revert checks that current text is still exactly the applied proposal before restoring the previous buffer.

## Error model

Configuration and policy failures are synchronous and actionable. Network operations have one bounded attempt, a cancellation signal, a 5–120 second timeout, and a 1 MB response ceiling. HTTP error bodies are not shown or logged. The UI has explicit untested/testing/connected/error and busy states.

## Historical source quarantine

Pre-productization modules for a hosted API, WebSocket, auth, marketplace, agents, MCP, terminal/browser automation, memory, checkpoints, and mock dashboards were removed from the current tree after the release slice was verified. Git history preserves them if a future owner needs to inspect or extract prior work. The compiler, manifest, and VSIX inspector continue to allowlist the shipped runtime explicitly.
