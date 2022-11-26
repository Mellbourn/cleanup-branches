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

const branchExists = async (name: string) => {
  try {
    const { exitCode } = await $`git show-ref --quiet refs/heads/${name}`;
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

console.log(chalk.bold("****************** ACT **********************"));

await $`${workingDir}/index.mts`;

console.log(chalk.bold("****************** ASSERT *******************"));

if (!(await branchExists("current"))) {
  console.log(
    chalk.red(
      "current branch should not have been deleted, since it is currently checked out"
    )
  );
}

if (await branchExists("merged1")) {
  console.log(
    chalk.red("merged1 should have been deleted, since it is merged")
  );
}

if (!(await branchExists("unmerged1"))) {
  console.log(chalk.red("unmerged branches should still exist"));
}

console.log(chalk.bold("****************** REPORT ********************"));
await $`git lol --color=always`;

console.log(chalk.bold("****************** ACT **********************"));

await $`echo $(yes y | ${workingDir}/index.mts -r -u)`;

console.log(chalk.bold("****************** ASSERT *******************"));

if (await branchExists("unmerged1")) {
  console.log(chalk.red("unmerged branches should be deleted"));
}

if (await branchExists("unmergedPushed1")) {
  console.log(
    chalk.red(
      "unmerged branches should be deleted even if they have been pushed"
    )
  );
}
if (await branchExists("origin/unmergedPushed1")) {
  console.log(
    chalk.red(
      "unmerged remote branches should be deleted even if they have been pushed"
    )
  );
}

console.log(chalk.bold("****************** REPORT ********************"));
await $`git lol --color=always`;

await $`git switch current`;
await addCommittedFile("another.txt");
await $`git switch -c master`;

console.log(chalk.bold("****************** ACT **********************"));

await $`${workingDir}/index.mts`;

console.log(chalk.bold("****************** ASSERT *******************"));

if (!(await branchExists("current"))) {
  console.log(chalk.red("branch not merged to main should not be deleted"));
}

console.log(chalk.bold("****************** ACT **********************"));

await $`${workingDir}/index.mts --base=master`;

if (await branchExists("current")) {
  console.log(chalk.red("branch merged to master should be deleted"));
}
