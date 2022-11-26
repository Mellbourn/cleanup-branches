# cleanup-branches

It automatically removes merged branches, locally and remotely. It prompts for each unmerged branch whether you want to remove it or not.

By default, it is assumed that the main branch that should be merged to is named main, not master. If this is not correct, use the `--branch` parameter (e.g. `--branch=master`).

The name and commit hash of deleted branches are printed to stdout and logged to the log file at `.local/state/cleanup-branches/log.txt`

```text
Usage: cleanup-branches [options]

Options:
  -h               Show this help message and exit
  -r               Also remove remote branches
  -u               Also remove unmerged branches, interactively
  --age=<age>      Minimum age to remove unmerged branches, e.g. "5 days" or "1 month". Defaults to "2 weeks".
  -v               Verbose output, including git commands
  --base=<branch>  Use "branch" as the merge target to compare with, instead of "main"
```

## Installation

```bash
npm install -g cleanup-branches
```
