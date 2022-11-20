# cleanup-branches

`cleanup-branches` is a cli tool to interactively remove old branches from git.

It automatically removes merged branches, locally and remotely. It then prompts for each unmerged branch whether you want to remove it or not.

## Installation

Note, this script is written using <https://github.com/google/zx> and requires zx to be installed globally.

```bash
npm install -g zx
```

Then install the script:

```bash
npm install -g cleanup-branches
```
