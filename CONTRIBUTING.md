# Contributing

## Branches (Gitflow)

| Branch           | Purpose                                | Created from  | Merged into                                 |
| ---------------- | -------------------------------------- | ------------- | ------------------------------------------- |
| `main`           | Production. Every commit is a release. | —             | —                                           |
| `development`    | Integration branch (default).          | `main`        | —                                           |
| `feature/<name>` | New feature.                           | `development` | `development`                               |
| `bugfix/<name>`  | Non-urgent fix.                        | `development` | `development`                               |
| `release/vX.Y.Z` | Release stabilization.                 | `development` | `main`, then back-merged into `development` |
| `hotfix/<name>`  | Urgent production fix.                 | `main`        | `main`, then back-merged into `development` |

Rules (enforced by branch rulesets and the `PR policy` workflow):

- No direct push to `main` or `development`: pull requests only.
- No force push, no branch deletion on `main` and `development`.
- Required checks: `check`, `luacheck`, `branch-policy`, `pr-title`.
- Branch names: lowercase, `a-z0-9._-` after the prefix.
- Releases are tagged on `main` as `vX.Y.Z`.

## Commits and PR titles

[Conventional Commits](https://www.conventionalcommits.org/), checked locally by commitlint (`commit-msg` hook) and on PR titles by CI.

```
<type>(<scope>): <summary>
```

- Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `style`, `test`, `build`, `ci`, `chore`, `revert`.
- Scopes: `plugin`, `api`, `web`, `admin`, `db`, `infra`, `deps`.

Feature branches are squash-merged. Release and hotfix branches use a merge commit.

## Issues

- Every PR closes at least one issue (`Closes #N`).
- Labels: one `type: *`, one or more `area: *`, optionally `priority: *`.
- Issues belong to a milestone (`vX.Y.Z`).
