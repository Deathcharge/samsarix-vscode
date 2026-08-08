# Changelog

## 1.0.0 — unreleased productization candidate

- Reframed Samsarix as an independent local-Ollama, review-first code assistant.
- Removed hosted API, authentication, subscription, marketplace, agent polling, WebSocket, MCP, browser, terminal, mock dashboard, and passive inline-completion surfaces from the release runtime.
- Added explicit selection context, bounded chat requests, one-file structured edit proposals, native diff approval, stale-document protection, and in-memory revert.
- Added streamed chat with cancellation/back-pressure, genuine memory-only multi-turn follow-ups, quick Explain/Review selection workflows, and diagnostics-aware repair through the existing diff approval gate.
- Added loopback-by-default endpoint policy, Workspace Trust enforcement, restrictive webview CSP, text-only rendering, request timeouts, and response bounds.
- Replaced inaccurate product/setup/publishing documentation and added deterministic CI and VSIX content inspection.
- Renamed the product and extension identity to Samsarix, owned by Samsarix LLC.
- Replaced the legacy double-helix icon with an original Samsarix S/X mark.
- Replaced contradictory custom licensing terms with the standard Mozilla Public License 2.0, attribution notice, and trademark policy.

Marketplace publication remains gated on control of the `samsarix` publisher, brand clearance, and the documented human acceptance run.
