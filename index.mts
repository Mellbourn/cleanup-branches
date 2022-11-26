#!/usr/bin/env npx --yes --package=ts-node -- ts-node-esm --swc

import { question, chalk, path, fs, argv, echo } from "zx";
import { $, ProcessOutput } from "zx/core";

const {
  d: debug,
  r: removeRemote,
  u: removeUnmerged,
  h: help,
  n: dryRun,
  v: showVersion,
  base,
} = argv;

const age = argv.age || "2 weeks";

if (help) {
  echo(`cleanup-branches`);
  echo(`A cli tool to interactively remove old branches from git.

It automatically removes merged branches, locally and remotely. It prompts for each unmerged branch whether you want to remove it or not.

By default, it is assumed that the main branch that should be merged to is named main, not master. If this is not correct, use the --branch parameter (e.g. --branch=master).

The name and commit hash of deleted branches are printed to stdout and logged to the log file at .local/state/cleanup-branches/log.txt

Usage: cleanup-branches [options]

Options:
  -h               Show this help message and exit
  -r               Also remove remote branches
  -u               Also remove unmerged branches, interactively
  --age=<age>      Minimum age to remove unmerged branches, e.g. "5 days" or "1 month". Defaults to "2 weeks".
  -n               Dry-run, do nothing, just print what would be done
  -d               Verbose debug output, including git commands
  --base=<branch>  Use "branch" as the merge target to compare with, instead of "main"
`);
  echo(`Usage: cleanup-branches [options]`);
  process.exit(0);
}

$.verbose = !!debug;

if (showVersion) {
  console.log(process.env.npm_package_version);
  process.exit(0);
}

const mergeBase: string = base || "main";

const logDir = path.join($.env.HOME!, ".local/state/cleanup-branches");
const logFile = path.join(logDir, "log.txt");
if (!dryRun) {
  await fs.mkdir(logDir, { recursive: true });
  const { stdout: pwd } = await $`pwd`;
  await fs.appendFile(logFile, `\n${pwd}`);
}

// suppress quoting, it doesn't allow for dynamic commands
const q = $.quote;
$.quote = (v) => v;

const linesToArray = (lines: ProcessOutput) =>
  lines.stdout
    .split("\n")
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

const neverDelete = `'^\\*|^\\+| HEAD |^[ ]*(master|main|${mergeBase}|develop|hotfix|temp|[0-9]task)$'`;

const logStdout = (stdout: string) => {
  if (!debug) {
    const trimmedOut = stdout.trim();
    if (trimmedOut.length > 0) {
      console.log(trimmedOut);
    }
  }
};

const tooNew = async (
  merged: boolean,
  remote: boolean,
  branch: string,
  age: string
): Promise<boolean> => {
  if (merged) {
    return false;
  }
  const { stdout } = await $`git log --no-walk --before="${age}" ${
    (remote ? "origin/" : "") + branch
  }`;
  return stdout.trim().length === 0;
};

const showLog = async (merged: boolean, remote: boolean, branch: string) => {
  if (!merged) {
    const { stdout } = await $`git log origin/${mergeBase}..${
      (remote ? "origin/" : "") + branch
    }`;
    logStdout(stdout);
  }
};

const remoteDeletionLog = async (remote: boolean, branch: string) => {
  if (remote) {
    const { stdout } = await $`git log -1 --format=%h origin/${branch}`;
    const remoteDeleteLog = `Deleted branch origin/${branch} (was ${stdout.trim()}).`;
    console.log(remoteDeleteLog);
    await fs.appendFile(logFile, remoteDeleteLog + "\n");
  }
};

const deleteBranches = async ({
  merged,
  remote,
  ask,
}: {
  merged: boolean;
  remote: boolean;
  ask: boolean;
}) => {
  const getBranches = `git branch ${remote ? "-r" : ""} ${
    merged ? "--merged" : "--no-merged"
  } ${remote ? `origin/${mergeBase}` : mergeBase} ${
    remote ? ' | sd origin/ ""' : ""
  }`;

  const cmd = `${getBranches} | egrep  -v ${neverDelete}`;

  let branches: string[] = [];
  try {
    const branchLines = await $`${cmd}`;
    branches = linesToArray(branchLines);
  } catch (p: any) {
    if (p.exitCode !== 1) {
      throw p;
    }
  }
  const oldBranches: string[] = [];
  for (const branch of branches) {
    if (await tooNew(merged, remote, branch, age)) {
      continue;
    }
    oldBranches.push(branch);
  }

  if (oldBranches.length === 0) {
    console.log(`No branches to delete`);
    return;
  }

  const deleteBranch = remote
    ? "git push origin --delete"
    : "git branch " + (merged ? "-d" : "-D");

  console.warn("Deleting branches: ", oldBranches);
  for (const branch of oldBranches) {
    if (await tooNew(merged, remote, branch, age)) {
      continue;
    }
    await showLog(merged, remote, branch);
    const shouldDelete = ask
      ? await question(`delete "${branch}"? [y/N] `)
      : "y";
    if (shouldDelete && shouldDelete[0].toLowerCase() === "y") {
      if (dryRun) {
        console.log(`Would delete ${branch}`);
      } else {
        await remoteDeletionLog(remote, branch);
        const { stdout } = await $`${deleteBranch.split(" ")} ${branch}`;
        logStdout(stdout);
        await fs.appendFile(logFile, stdout);
      }
    }
  }
};

console.log("-----------------> Delete local merged");
await deleteBranches({
  merged: true,
  remote: false,
  ask: false,
});
if (removeRemote) {
  console.log(chalk.bold("-----------------> Delete remote merged"));
  await deleteBranches({
    merged: true,
    remote: true,
    ask: false,
  });
}
if (removeUnmerged) {
  console.log(chalk.yellow("-----------------> Delete local unmerged"));
  await deleteBranches({
    merged: false,
    remote: false,
    ask: true,
  });
  if (removeRemote) {
    console.log(chalk.yellow.bold("-----------------> Delete remote unmerged"));
    await deleteBranches({
      merged: false,
      remote: true,
      ask: true,
    });
  }
}
