#!/usr/bin/env npx --yes --package=ts-node -- ts-node-esm --swc

import { chalk, fs, argv, echo } from "zx";
import { $, cd } from "zx/core";

const workingDir = process.cwd();
const { stdout } = await $`mktemp -d /tmp/cleanup-test.$(date -u +%FT%T).XX`;
const testDir = stdout.trim();
cd(testDir);
const repo = "Mellbourn/cleanup-branches-test";
await $`gh repo clone ${repo} .`;

const addCommittedFile = async (name: string) => {
  if (!fs.existsSync(name)) {
    fs.writeFileSync(name, `content of ${name}`);
    await $`git add ${name}`;
    await $`git commit -m "commit ${name}"`;
  }
};

const branchExists = async (name: string, remote: boolean = false) => {
  try {
    const { exitCode } = await $`git show-ref --quiet ${
      remote ? `refs/remotes/origin/${name}` : `refs/heads/${name}`
    }`;
    return exitCode === 0;
  } catch (p) {
    return false;
  }
};

const createBranch = async (
  name: string,
  isMerged = true,
  isPushed = false
) => {
  await $`git switch main`;
  if (await branchExists(name)) {
    try {
      await $`git push origin --delete ${name}`;
    } catch (p: any) {
      console.log(`No branch to delete (${p.exitCode})`);
    }
    await $`git branch -D ${name}`;
  }
  await $`git switch -c ${name}`;
  if (!isMerged) {
    await addCommittedFile(`${name}.txt`);
  }
  if (isPushed) {
    await $`git push --force -u origin ${name}`;
  }
  await $`git switch main`;
};

await $`git switch main`;
await addCommittedFile("firstFile.txt");
await $`git push -u origin main`;

await createBranch("unmerged1", false);
await createBranch("merged1");
await createBranch("unmergedPushed1", false, true);
await createBranch("mergedPushed1", true, true);

await createBranch("current");
await $`git switch current`;

if (argv.e) {
  echo(`Test environment created at ${testDir}`);
  process.exit(0);
}

const logError = (message: string) => {
  console.error(chalk.red(message));
  process.exit(1);
};
const logTitle = (message: string) => console.log(chalk.bold(message));

logTitle("****************** ACT dry run **********************");

await $`${workingDir}/index.mts -d -n`;

logTitle("****************** ASSERT *******************");

if (!(await branchExists("merged1"))) {
  logError("merged1 should not have been deleted, since this is a dry run");
}

logTitle("****************** ACT default **********************");

await $`${workingDir}/index.mts -d`;

logTitle("****************** ASSERT *******************");

if (!(await branchExists("current"))) {
  logError(
    "current branch should not have been deleted, since it is currently checked out"
  );
}

if (await branchExists("merged1")) {
  logError("merged1 should have been deleted, since it is merged");
}

if (!(await branchExists("unmerged1"))) {
  logError("unmerged branches should still exist");
}

if (!(await branchExists("unmergedPushed1", true))) {
  logError(
    "unmerged remote branches should not be deleted even if they have been pushed"
  );
}
logTitle("****************** REPORT ********************");
await $`git lol --color=always`;

logTitle(
  "****************** ACT remote and unmerged default age **********************"
);

await $`${workingDir}/index.mts -d -r -u`;

logTitle("****************** ASSERT *******************");

if (!(await branchExists("unmerged1"))) {
  logError("new unmerged branches should not be deleted");
}
if (!(await branchExists("unmergedPushed1"))) {
  logError(
    "new unmerged branches should not be deleted even if they have been pushed"
  );
}
if (!(await branchExists("unmergedPushed1", true))) {
  logError(
    "new unmerged remote branches should not be deleted even if they have been pushed"
  );
}

logTitle(
  "****************** ACT remote and unmerged default age **********************"
);

await $`echo $(yes y | ${workingDir}/index.mts -d --age="1 seconds" -r -u)`;

logTitle("****************** ASSERT *******************");

if (await branchExists("unmerged1")) {
  logError("unmerged branches should be deleted");
}
if (await branchExists("unmergedPushed1")) {
  logError("unmerged branches should be deleted even if they have been pushed");
}
if (await branchExists("unmergedPushed1", true)) {
  logError(
    "unmerged remote branches should be deleted even if they have been pushed"
  );
}

logTitle("****************** REPORT ********************");
await $`git lol --color=always`;

await $`git switch current`;
await addCommittedFile("another.txt");
await $`git switch -c master`;

logTitle("****************** ACT **********************");

await $`${workingDir}/index.mts -d --age="1 seconds"`;

logTitle("****************** ASSERT *******************");

if (!(await branchExists("current"))) {
  logError("branch not merged to main should not be deleted");
}

logTitle("****************** ACT specified base **********************");

await $`${workingDir}/index.mts -d --age="1 seconds" --base=master`;

if (await branchExists("current")) {
  logError("branch merged to master should be deleted");
}
