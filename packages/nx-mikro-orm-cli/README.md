# NX MikroORM CLI Executor

A NX executor that creates `package.json` shims before running the MikroORM CLI. See this [issue](https://github.com/mikro-orm/mikro-orm/issues/545) for more details.

## Prerequisites

- MikroORM >= 4.5.6 (Recommended, see [#1792](https://github.com/mikro-orm/mikro-orm/issues/1792))

## Installation

```bash
$ npm install --save-dev @alexy4744/nx-mikro-orm-cli
```

## Running the generator

```bash
$ nx generate @alexy4744/nx-mikro-orm-cli:config
```

The generator will add a target called `mikro-orm` under the specified project in your `workspace.json` with your desired CLI config.

## Running the executor

All MikroORM CLI arguments must be passed via the `--args` flag.

```bash
# Original MikroORM command
$ mikro-orm schema:update --run

# NX executor format
$ nx mikro-orm my-project --args="schema:update --run"
```

The executor will follow these steps:

1. Create a `package.json` shim in your project root containing your MikroORM CLI config
2. Run the actual MikroORM CLI in your project root
3. Delete the `package.json` shim

If there is already a `package.json` in your project root (which shouldn't be the case in most cases), the executor will:

1. Rename the existing `package.json` to `package.json.${Date.now()}`
2. Create the `package.json` shim in your project root containing your MikroORM CLI config
3. Run the actual MikroORM CLI in your project root
4. Delete the `package.json` shim
5. Rename the `package.json.${Date.now()}` back to `package.json`

## Running tests

Run `nx test nx-mikro-orm-cli` to execute the unit tests via [Jest](https://jestjs.io).  
Run `nx run nx-mikro-orm-cli-e2e:e2e` to execute e2e test for the generator.
