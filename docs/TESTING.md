# Testing

## Deterministic automated checks

```bash
npm ci
npm run lint
npm run typecheck
npm test -- --runInBand
npm run package
npm run inspect:package
npm run audit:prod
```

Unit tests cover endpoint/model/input/path policy, structured edits, Ollama request/response behavior, failure normalization, release command alignment, and webview injection invariants. Packaging sorts entries and fixes their timestamps before hashing. `inspect:package` reads the built VSIX itself, permits only documented entries, scans runtime text for quarantined capabilities, checks that there are no production dependencies, and writes content/SHA-256 evidence.

## Manual core-journey matrix

| Case | Expected result |
| --- | --- |
| Fresh activation, Ollama stopped | Silent activation; setup state; no request until action. |
| Test with Ollama stopped | Actionable endpoint error; no prompt/source in error. |
| Configure with zero models | Exact `ollama pull` next step. |
| Ask without attachment | Only prompt/system message in request. |
| Attach malicious HTML-like filename/text | Displayed literally; no DOM execution. |
| Reject proposal | Diff opens; no file write. |
| Apply proposal | Exactly previewed content in unsaved active buffer. |
| Change file during generation | Stale proposal rejected. |
| Revert unchanged applied edit | Exact pre-edit content restored. |
| Revert after another modification | Safe refusal. |
| Restricted Mode | Chat without context works; attach/edit blocked. |
| Untitled/outside/symlink escape/binary/empty/oversized file | Rejected before generation. |
| Remote HTTP or credential URL | Rejected. |
| Remote HTTPS without opt-in | Rejected. |

## Manual request inspection

For a local test server, point the endpoint only to a controlled loopback fixture. Verify `/api/tags` and `/api/chat` bodies against [Privacy](PRIVACY.md). Never use real proprietary source as a fixture.
