# Event-driven release pipeline

## Request

Split Fastypest release automation into independent event-driven workflows:

1. After each update to the default branch, count commits since the latest published release and create a version pull request once the configured threshold is reached.
2. After a default-branch update changes `package.json` version, create the corresponding immutable tag and GitHub Release with generated notes.
3. After a GitHub Release is published, publish the matching package version to npm through the existing trusted-publisher workflow.
4. Automatically validate, approve, and queue trusted release pull requests for squash auto-merge.
5. Preserve the exact `.github/workflows/auto-release.workflow.yml` filename required by npm OIDC.

Only `fastypest` is in scope. `typeorm-test-db` and DevBar are excluded.

## Evidence

- GitHub suppresses most follow-up workflow runs for events emitted with the repository `GITHUB_TOKEN`.
- Pull requests created with `GITHUB_TOKEN` require explicit workflow approval before their pull-request workflows run.
- A personal access token or GitHub App token can create the release branch and pull request while allowing normal pull-request checks to run.
- The `release.published` event supports both manually and automatically published GitHub Releases.
- npm trusted publishing binds the package to an exact workflow filename and requires OIDC.
- The current implementation combines npm publication, tag creation, and GitHub Release creation after a pull-request state transition.

## Scope

- Refactor `prepare-release.workflow.yml` to run on default-branch pushes and manual dispatch.
- Add `create-github-release.workflow.yml`.
- Change `auto-release.workflow.yml` to publish npm only from `release.published`.
- Harden the existing trusted release approval job.
- Add scoped GitHub automation guidance.
- Preserve manual release recovery, manual release-to-npm delivery, dry-run release calculation, release strategies, breaking-change notes, build checks, and package installation smoke tests.

## Decision

Use event boundaries as the orchestration contract:

```text
push default branch
  ├─ prepare release PR when threshold is reached
  └─ create GitHub Release when package.json version changes

release pull request
  └─ validate exact contract → bot approval → PAT-backed auto-merge

release.published
  └─ validate tag and package → build/package smoke → npm OIDC publish
```

`PAT_FINE` is used only in the protected `admin` environment where an operation must emit a follow-up event: release branch push, release pull-request creation, auto-merge enablement, immutable tag creation, and GitHub Release publication. GitHub Actions bot approval continues to use `github.token`. npm publication uses OIDC only.

## Acceptance

- A default-branch push below the threshold does not create a release pull request.
- A default-branch push at or above the threshold creates at most one owner-authored `release/v<version>` pull request.
- The generated pull request changes exactly `package.json` and `CHANGELOG.md`.
- The trusted workflow validates the current head, title, branch, author, repository, base, label, package name/version, and changed files before approving.
- The approval body remains `Approved by the trusted release workflow contract.`
- Auto-merge is enabled only for the validated current head and repository rules remain the merge authority.
- A release pull-request merge does not immediately create another version pull request while the new package version lacks its GitHub Release.
- A changed package version creates an immutable tag and GitHub Release targeting the exact default-branch commit.
- Existing wrong-target tags fail without force-updating or deleting them.
- Generated GitHub Releases use `PAT_FINE`, so `release.published` can trigger the npm workflow.
- Manually published owner releases trigger the same npm workflow.
- npm publication validates package name, semantic version, tag, prerelease state, default-branch ancestry, build, package archive, and existing npm state.
- Stable versions publish to `latest`; prereleases publish to `next`.
- Reruns are idempotent.
- No workflow polls check runs, directly merges a pull request, force-pushes a tag, or deletes release evidence on failure.
- The npm trusted-publisher workflow filename remains unchanged.

## Risks

- A broad or leaked PAT could create repository objects outside the intended release flow.
- A privileged `pull_request_target` workflow could execute untrusted pull-request code.
- Concurrent default-branch pushes could create duplicate release pull requests.
- Release creation can partially complete after tag creation.
- Manual releases could target an untrusted commit or mismatched package version.
- A prerelease could accidentally replace npm `latest`.

## Controls

- Restrict `PAT_FINE` to this repository and the minimum Contents/Pull requests permissions.
- Keep PAT-backed jobs behind the `admin` environment and verify the authenticated actor is the repository owner.
- Never checkout or execute pull-request code in the privileged approval job.
- Serialize release preparation and GitHub Release creation with repository-scoped concurrency.
- Treat an open trusted release pull request as a preparation barrier.
- Treat a package version without a GitHub Release as a preparation barrier.
- Bind approval and auto-merge to the live head SHA.
- Validate exact changed files and package metadata through the GitHub API.
- Reject tag collisions and verify tag targets after creation.
- Require release tags to be reachable from the default branch before npm publication.
- Use npm OIDC without a token fallback.

## Tests

- Parse every changed workflow as YAML.
- Check each changed shell block with `bash -n` after neutralizing GitHub expressions.
- Assert every third-party action reference is pinned to a full commit SHA.
- Assert the preparation workflow contains no check polling, direct merge, npm publish, GitHub Release creation, force push, or destructive cleanup.
- Assert the release creator uses a package-version-change gate, exact tag target validation, generated notes, and `PAT_FINE`.
- Assert the npm publisher is triggered only by `release.published`, retains its filename, has `id-token: write`, and contains no npm token fallback.
- Assert the trusted approval validates branch, title, package metadata, changed files, and current head before bot approval and PAT-backed auto-merge.
- Run the repository pull-request workflow on the implementation branch.
- Inspect CodeQL and review feedback before delivery.

## Checks

- YAML syntax.
- Shell syntax.
- Static workflow contract assertions.
- Pull-request build, format, package smoke, and database matrix.
- CodeQL and repository review checks.
- Final diff inspection for secret exposure, mutable tags, privileged execution of PR code, and duplicate release ownership.

## Rollback

Revert the implementation pull request. Existing tags, releases, packages, and generated release branches are not deleted. The previous merged-pull-request publication workflow is restored by the revert.

## Delivery

- Branch: `agent/refactor-event-driven-release`
- Pull request: pending
- Merge: requires explicit owner approval
- Release/publication: not permitted from this implementation branch

## Status

Implementation in progress.
