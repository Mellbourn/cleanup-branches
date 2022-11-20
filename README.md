# cleanup-branches

`cleanup-branches` is a cli tool to interactively remove old branches from git.

It automatically removes merged branches, locally and remotely. It then prompts for each unmerged branch whether you want to remove it or not.

It is assumed that the main branch that should be merged to is named `main`, not `master`.

## Installation

```bash
npm install -g cleanup-branches
```
