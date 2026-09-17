# Git conventions

Nancyfi uses structured Git metadata so history and automation stay readable.

| Concern | Spec |
| --- | --- |
| Branch names | [Conventional Branch](https://conventionalbranch.org/) |
| Commit messages | [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) |

Agent enforcement: `.cursor/rules/conventional-git.mdc`.

## Branches

```
<type>/<description>
```

Trunk branches (`main`, `master`, `develop`) have no prefix.

**Purpose types:** `feature` / `feat`, `bugfix` / `fix`, `hotfix`, `release`, `chore`

**AI agent types:** `cursor`, `ai`, `copilot`, `claude`, `codex`

- Lowercase alphanumerics and hyphens only (dots allowed for release versions).
- No underscores, spaces, uppercase, or consecutive/leading/trailing hyphens.
- Prefer a Linear issue id in the description when applicable (`chore/nan-37-conventional-git`).
- Linear’s suggested `user/nan-N-…` branch name is **not** required; use Conventional Branch instead.
- Cursor Cloud Agent branches `cursor/<name>-9f3e` are valid Conventional Branch AI prefixes.

## Commits

```
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]
```

- `feat` = new capability; `fix` = bug fix; other types (`docs`, `chore`, `refactor`, `test`, …) as needed.
- Breaking changes: `!` after type/scope and/or a `BREAKING CHANGE:` footer.
- Prefer imperative descriptions; include Linear ids when useful (`NAN-37`).
