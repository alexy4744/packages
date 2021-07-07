import "jest-extended";

import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";

import { ExecutorContext, WorkspaceJsonConfiguration } from "@nrwl/devkit";

import { createMock } from "@golevelup/ts-jest";

import * as executor from "./run.impl";

jest.mock("child_process", () => ({
  ...Object.assign({}, jest.requireActual("child_process")),
  exec: jest.fn((_command, _options, callback) => {
    callback(null, {
      stderr: "",
      stdout: ""
    });
  })
}));

jest.mock("fs", () => ({
  ...Object.assign({}, jest.requireActual("fs")),
  promises: {
    rename: jest.fn(),
    rm: jest.fn(),
    stat: jest.fn().mockResolvedValue({}),
    writeFile: jest.fn()
  }
}));

describe("MikroORM CLI Executor", () => {
  let context: ExecutorContext;

  let binPath: string;
  let packageJsonPath: string;
  let projectPath: string;

  beforeEach(() => {
    const projectName = "test-project";

    context = createMock<ExecutorContext>({
      projectName,
      root: "/home/my-app",
      workspace: createMock<WorkspaceJsonConfiguration>({
        projects: {
          [projectName]: {
            root: `./apps/${projectName}`
          }
        }
      })
    });

    binPath = path.join(context.root, "node_modules", ".bin", "mikro-orm");
    projectPath = path.join(context.root, context.workspace.projects[projectName].root);
    packageJsonPath = path.join(projectPath, "package.json");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("runs CLI with config options", async () => {
    const input = {
      args: "debug --help",
      config: {
        configPaths: ["./mikro-orm.config.ts"],
        tsConfigPath: "./tsconfig.json",
        useTsNode: true
      }
    };

    const output = await executor.default(input, context);

    const shim = JSON.stringify({
      "mikro-orm": input.config
    });

    const execArgs = [`${binPath} ${input.args}`, { cwd: projectPath }, expect.any(Function)];

    expect(fs.promises.writeFile).toHaveBeenCalledWith(packageJsonPath, shim);
    expect(child_process.exec).toHaveBeenCalledWith(...execArgs);
    expect(fs.promises.rm).toHaveBeenCalledWith(packageJsonPath);

    expect(fs.promises.writeFile).toHaveBeenCalledBefore(child_process.exec as never);
    expect(fs.promises.rm).toHaveBeenCalledAfter(child_process.exec as never);

    expect(output.success).toBe(true);
  });

  it("renames existing package.json before creating shim", async () => {
    jest.spyOn(Date, "now").mockReturnValue(123);
    jest.spyOn(executor, "fileExists").mockResolvedValue(true);

    const input = {
      args: "debug --help",
      config: {
        configPaths: ["./mikro-orm.config.ts"],
        tsConfigPath: "./tsconfig.json",
        useTsNode: true
      }
    };

    const output = await executor.default(input, context);

    const shim = JSON.stringify({
      "mikro-orm": input.config
    });

    const execArgs = [`${binPath} ${input.args}`, { cwd: projectPath }, expect.any(Function)];

    expect(fs.promises.writeFile).toHaveBeenCalledWith(packageJsonPath, shim);
    expect(child_process.exec).toHaveBeenCalledWith(...execArgs);
    expect(fs.promises.rm).toHaveBeenCalledWith(packageJsonPath);

    expect(fs.promises.rename).toBeCalledTimes(2);
    expect(fs.promises.rename).toHaveBeenNthCalledWith(1, packageJsonPath, `${packageJsonPath}.123`); // prettier-ignore
    expect(fs.promises.rename).toHaveBeenNthCalledWith(2, `${packageJsonPath}.123`, packageJsonPath); // prettier-ignore

    expect(fs.promises.rename).toHaveBeenCalledBefore(fs.promises.writeFile as never);
    expect(fs.promises.writeFile).toHaveBeenCalledBefore(child_process.exec as never);
    expect(fs.promises.rm).toHaveBeenCalledAfter(child_process.exec as never);

    expect(output.success).toBe(true);
  });
});
