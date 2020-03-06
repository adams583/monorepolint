/*!
 * Copyright 2020 Palantir Technologies, Inc.
 *
 * Licensed under the MIT license. See LICENSE file in the project root for details.
 *
 */

import { Context, RuleModule } from "@monorepolint/core";
import diff from "jest-diff";
import minimatch from "minimatch";
import * as path from "path";
import * as r from "runtypes";

const Options = r
  .Partial({
    generator: r.Function,
    template: r.Record({}).Or(r.String),
    templateFile: r.String,
    excludedReferences: r.Array(r.String).Or(r.Undefined),
  })
  .withConstraint(({ generator, template, templateFile }) => {
    let count = 0;
    if (generator) {
      count++;
    }
    if (template) {
      count++;
    }
    if (templateFile) {
      count++;
    }

    return count === 1 || "Expect one of { generator, template, templateFile }";
  });

export type Options = r.Static<typeof Options>;

export const standardTsconfig = {
  check: function expectStandardTsconfig(context: Context, opts: Options) {
    const fullPath = path.resolve(context.packageDir, "tsconfig.json");
    const generator = getGenerator(context, opts);
    const expectedContent = generator(context);
    const fs = context.fileSystem;

    const actualContent = fs.exists(fullPath) ? fs.readFile(fullPath, "utf-8") : undefined;

    if (expectedContent === undefined) {
      context.addWarning({
        file: fullPath,
        message: "Excluding from expect-standard-tsconfig",
      });
      return;
    }

    if (actualContent !== expectedContent) {
      context.addError({
        file: fullPath,
        message: "Expect file contents to match",
        longMessage: diff(expectedContent, actualContent, { expand: true }),
        fixer: () => {
          fs.writeFile(fullPath, expectedContent);
        },
      });
    }
  },
  optionsRuntype: Options,
} as RuleModule<typeof Options>;

function getGenerator(context: Context, opts: Options) {
  if (opts.generator) {
    return opts.generator;
  } else if (opts.templateFile) {
    const { packageDir: workspacePackageDir } = context.getWorkspaceContext();
    const fullPath = path.resolve(workspacePackageDir, opts.templateFile);
    const template = context.fileSystem.readJson(fullPath);

    return makeGenerator(template, opts.excludedReferences);
  } else if (opts.template) {
    return makeGenerator(opts.template, opts.excludedReferences);
  } else {
    throw new Error("Unable to make generator");
  }
}

function makeGenerator(template: any, excludedReferences: ReadonlyArray<string> = []) {
  return function generator(context: Context) {
    template = {
      ...template,
      references: [],
    }; // make a copy and ensure we have a references array

    const nameToDirectory = context.fileSystem.getPackageNameToDir(context.getWorkspaceContext().packageDir);

    const packageJson = context.getPackageJson();
    const deps = [...Object.keys(packageJson.dependencies || {}), ...Object.keys(packageJson.devDependencies || {})];

    deps
      .filter(
        name => nameToDirectory.has(name) && !excludedReferences.some(excludedRef => minimatch(name, excludedRef))
      )
      .forEach(packageName => {
        template.references.push({
          path: path.relative(context.packageDir, nameToDirectory.get(packageName)!),
        });
      });

    return JSON.stringify(template, undefined, 2) + "\n";
  };
}
