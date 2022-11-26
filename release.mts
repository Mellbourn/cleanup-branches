#!/usr/bin/env npx --yes --package=ts-node -- ts-node-esm --swc

import { $ } from "zx/core";

const { stdout: version } =
  await $`node -p "require('./package.json').version"`;

await $`npm version patch`;
await $`npm publish --access=public`;
await $`git push`;
await $`gh release create v${version}) --generate-notes --draft`;
await $`gh release upload v${version}) index.mts`;
await $`gh release edit v${version}) --draft=false`;
