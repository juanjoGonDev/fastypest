const fs = require("fs");
const path = require("path");
const { createScriptLogger } = require("./logger");

const LOG_SCOPE = "pre-commit";
const LOG_MESSAGE_COMMAND_ERROR = "Error executing command";
const LOG_MESSAGE_REMOVED_DIRECTORY = "Removed test-install directory";
const LOG_MESSAGE_BUILDING_PACKAGE = "Building the package";
const LOG_MESSAGE_PACKING_PACKAGE = "Packing the package";
const LOG_MESSAGE_INITIALIZING_PROJECT = "Initializing test-install project";
const LOG_MESSAGE_ADDING_TARBALL = "Adding tarball as dev dependency";
const LOG_MESSAGE_SUCCESS = "Pre-commit install test succeeded";
const LOG_MESSAGE_FAILURE = "Pre-commit check failed";
const METADATA_KEY_COMMAND = "command";
const METADATA_KEY_ARGUMENTS = "args";
const METADATA_KEY_ERROR = "error";

const logger = createScriptLogger(LOG_SCOPE);

const run = async (command, args = [], options = { stdio: "inherit" }) => {
  const { execa } = await import("execa");
  try {
    const { stdout } = await execa(command, args, options);
    return stdout;
  } catch (err) {
    logger.error(LOG_MESSAGE_COMMAND_ERROR, {
      [METADATA_KEY_COMMAND]: command,
      [METADATA_KEY_ARGUMENTS]: args,
      [METADATA_KEY_ERROR]: err.stderr || err.message || err,
    });
    throw err;
  }
};

const testInstallDir = path.join(__dirname, "..", "test-install");
const packagePath = path.join(testInstallDir, "package.tar.gz");

const cleanUp = () => {
  if (fs.existsSync(testInstallDir)) {
    fs.rmSync(testInstallDir, { recursive: true, force: true });
    logger.info(LOG_MESSAGE_REMOVED_DIRECTORY);
  }
};

(async () => {
  try {
    logger.info(LOG_MESSAGE_BUILDING_PACKAGE);
    await run("yarn", ["build"]);

    if (!fs.existsSync(testInstallDir)) {
      fs.mkdirSync(testInstallDir);
    }

    logger.info(LOG_MESSAGE_PACKING_PACKAGE);
    await run("yarn", ["pack", "--filename", packagePath]);

    logger.info(LOG_MESSAGE_INITIALIZING_PROJECT);
    await run("yarn", ["init", "-y"], { cwd: testInstallDir });

    const yarnLockPath = path.join(testInstallDir, "yarn.lock");
    if (!fs.existsSync(yarnLockPath)) {
      fs.writeFileSync(yarnLockPath, "");
    }

    logger.info(LOG_MESSAGE_ADDING_TARBALL);
    await run(
      "yarn",
      ["add", "-D", `fastypest@${packagePath}`],
      { cwd: testInstallDir }
    );

    logger.info(LOG_MESSAGE_SUCCESS);
  } catch (error) {
    logger.error(LOG_MESSAGE_FAILURE, {
      [METADATA_KEY_ERROR]: error.message || error,
    });
    process.exitCode = 1;
  } finally {
    cleanUp();
  }
})();
