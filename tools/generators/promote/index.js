const { Tree, formatFiles, names } = require("@nx/devkit");
const { toNames, default: boundedContextGenerator } = require("../bounded-context/index");
const fs = require("fs");
const path = require("path");

async function promoteGenerator(tree, options) {
  const n = toNames(options);
  const root = `apps/${n.appName}`;
  
  if (!tree.exists(`${root}/deploy.toml`)) {
    throw new Error(`Module ${n.appName} not found at ${root}`);
  }

  // Identify minimal files to remove
  const pkgRoot = `${root}/backend/${n.backendPackageName}`;
  const filesToRemove = [
    `${pkgRoot}/main.py`,
    `${pkgRoot}/routers/__init__.py`,
    `${pkgRoot}/routers/module.py`,
    `${root}/frontend/src/App.tsx`,
    `${root}/frontend/src/Page.tsx`,
  ];

  for (const f of filesToRemove) {
    if (tree.exists(f)) {
      tree.delete(f);
    }
  }

  // Run the full generator
  await boundedContextGenerator(tree, { ...options, minimal: false });
}

module.exports = promoteGenerator;
module.exports.default = promoteGenerator;
