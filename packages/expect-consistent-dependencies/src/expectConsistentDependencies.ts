/*!
 * Copyright (c) 2018 monorepo-lint (http://monorepo-lint.com). All Right Reserved.
 *
 * Licensed under the MIT license. See LICENSE file in the project root for details.
 *
 */

import { Context, RuleModule } from "@monorepo-lint/core";
import { writeJson } from "@monorepo-lint/utils";
import diff from "jest-diff";
import * as r from "runtypes";

export const Options = r.Undefined;
export type Options = r.Static<typeof Options>;

export default {
  check: function expectConsistentDependencies(context: Context) {
    checkDeps(context, "dependencies");
    checkDeps(context, "devDependencies");
    // we don't check peer deps since they can be more lenient
  },
  optionsRuntype: Options
} as RuleModule<typeof Options>;

function checkDeps(
  context: Context,
  block: "dependencies" | "devDependencies" | "peerDependencies"
) {
  const packageJson = context.getPackageJson();
  const packagePath = context.getPackageJsonPath();
  const dependencies = packageJson[block];

  const workspacePackageJson = context.getWorkspaceContext().getPackageJson();
  const workspaceDependencies = workspacePackageJson[block];

  if (dependencies === undefined || workspaceDependencies === undefined) {
    return;
  }

  const expectedDependencies = {
    ...dependencies,
    ...filterKeys(workspaceDependencies, dependencies)
  };

  if (JSON.stringify(dependencies) !== JSON.stringify(expectedDependencies)) {
    context.addError({
      file: packagePath,
      message: `Inconsitent ${block} with root in package.json`,
      longMessage: diff(expectedDependencies, dependencies, { expand: true }),
      fixer: () => {
        const newPackageJson = { ...packageJson };
        newPackageJson[block] = expectedDependencies;
        writeJson(packagePath, newPackageJson);
      }
    });
  }
}

function filterKeys(
  ob: Record<string, string>,
  filterOb: Record<string, string>
) {
  const newOb: Record<string, any> = {};

  for (const key of Object.keys(filterOb)) {
    if (ob[key] !== undefined) {
      newOb[key] = ob[key];
    }
  }

  return newOb;
}
