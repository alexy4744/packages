import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as util from "util";

import { ExecutorContext } from "@nrwl/devkit";

import { MikroOrmExecutorSchema } from "./schema";

const exec = util.promisify(child_process.exec);

export const fileExists = async (path) => !!(await fs.promises.stat(path).catch(() => false));

export const renameExistingPackageJson = async (
  packageJsonPath: string
): Promise<string | null> => {
  if (!(await fileExists(packageJsonPath))) {
    return null;
  }

  const renamedPath = `${packageJsonPath}.${Date.now()}`;

  await fs.promises.rename(packageJsonPath, renamedPath);

  return renamedPath;
};

export default async (options: MikroOrmExecutorSchema, context: ExecutorContext) => {
  const project = context.workspace.projects[context.projectName];

  const binPath = path.join(context.root, "node_modules", ".bin", "mikro-orm");
  const projectPath = path.join(context.root, project.root);
  const projectPackageJsonPath = path.join(projectPath, "package.json");

  // Rename the package.json if one already exists in the project root
  const renamedPackageJsonPath = await renameExistingPackageJson(projectPackageJsonPath);

  const shim = JSON.stringify({
    "mikro-orm": options.config
  });

  await fs.promises.writeFile(projectPackageJsonPath, shim);

  try {
    const { stderr, stdout } = await exec(`${binPath} ${options.args}`, {
      cwd: projectPath
    });

    process.stderr.write(stderr);
    process.stdout.write(stdout);
  } finally {
    // Delete the generated package json shim
    await fs.promises.rm(projectPackageJsonPath);

    // If an existing package.json was renamed, then restore its original name
    if (renamedPackageJsonPath) {
      await fs.promises.rename(renamedPackageJsonPath, projectPackageJsonPath);
    }
  }

  return {
    success: true
  };
};
