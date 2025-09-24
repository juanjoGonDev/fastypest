const fs = require("fs");
const path = require("path");
const { createScriptLogger } = require("./logger");

const LOG_SCOPE = "pre-commit";
const LOG_TEXT = Object.freeze({
  commandError: "💥 Error executing command",
  removedDirectory: "🧹 Removed test-install directory",
  buildingPackage: "🏗️ Building the package",
  packingPackage: "📦 Packing the package",
  initializingProject: "🆕 Initializing test-install project",
  addingTarball: "➕ Adding tarball as dev dependency",
  success: "✅ Pre-commit install test succeeded",
  failure: "❌ Pre-commit check failed",
});
const METADATA_KEYS = Object.freeze({
  command: "command",
  arguments: "args",
  error: "error",
});

const logger = createScriptLogger(LOG_SCOPE);

const run = async (command, args = [], options = { stdio: "inherit" }) => {
  const { execa } = await import("execa");
  try {
    const { stdout } = await execa(command, args, options);
    return stdout;
  } catch (err) {
    logger.error(LOG_TEXT.commandError, {
      [METADATA_KEYS.command]: command,
      [METADATA_KEYS.arguments]: args,
      [METADATA_KEYS.error]: err.stderr || err.message || err,
    });
    throw err;
  }
};

const testInstallDir = path.join(__dirname, "..", "test-install");
const packagePath = path.join(testInstallDir, "package.tar.gz");

const cleanUp = () => {
  if (fs.existsSync(testInstallDir)) {
    fs.rmSync(testInstallDir, { recursive: true, force: true });
    logger.info(LOG_TEXT.removedDirectory);
  }
};

(async () => {
  try {
    logger.info(LOG_TEXT.buildingPackage);
    await run("yarn", ["build"]);

    if (!fs.existsSync(testInstallDir)) {
      fs.mkdirSync(testInstallDir);
    }

    logger.info(LOG_TEXT.packingPackage);
    await run("yarn", ["pack", "--filename", packagePath]);

    logger.info(LOG_TEXT.initializingProject);
    await run("yarn", ["init", "-y"], { cwd: testInstallDir });

    const yarnLockPath = path.join(testInstallDir, "yarn.lock");
    if (!fs.existsSync(yarnLockPath)) {
      fs.writeFileSync(yarnLockPath, "");
    }

    logger.info(LOG_TEXT.addingTarball);
    await run(
      "yarn",
      ["add", "-D", `fastypest@${packagePath}`],
      { cwd: testInstallDir }
    );

    logger.info(LOG_TEXT.success);
  } catch (error) {
    logger.error(LOG_TEXT.failure, {
      [METADATA_KEYS.error]: error.message || error,
    });
    process.exitCode = 1;
  } finally {
    cleanUp();
  }
})();
