# GitHub Automation Rules

## Scope

These rules apply to files under `.github/`.

## Release pipeline ownership

Release automation is split into three single-purpose workflows:

- `prepare-release.workflow.yml` detects the commit threshold and creates a version pull request.
- `create-github-release.workflow.yml` reacts to a changed `package.json` version on the default branch and creates the immutable tag and GitHub Release.
- `auto-release.workflow.yml` is the npm trusted-publisher workflow. Its filename is part of the npm OIDC trust configuration and must not be renamed.

Do not merge these responsibilities back into one workflow. GitHub branch requirements remain the source of truth for merging release pull requests.

## Authentication boundaries

- Use the default `github.token` for read operations, GitHub Actions bot approvals, and bot-authored review messages.
- Use `secrets.PAT_FINE` only inside the protected `admin` environment for transitions that must emit follow-up repository events:
  - pushing the generated release branch;
  - creating the generated release pull request;
  - enabling auto-merge after bot approval;
  - creating the immutable release tag and GitHub Release.
- Validate that `PAT_FINE` authenticates as the repository owner before using it.
- Never expose `PAT_FINE` to `pull_request` jobs or execute pull-request code in a privileged `pull_request_target` job.
- npm publication must use OIDC with `id-token: write`; do not add an npm write token fallback.

## Trusted release pull requests

A release pull request is eligible for automatic approval only when all of these conditions hold:

- same repository;
- repository-owner author;
- default-branch base;
- exact `release/v<package-version>` head branch;
- `auto-release` label;
- title `Bump version to v<package-version>`;
- package name `fastypest`;
- exactly `package.json` and `CHANGELOG.md` changed;
- validation and approval bound to the current head SHA.

The approval body is:

`Approved by the trusted release workflow contract.`

Auto-merge must use squash merge and an exact head-SHA match. Do not enumerate or poll check runs; repository rules decide when the merge is allowed.

## Release integrity

- Never force-update release tags.
- Reject existing tags that point to another commit.
- The automated GitHub Release must target the exact default-branch commit that changed `package.json`.
- The npm publisher must verify the release tag matches `package.json`, the tag is reachable from the default branch, and the package version is not already published.
- Stable versions publish to npm `latest`; prereleases publish to `next`.
- Reruns must be idempotent and must not delete branches, tags, releases, or diagnostic evidence on failure.

## Workflow security

- Default to `permissions: read-all`; elevate per job only.
- Pin third-party actions to full commit SHAs.
- Use `persist-credentials: false` unless a documented operation requires otherwise.
- Keep privileged jobs behind the `admin` environment.
- Do not use untrusted event fields in shell commands without passing them through explicit environment variables and validating their format.
