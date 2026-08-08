# Actions runtime hardening

## Request

Investigate the failing npm auto-release and the shared required-QA Dependabot auto-merge automation, correct the root causes, and preserve the trusted release and approval contracts.

## Evidence

- Auto-release run `31248972629`, job `93082148311`, reached the package consumer smoke test and failed before publication because `actions/setup-node` exported an npm user config containing `${NODE_AUTH_TOKEN}` while npm trusted publishing intentionally provides no long-lived token. The temporary consumer then resolved Yarn Classic outside the repository and attempted to expand that undefined variable.
- Required-QA workflows shared across the repository set attempt `enablePullRequestAutoMerge` even when GitHub reports a PR as `clean`; GitHub rejects that mutation because the PR can already merge.
- Updating a behind Dependabot branch that changes `.github/workflows/*` can return `403` unless the automation token has the sensitive Workflows permission.
- `GITHUB_TOKEN` must not perform an immediate merge when downstream `push` workflows are required because GitHub suppresses most workflow runs caused by that token.

## Decision

- Keep `.github/workflows/auto-release.workflow.yml` at the same path and retain npm OIDC with `id-token: write`; do not add an npm token fallback.
- Isolate only the package-install smoke test from the publisher npm config and run its consumer install with the package-manager version declared by the package.
- Keep current-head, non-bot, write-maintainer QA approval as the merge prerequisite and revalidate it immediately before mutation.
- Use the protected `admin` Actions secret `PAT_FINE`, validated as the repository owner, for live branch/merge transitions so downstream events remain eligible to start workflows.
- Never grant Workflows permission for branch refresh. A behind PR that changes workflows is reported as requiring a manual trusted branch update and a fresh approval.
- If GitHub already reports `clean`, squash-merge the exact approved head. Otherwise enable repository auto-merge when available; handle a clean-state race by revalidating and merging the same exact head.

## Acceptance

- The npm smoke test no longer depends on `NODE_AUTH_TOKEN` and the OIDC publisher identity is unchanged.
- Clean approved majors no longer fail the auto-merge mutation.
- Workflow-changing behind majors do not request elevated workflow permission.
- Stale approvals, bot approvals, changed heads, merge conflicts and change-request reviews cannot merge.
- Dry-run remains non-mutating.

## Checks

- Parse changed workflow YAML.
- Syntax-check shell and `github-script` programs.
- Verify changed third-party Actions use immutable SHAs.
- Pull-request CI is authoritative.

## Rollback

Revert the corrective pull request. No release, npm publish, merge, or deployment is performed by this branch.

## Delivery status

Implemented on `agent/fix-actions-runtime-20260808`; pending pull-request CI and explicit owner merge approval.
