const fs = require("fs");
const path = require("path");
const { createScriptLogger } = require("./logger");

const logger = createScriptLogger("pre-commit");

const run = async (command, args = [], options = { stdio: "inherit" }) => {
  const { execa } = await import("execa");
  try {
    const { stdout } = await execa(command, args, options);
    return stdout;
  } catch (err) {
    const errorMessage = err.stderr || err.message || String(err);
    logger.error(
      "Command execution failed",
      `Command ${command}`,
      args.length > 0 ? `Arguments ${args.join(" ")}` : undefined,
      errorMessage
    );
    throw err;
  }
};

const testInstallDir = path.join(__dirname, "..", "test-install");
const packagePath = path.join(testInstallDir, "package.tar.gz");

const cleanUp = () => {
  if (fs.existsSync(testInstallDir)) {
    fs.rmSync(testInstallDir, { recursive: true, force: true });
    logger.log("Removed temporary test-install directory");
  }
};

(async () => {
  logger.verbose("Starting pre-commit installation smoke test");
  try {
    logger.debug("Running strict dead code checks");
    await run("yarn", ["check:dead-code"]);
    logger.info("Dead code checks completed");

    logger.debug("Running yarn build for test verification");
    await run("yarn", ["build"]);
    logger.info("Package build completed for smoke test");

    if (!fs.existsSync(testInstallDir)) {
      fs.mkdirSync(testInstallDir);
      logger.log("Created test-install working directory", testInstallDir);
    }

    logger.debug("Packing the current workspace into a tarball");
    await run("yarn", ["pack", "--filename", packagePath]);
    logger.info("Package tarball generated", packagePath);

    logger.debug("Initializing isolated project for installation test");
    await run("yarn", ["init", "-y"], { cwd: testInstallDir });
    logger.info("Initialization completed inside test-install project");

    const yarnLockPath = path.join(testInstallDir, "yarn.lock");
    if (!fs.existsSync(yarnLockPath)) {
      fs.writeFileSync(yarnLockPath, "");
      logger.log("Created placeholder yarn.lock inside test-install project");
    }

    logger.debug("Adding packed tarball as a dev dependency");
    await run("yarn", ["add", "-D", `fastypest@${packagePath}`], {
      cwd: testInstallDir,
    });
    logger.log("Tarball installation succeeded inside the test project");

    logger.info("Pre-commit smoke test finished successfully");
  } catch (error) {
    logger.error("Pre-commit smoke test failed", error.message || String(error));
    process.exitCode = 1;
  } finally {
    cleanUp();
  }
})();
