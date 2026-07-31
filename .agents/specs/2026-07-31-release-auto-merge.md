# Release pull request auto-merge architecture

## Request
Replace the auto-release workflow's direct check polling and merge logic with repository-native auto-merge. Publish only after the release pull request has been merged by the configured branch requirements.

## Evidence
- Run `30620987564` created release PR `#1679`, then treated every check run as mandatory and aborted when an additional check failed.
- The package build, package installation smoke test, and project CI passed.
- The failure cleanup deleted the release branch and tag before the external check could be diagnosed.
- Code scanning can add or rename checks without changing the repository's required-check contract.

## Scope
- Prepare release metadata in a same-repository `release/<run-number>` pull request.
- Approve the exact release head and enable squash auto-merge.
- Publish npm, create the immutable tag, and create the GitHub Release only after the pull request merges.
- Preserve scheduled releases, manual strategies, dry runs, breaking-change metadata, package build, and package installation smoke tests.

## Decision
GitHub branch requirements are the source of truth for release eligibility. A dedicated preparation workflow does not enumerate check runs, wait for checks, merge directly, publish, or delete release evidence. The trusted pull-request workflow enables auto-merge for the exact head SHA. The existing `auto-release.workflow.yml` remains the owner of npm publication so its trusted-publisher identity is preserved; its merged-release job validates the pull-request contract before checking out the merge commit and publishing.

## Risks
- A malformed release pull request could trigger privileged publication.
- npm publication can succeed before tag or GitHub Release creation.
- A rerun can encounter an existing branch, tag, package version, or release.
- Missing workflow approval settings or `PAT_FINE` prevents release auto-merge.

## Controls
- Require a merged, same-repository, owner-authored, `auto-release` pull request targeting the default branch from `release/`.
- Require exactly `package.json` and `CHANGELOG.md` changes.
- Match the pull-request title to the package version.
- Bind approval and auto-merge to the current head SHA.
- Make npm, tag, and GitHub Release delivery idempotent and reject tag collisions.
- Keep privileged publication behind the `admin` environment.

## Acceptance
- A prepared release pull request exits without polling checks or merging directly.
- Auto-merge waits for the repository's configured requirements.
- Failed or pending checks leave the pull request and branch available for diagnosis.
- Publication cannot run before a trusted release pull request is merged.
- A successful merged release publishes the exact package version, tags the merge commit, creates a GitHub Release, and verifies all three outputs.
- Dry-run and breaking-change behavior remains available.

## Tests
- Parse all changed workflow YAML files.
- Assert the preparation workflow contains no check-run polling, direct merge API call, npm publication, release creation, forced tag update, or failure cleanup.
- Assert release approval enables auto-merge with an exact head match.
- Assert merged publication validates actor, repository, base, head prefix, label, changed files, title, package version, tag target, npm state, and GitHub Release state.
- Run the repository pull-request workflow on the resulting branch.

## Checks
- YAML syntax validation.
- Workflow contract inspection.
- Pull-request CI and CodeQL.
- Review final diff for secrets, mutable privileged behavior, and destructive cleanup.

## Rollback
Revert the pull request. Existing failed release PRs remain closed and no package or tag is recreated automatically. A later scheduled or manual release can create a fresh release pull request.

## Delivery
- Branch: `agent/fix-release-auto-merge`
- Pull request: #1680
- Merge: requires explicit owner approval
- Publication: not triggered by this implementation pull request

## Status
Implemented on the delivery branch. Initial pull-request CI passed; review hardening and final CI validation are in progress.
