# Releasing

Public publication is not authorized by repository access alone. Confirm every external gate in [Productization](PRODUCTIZATION.md#owner-decisions-and-external-gates), especially Marketplace publisher control, the canonical repository URL, icon rights, and human acceptance of the exact artifact.

## Technical gates

1. Start from a clean checkout on a protected release branch.
2. Use Node 20 and run `npm ci`.
3. Run `npm run check` and `npm run audit:prod`.
4. Build twice from the same checkout and confirm the normalized VSIX SHA-256 is identical. Retain the VSIX, `.sha256`, `.contents.txt`, test output, dependency-audit output, and source revision.
5. Have a second person install that exact VSIX in a clean VS Code profile and sign off on [the manual matrix](TESTING.md#manual-core-journey-matrix).
6. Verify README/settings/commands against the installed artifact.

## Publication

Publish first as a pre-release through a protected CI environment with a human approval. Do not publish from a workstation or store a Marketplace token in the repository. Microsoft’s current guidance retires global Azure DevOps PATs on December 1, 2026; use Microsoft Entra automated publishing when owner authorization exists.

Promote only the exact tested version. Samsarix has no telemetry or server-side kill switch, so monitor Marketplace install errors and public issue reports.

## Rollback

If a release exposes data, writes unexpected files, or cannot complete the core journey:

1. Stop promotion and deprecate/unpublish the affected version where Marketplace policy permits.
2. Post a repository advisory with affected versions and a safe disable/uninstall workaround, without reproducing sensitive user data.
3. Fix on a new patch version; never replace an existing artifact under the same version.
4. Repeat all gates and link the corrective evidence.
