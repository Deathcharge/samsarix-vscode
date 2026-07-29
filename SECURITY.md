# Security policy

## Supported versions

Until a public release is authorized, only the latest commit on the active productization/release branch is evaluated. After publication, the latest patch release will receive security fixes; older versions should be upgraded.

## Reporting a vulnerability

Use GitHub’s private security-advisory flow for the canonical repository owner or email [support@samsarix.com](mailto:support@samsarix.com). Do not post exploit details, prompts, source code, tokens, private endpoint URLs, or user data in a public issue.

Include the affected version/commit, OS and local/remote VS Code host type, prerequisite configuration, impact, and the smallest safe reproduction. Maintainers should acknowledge within five business days and provide a remediation/status update within ten business days when ownership is available.

## Security contract

- No network request on activation or passive typing.
- Only the configured Ollama origin is contacted, and only after explicit Configure/Test/Send/Propose actions.
- Workspace content is opt-in and displayed before Send; edit generation is limited to the active file.
- Every write requires a native diff plus modal approval and is revalidated against the captured file.
- No telemetry, auth token, shell/process execution, MCP, browser automation, or model-chosen path exists in the packaged runtime.
- Remote endpoints are disabled by default and require HTTPS plus a user-level opt-in.

See [docs/PRIVACY.md](docs/PRIVACY.md) and [docs/PRODUCTIZATION.md](docs/PRODUCTIZATION.md) for the data flow and threat model.
