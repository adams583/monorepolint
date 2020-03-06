/*!
 * Copyright 2020 Palantir Technologies, Inc.
 *
 * Licensed under the MIT license. See LICENSE file in the project root for details.
 *
 */

import { Context, RuleModule } from "@monorepolint/core";
import diff from "jest-diff";
import minimatch from "minimatch";
import * as r from "runtypes";

const Options = r.Record({
  bannedDependencies: r.Array(r.String),
});

type Options = r.Static<typeof Options>;

export const bannedDependencies: RuleModule<typeof Options> = {
  check: function expectAllowedDependencies(context: Context, opts: Options) {
    // tslint:disable-next-line:no-shadowed-variable
    const { bannedDependencies } = opts;

    checkBanned(context, bannedDependencies, "dependencies");
    checkBanned(context, bannedDependencies, "devDependencies");
    checkBanned(context, bannedDependencies, "peerDependencies");
  },
  optionsRuntype: Options,
};

function checkBanned(
  context: Context,
  // tslint:disable-next-line:no-shadowed-variable
  bannedDependencies: ReadonlyArray<string>,
  block: "dependencies" | "devDependencies" | "peerDependencies"
) {
  const packageJson = context.getPackageJson();
  const packagePath = context.getPackageJsonPath();

  const dependencies = packageJson[block];

  if (dependencies === undefined) {
    return;
  }

  const expectedDependencies: Record<string, string> = {};

  for (const dependency of Object.keys(dependencies)) {
    for (const bannedDependency of bannedDependencies) {
      if (!minimatch(dependency, bannedDependency)) {
        expectedDependencies[dependency] = dependencies[dependency];
      }
    }
  }

  if (Object.keys(expectedDependencies).length !== Object.keys(dependencies).length) {
    context.addError({
      file: packagePath,
      message: `Banned depdendencies in ${block} in package.json`,
      longMessage: diff(expectedDependencies, dependencies, { expand: true }),
      fixer: () => {
        const newPackageJson = { ...packageJson };
        newPackageJson[block] = expectedDependencies;
        context.fileSystem.writeJson(packagePath, newPackageJson);
      },
    });
  }
}
