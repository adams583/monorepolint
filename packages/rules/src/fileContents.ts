/*!
 * Copyright 2020 Palantir Technologies, Inc.
 *
 * Licensed under the MIT license. See LICENSE file in the project root for details.
 *
 */

import { Context } from "@monorepolint/core";
import { RuleModule } from "@monorepolint/core";
import diff from "jest-diff";
import * as path from "path";
import * as r from "runtypes";

const Options = r.Union(
  r.Record({
    file: r.String,
    generator: r.Function,
    template: r.Undefined,
    templateFile: r.Undefined,
  }),

  r.Record({
    file: r.String,
    generator: r.Undefined,
    template: r.String,
    templateFile: r.Undefined,
  }),

  r.Record({
    file: r.String,
    generator: r.Undefined,
    template: r.Undefined,
    templateFile: r.String,
  })
);

type Options = r.Static<typeof Options>;

export const fileContents = {
  check: function expectFileContents(context: Context, opts: Options) {
    const fullPath = path.join(context.packageDir, opts.file);
    const generator = getGenerator(context, opts);
    const expectedContent = generator(context);

    const fs = context.fileSystem;

    const pathExists = fs.exists(fullPath);
    const actualContent = pathExists ? fs.readFile(fullPath, "utf-8") : undefined;
    if (actualContent !== expectedContent) {
      context.addError({
        file: fullPath,
        message: "Expect file contents to match",
        longMessage: diff(expectedContent, actualContent, { expand: true }),
        fixer: () => {
          if (expectedContent === undefined && pathExists) {
            fs.unlink(fullPath);
          } else {
            fs.mkdir(path.dirname(fullPath), { recursive: true });
            fs.writeFile(fullPath, expectedContent);
          }
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
    const template = context.fileSystem.readFile(fullPath, "utf-8");

    return makeGenerator(template);
  } else if (opts.template) {
    return makeGenerator(opts.template);
  } else {
    throw new Error("Unable to make generator");
  }
}

function makeGenerator(template: string) {
  // tslint:disable-next-line:variable-name
  return function generator(_context: Context) {
    return template;
  };
}
