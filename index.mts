#!/usr/bin/env npx --yes --package=ts-node -- ts-node-esm --swc

import { question, chalk, path, fs, argv, echo } from "zx";
import { $, ProcessOutput } from "zx/core";

if (argv.h) {
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
  -v               Verbose output, including git commands
  --base=<branch>  Use "branch" as the merge target to compare with, instead of "main"
`);
  echo(`Usage: cleanup-branches [options]`);
  process.exit(0);
}

$.verbose = !!argv.v;

const mergeBase: string = argv.base || "main";

const logDir = path.join($.env.HOME!, ".local/state/cleanup-branches");
const logFile = path.join(logDir, "log.txt");
await fs.mkdir(logDir, { recursive: true });
const { stdout: pwd } = await $`pwd`;
await fs.appendFile(logFile, `\n${pwd}`);

// suppress quoting, it doesn't allow for dynamic commands
const q = $.quote;
$.quote = (v) => v;

const linesToArray = (lines: ProcessOutput) =>
  lines.stdout
    .split("\n")
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

const neverDelete = `'^\\*\\|master\\|main\\|${mergeBase}\\|develop\\|hotfix\\|temp\\|[0-9]task'`;

const logStdout = (stdout: string) => {
  if (!argv.v) {
    const trimmedOut = stdout.trim();
    if (trimmedOut.length > 0) {
      console.log(trimmedOut);
    }
  }
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

  const cmd = `${getBranches} | grep  -v ${neverDelete}`;

  let branches: string[] = [];
  try {
    const branchLines = await $`${cmd}`;
    branches = linesToArray(branchLines);
  } catch (p: any) {
    if (p.exitCode !== 1) {
      throw p;
    }
  }
  if (branches.length === 0) {
    console.log(`No branches to delete`);
    return;
  }

  const deleteBranch = remote
    ? "git push origin --delete"
    : "git branch " + (merged ? "-d" : "-D");

  console.warn("Deleting branches: ", branches);
  for (const branch of branches) {
    await showLog(merged, remote, branch);
    const shouldDelete = ask
      ? await question(`delete "${branch}"? [y/N] `)
      : "y";
    if (shouldDelete && shouldDelete[0].toLowerCase() === "y") {
      await remoteDeletionLog(remote, branch);
      const { stdout } = await $`${deleteBranch.split(" ")} ${branch}`;
      logStdout(stdout);
      await fs.appendFile(logFile, stdout);
    }
  }
};

console.log("-----------------> Delete local merged");
await deleteBranches({
  merged: true,
  remote: false,
  ask: false,
});
if (argv.r) {
  console.log(chalk.bold("-----------------> Delete remote merged"));
  await deleteBranches({
    merged: true,
    remote: true,
    ask: false,
  });
}
if (argv.u) {
  console.log(chalk.yellow("-----------------> Delete local unmerged"));
  await deleteBranches({
    merged: false,
    remote: false,
    ask: true,
  });
  if (argv.r) {
    console.log(chalk.yellow.bold("-----------------> Delete remote unmerged"));
    await deleteBranches({
      merged: false,
      remote: true,
      ask: true,
    });
  }
}
