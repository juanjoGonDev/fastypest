const fs = require("fs");
const path = require("path");

const run = async (command, args = [], options = { stdio: "inherit" }) => {
  const { execa } = await import("execa");
  try {
    const { stdout } = await execa(command, args, options);
    return stdout;
  } catch (err) {
    console.error(`✗ Error executing: ${command} ${args.join(" ")}`);
    if (err.stderr) console.error(err.stderr);
    throw err;
  }
};

const testInstallDir = path.join(__dirname, "..", "test-install");
const packagePath = path.join(testInstallDir, "package.tar.gz");

const cleanUp = () => {
  if (fs.existsSync(testInstallDir)) {
    fs.rmSync(testInstallDir, { recursive: true, force: true });
    console.log("🧹 Removed test-install directory.");
  }
};

(async () => {
  try {
    console.log("🛠 Building the package...");
    await run("yarn", ["build"]);

    if (!fs.existsSync(testInstallDir)) {
      fs.mkdirSync(testInstallDir);
    }

    console.log("📦 Packing the package...");
    await run("yarn", ["pack", "--filename", packagePath]);

    console.log("📁 Initializing a fresh project in test-install...");
    await run("yarn", ["init", "-y"], { cwd: testInstallDir });

    const yarnLockPath = path.join(testInstallDir, "yarn.lock");
    if (!fs.existsSync(yarnLockPath)) {
      fs.writeFileSync(yarnLockPath, "");
    }

    console.log("➕ Adding the tarball as a dev dependency...");
    await run(
      "yarn",
      ["add", "-D", `fastypest@${packagePath}`],
      { cwd: testInstallDir }
    );

    console.log("✅ Pre-commit install test succeeded!");
  } catch (error) {
    console.error("❌ Pre-commit check failed:", error.message || error);
    process.exitCode = 1;
  } finally {
    cleanUp();
  }
})();
