module.exports = {
  projects: [
    "<rootDir>/packages/nestjs-request-context",
    "<rootDir>/packages/nestjs-request-context-e2e",
    "<rootDir>/packages/nx-mikro-orm-cli",
    "<rootDir>/packages/nx-mikro-orm-cli-e2e",
    "<rootDir>/packages/nestjs-nats-jetstream-transporter"
  ],
  setupFilesAfterEnv: ["jest-extended"]
};
