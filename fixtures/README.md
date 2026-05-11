# Fixtures

Cached, **unmodified** snapshots of real CRAN pages used to demo
the `cran-modern.css` overlay.

## Provenance

Snapshots taken with `scripts/fetch-fixtures.sh` from
<https://cran.r-project.org/>. Re-run that script to refresh.

| File | Source URL |
|---|---|
| `home.html` | `https://cran.r-project.org/` (root frameset; `/doc/html/index.html` returns 404 as of 2026-05) |
| `packages-by-name.html` | `https://cran.r-project.org/web/packages/available_packages_by_name.html` |
| `package-dplyr.html` | `https://cran.r-project.org/web/packages/dplyr/index.html` |
| `view-MachineLearning.html` | `https://cran.r-project.org/web/views/MachineLearning.html` |
| `mirrors.html` | `https://cran.r-project.org/mirrors.html` |

## Robots policy

`cran.r-project.org/robots.txt` permits human browsers but
discourages crawlers. The fetch script uses a normal browser
User-Agent and is run interactively, not on a schedule. Snapshots
are kept locally for documentation purposes only and are not
republished as a mirror.

## Fetch deviations (2026-05-10)

### `home.html` URL changed
The script targets `$BASE/doc/html/index.html` but that path now returns HTTP 404.
`home.html` was fetched from `https://cran.r-project.org/` (the root frameset) instead.
Update `scripts/fetch-fixtures.sh` if the intended URL ever becomes reachable again.

### bash 3.2 incompatibility on macOS
`fetch-fixtures.sh` uses `declare -A` (associative arrays), which requires bash 4+.
macOS ships bash 3.2. The initial fetch was performed by running the equivalent
`curl` commands individually. The script itself is correct for bash 4+ environments
(Linux, CI). Install bash via Homebrew (`brew install bash`) to run the script as
intended on macOS.

## Modification

These files are **not edited**. The whole point of the demo is
that `cran-modern.css` works against unmodified, live CRAN HTML.
If a snapshot needs updating, refresh it via the script and
commit the new bytes verbatim.
