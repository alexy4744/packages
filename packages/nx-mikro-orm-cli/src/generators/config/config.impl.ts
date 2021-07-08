import {
  Tree,
  formatFiles,
  readProjectConfiguration,
  updateProjectConfiguration
} from "@nrwl/devkit";

import { MikroOrmGeneratorSchema } from "./schema";

export default async (host: Tree, options: MikroOrmGeneratorSchema) => {
  const project = readProjectConfiguration(host, options.projectName);

  project.targets = project.targets || {};

  project.targets["mikro-orm"] = {
    executor: "@alexy4744/nx-mikro-orm-cli:run",
    options: {
      config: {
        configPaths: [options.configPath],
        tsConfigPath: options.tsConfigPath,
        useTsNode: options.useTsNode
      }
    }
  };

  updateProjectConfiguration(host, options.projectName, project);

  await formatFiles(host);
};
