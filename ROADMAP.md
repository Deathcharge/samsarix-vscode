# Samsarix — local, review-first AI for VS Code roadmap

This roadmap separates four gates: merge, release, publication, and flagship adoption. Passing one does not imply the next.

## Product boundary

Portfolio role: **integration or extension**. Keep its platform-specific packaging and release lifecycle separate. Any flagship integration should use a documented HTTP, event, or package contract with explicit auth, privacy, and failure ownership.
Planned repository identity: `Deathcharge/samsarix-vscode` (ready).

Current disposition: the productized runtime and competitive local-review milestone are on `main`. Version `1.1.0` is the first non-colliding Samsarix release line because the historical `v1.0.0` tag predates productization. Marketplace publication and broader adoption remain separate owner decisions.

## Stabilize the productized default

- Keep the default branch buildable from a clean checkout and preserve exact-head CI evidence.
- Keep Samsarix LLC branding, package identity, license metadata, and compatibility aliases internally consistent.
- Preserve the pre-productization default under a rollback ref before merging; do not delete legacy history.
- Review priority: review branch and approve MPL/brand/publisher then human-test one immutable VSIX with real Ollama.

## Release candidate

- Test the exact distributable on its target platform, including failure and upgrade paths.
- Review permissions, data retention, privacy copy, signing, and store or platform ownership.
- Release a prerelease to a bounded pilot before broad distribution.

Current hardening backlog:

- No real-Ollama acceptance evidence is available on this machine because Ollama is not installed.
- No Marketplace publisher validation, Marketplace publication automation, or rollback exercise.
- Marketplace publisher control and brand/trademark clearance still require owner evidence.
- Remote endpoints have no first-party authentication design; whole-file proposals remain coarse and model-dependent.
- The local IDE-assistant market is crowded, so the narrow safety promise needs user validation.

Completed competitive workflow milestone:

- Streamed, cancellable chat with bounded response parsing and throttled webview updates.
- Up to 12 memory-only follow-up turns with an explicit clear action.
- Explicit-selection Explain and Review tasks surfaced in the sidebar and editor context menu.
- On-demand active-file diagnostic repair, bounded to 25 summaries and routed through native diff approval.
- Extension Development Host smoke coverage at VS Code 1.85.2 verifies command registration, no-I/O activation, explicit selection attachment, and restricted configuration declarations.
- Current stable VS Code compatibility is exercised in the CI host-test matrix, and the exact VSIX is installable in an isolated extension directory.

## Samsarix adoption

- Define a public API, event, schema, artifact, or deployment contract before connecting to Samsarix Unified.
- Add a consumer-owned contract fixture covering authentication, privacy, limits, errors, and version compatibility.
- Make one implementation canonical; remove or freeze duplicate behavior only after parity and rollback are proven.
- Record an owner, support level, compatibility window, and measurable adoption signal.

## Completion evidence

A milestone is complete only when its exact commit, commands and results, artifact digest, consumer or deployment, and rollback path are recorded in a pull request or release record. README claims must not exceed that evidence.
