#!/usr/bin/env npx --yes --package=ts-node -- ts-node-esm --swc

import { $ } from "zx/core";

await $`npm version patch`;

const { stdout } = await $`node -p "require('./package.json').version"`;
const tag = `v${stdout.trim()}`;

await $`npm publish --access=public`;

await $`git push --tags`;

await $`gh release create ${tag} --generate-notes ./index.mts#cleanup-branches`;
