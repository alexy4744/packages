import { WorkspaceJsonConfiguration } from "@nrwl/devkit";

import { ensureNxProject, readJson, runNxCommandAsync, updateFile } from "@nrwl/nx-plugin/testing";

const createNxProject = (projectName: string) => {
  const projectConfig = {
    projectType: "application",
    targets: {
      build: {
        executor: "@test/test:build",
        options: {
          test: "test"
        }
      }
    }
  };

  updateFile("workspace.json", (content) => {
    const updated = {
      ...JSON.parse(content),
      projects: {
        [projectName]: projectConfig
      }
    };

    return JSON.stringify(updated, null, 2);
  });

  return projectConfig;
};

describe("nx-mikro-orm-cli e2e", () => {
  it("should add target to project config with config path", async () => {
    ensureNxProject("@alexy4744/nx-mikro-orm-cli", "dist/packages/nx-mikro-orm-cli");

    const projectName = "test-project";
    const projectConfig = createNxProject(projectName);

    const cliConfig = {
      configPath: "./mikro-orm.config.js",
      projectName
    };

    const cliArgs = Object.entries(cliConfig)
      .map(([key, value]) => `--${key} ${value}`)
      .join(" ");

    await runNxCommandAsync(`generate @alexy4744/nx-mikro-orm-cli:config ${cliArgs}`);

    const workspaceJson = readJson<WorkspaceJsonConfiguration>("workspace.json");

    expect(workspaceJson.projects[projectName].targets).toStrictEqual({
      ...projectConfig.targets,
      "mikro-orm": {
        executor: "@alexy4744/nx-mikro-orm-cli:run",
        options: {
          config: {
            configPaths: [cliConfig.configPath]
          }
        }
      }
    });
  }, 120000);

  it("should add target to project config with optional properties", async () => {
    ensureNxProject("@alexy4744/nx-mikro-orm-cli", "dist/packages/nx-mikro-orm-cli");

    const projectName = "test-project";
    const projectConfig = createNxProject(projectName);

    const cliConfig = {
      configPath: "./mikro-orm.config.ts",
      projectName,
      tsConfigPath: "./tsconfig.app.json",
      useTsNode: true
    };

    const cliArgs = Object.entries(cliConfig)
      .map(([key, value]) => `--${key} ${value}`)
      .join(" ");

    await runNxCommandAsync(`generate @alexy4744/nx-mikro-orm-cli:config ${cliArgs}`);

    const workspaceJson = readJson<WorkspaceJsonConfiguration>("workspace.json");

    expect(workspaceJson.projects[projectName].targets).toStrictEqual({
      ...projectConfig.targets,
      "mikro-orm": {
        executor: "@alexy4744/nx-mikro-orm-cli:run",
        options: {
          config: {
            configPaths: [cliConfig.configPath],
            tsConfigPath: cliConfig.tsConfigPath,
            useTsNode: cliConfig.useTsNode
          }
        }
      }
    });
  }, 120000);
});
