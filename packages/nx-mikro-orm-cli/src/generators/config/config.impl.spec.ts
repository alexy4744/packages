import { Tree, addProjectConfiguration, readProjectConfiguration } from "@nrwl/devkit";

import { createTreeWithEmptyWorkspace } from "@nrwl/devkit/testing";

import generator from "./config.impl";

describe("MikroORM CLI Config Generator", () => {
  const projectName = "test-project";

  let host: Tree;

  beforeEach(() => {
    host = createTreeWithEmptyWorkspace();

    addProjectConfiguration(host, projectName, {
      projectType: "application",
      root: `./apps/${projectName}`,
      sourceRoot: `./apps/${projectName}/src`,
      targets: {
        build: {
          executor: "@test/test:build",
          options: {
            test: "test"
          }
        }
      }
    });
  });

  it("should create a target with only the config path", async () => {
    const projectConfiguration = readProjectConfiguration(host, projectName);

    const options = {
      configPath: "./mikro-orm.config.js",
      projectName
    };

    await generator(host, options);

    expect(readProjectConfiguration(host, projectName)).toStrictEqual({
      ...projectConfiguration,
      targets: {
        ...projectConfiguration.targets,
        "mikro-orm": {
          executor: "@alexy4744/nx-mikro-orm-cli:run",
          options: {
            config: {
              configPaths: [options.configPath]
            }
          }
        }
      }
    });
  });

  it("should create a target with optional properties", async () => {
    const projectConfiguration = readProjectConfiguration(host, projectName);

    const options = {
      configPath: "./mikro-orm.config.ts",
      projectName,
      tsConfigPath: "./tsconfig.json",
      useTsNode: true
    };

    await generator(host, options);

    expect(readProjectConfiguration(host, projectName)).toStrictEqual({
      ...projectConfiguration,
      targets: {
        ...projectConfiguration.targets,
        "mikro-orm": {
          executor: "@alexy4744/nx-mikro-orm-cli:run",
          options: {
            config: {
              configPaths: [options.configPath],
              tsConfigPath: options.tsConfigPath,
              useTsNode: options.useTsNode
            }
          }
        }
      }
    });
  });
});
