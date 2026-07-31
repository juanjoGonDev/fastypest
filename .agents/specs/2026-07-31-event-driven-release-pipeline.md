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
- The previous implementation combined npm publication, tag creation, and GitHub Release creation after a pull-request state transition.
- Review found and the implementation corrected exact-release-commit targeting, shell template expansion, persisted checkout credentials, label validation under `pipefail`, and missing approval-workflow ownership documentation.

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
- Release preparation is attached to the exact default-branch event SHA and does not drift to a newer branch head.
- The generated pull request changes exactly `package.json` and `CHANGELOG.md`.
- The trusted workflow validates the current head, title, exact branch, author, repository, base, label, package name, monotonic version, changelog entry, destination tag/release state, and changed files before approving.
- The approval is submitted through the reviews API against the validated commit SHA with body `Approved by the trusted release workflow contract.`
- Auto-merge is enabled only for the validated current head and repository rules remain the merge authority.
- A release pull-request merge does not immediately create another version pull request while the new package version lacks its GitHub Release.
- The release baseline tag must target a commit whose `package.json` contains the current version and whose release metadata matches stable or prerelease state.
- A changed package version creates an immutable tag and GitHub Release targeting the exact first-parent commit that introduced that version, including multi-commit push cases.
- Existing releases are accepted as idempotent only when tag target, draft state, and prerelease state match the resolved contract.
- Existing wrong-target tags or releases fail without force-updating or deleting them.
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
- A multi-commit default-branch push could place commits after the version change and accidentally expand the release target.

## Controls

- Restrict `PAT_FINE` to this repository and the minimum Contents/Pull requests permissions.
- Keep PAT-backed jobs behind the `admin` environment and verify the authenticated actor is the repository owner.
- Never checkout or execute pull-request code in the privileged approval job.
- Serialize release preparation and GitHub Release creation with repository-scoped concurrency.
- Attach release preparation to the event SHA before creating the release commit and branch.
- Treat an open trusted release pull request as a preparation barrier.
- Treat a package version without a GitHub Release as a preparation barrier.
- Bind approval and auto-merge to the live head SHA.
- Validate exact changed files, monotonic versioning, changelog content, and package metadata through the GitHub API.
- Resolve the exact first-parent commit that introduced the package version.
- Reject tag/release collisions and verify tag targets and release metadata after creation.
- Require release tags to be reachable from the default branch before npm publication.
- Pass event and action values into shell blocks through explicit environment variables.
- Use npm OIDC without a token fallback.

## Tests

- Parsed every changed workflow as YAML.
- Checked every changed shell block with `bash -n` after neutralizing GitHub expressions.
- Checked every changed `actions/github-script` program by parsing it inside an async function wrapper.
- Asserted every third-party action reference is pinned to a full commit SHA.
- Asserted the preparation workflow contains no check polling, direct merge, npm publish, GitHub Release creation, force push, or destructive cleanup.
- Asserted the release creator uses a package-version-change gate, exact tag target validation, generated notes, and `PAT_FINE`.
- Asserted the npm publisher is triggered only by `release.published`, retains its filename, has `id-token: write`, and contains no npm token fallback.
- Asserted the trusted approval validates branch, title, monotonic package metadata, changelog, changed files, destination collisions, and current head before bot approval and PAT-backed auto-merge.
- Exercised the exact release-SHA resolver with synthetic histories covering a multi-commit push, manual recovery, and a later `package.json` edit that retained the same version.
- Exercised the strict semantic-version parser and comparator for patch, minor, major, prerelease, stable-versus-prerelease, numeric-versus-string identifiers, and invalid leading-zero identifiers.
- Ran the repository pull-request build, format, package-install smoke, and database matrix on implementation heads.
- Resolved all initial review findings and confirmed no unresolved review threads before final delivery validation.

## Checks

- YAML syntax: passed.
- Shell syntax: passed.
- GitHub-script syntax: passed.
- Static workflow contract assertions: passed.
- Exact release-SHA synthetic cases: passed.
- Semantic-version parser/comparator cases: passed.
- Pull-request build, format, package smoke, and database matrix: passed on hardened implementation heads; the final documentation head remains subject to the normal pull-request CI gate.
- Initial review findings: resolved.
- Final diff inspection: no secret values, mutable release tags, privileged execution of pull-request code, duplicate release ownership, or destructive failure cleanup found.

## Rollback

Revert the implementation pull request. Existing tags, releases, packages, and generated release branches are not deleted. The previous merged-pull-request publication workflow is restored by the revert.

## Delivery

- Branch: `agent/refactor-event-driven-release`
- Pull request: `https://github.com/juanjoGonDev/fastypest/pull/1681`
- Merge: requires explicit owner approval
- Release/publication: not permitted from this implementation branch

## Status

Implementation, review hardening, and static validation are complete. Delivery remains gated by pull-request CI and explicit owner merge approval; no merge, GitHub Release, tag, or npm publication has been performed.
