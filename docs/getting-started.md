# Getting started

Samsarix requires VS Code 1.85+, Ollama, and one installed model. It does not require a Samsarix backend or account.

```bash
ollama pull qwen2.5-coder:7b
```

Install a locally verified package:

```bash
npm ci
npm run check
code --install-extension dist/samsarix-vscode-1.0.0.vsix
```

Open **Samsarix: Open Local Chat**, choose **Configure**, confirm the Ollama origin, and select an installed model. No network request happens before a Configure, Test, Send, or Propose-edit action.

For code context, select text and choose **Add editor selection**. Verify the displayed relative path, lines, and size before Send.

For an edit, open a saved file in a trusted workspace, enter one bounded instruction, and choose **Propose edit**. Review the native diff and explicitly Apply or Reject it. Apply changes the unsaved editor buffer; Git is the durable rollback mechanism.

See the repository [README](../README.md) for the complete command, setting, privacy, and troubleshooting reference.
