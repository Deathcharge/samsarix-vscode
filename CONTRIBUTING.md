# Contributing

Helix accepts focused changes that preserve the local, explicit-context, review-before-apply product contract in [docs/PRODUCTIZATION.md](docs/PRODUCTIZATION.md).

## Before opening a pull request

1. Use Node 20 and start from a clean checkout.
2. Run `npm ci`.
3. Run `npm run check` and `npm run audit:prod`.
4. Inspect the generated `.vsix.contents.txt` and verify the `.sha256` file.
5. Manually test the affected journey in an Extension Development Host or from the packaged VSIX.

Pull requests should include the behavior changed, data-flow/privacy impact, tests added, and manual verification performed. Never add telemetry, background source collection, automatic writes, shell/process execution, remote endpoints, auth, or new providers without an updated product plan and threat model.

Do not include tokens, `.env` files, prompts/source captured from users, generated model output, or proprietary test fixtures.
