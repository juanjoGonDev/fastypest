const spawn = require("cross-spawn");
const fs = require("fs");
const path = require("path");

const run = (command, args = [], options = { stdio: "inherit" }) => {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, options);
    if (childProcess?.status !== 0) {
      console.error(`Error executing: ${command} ${args.join(" ")}`);
      process.exit(childProcess.status); 
    }
    if (childProcess.error) {
      reject(childProcess.error);
    } else {
      resolve(childProcess);
    }
  });
};

(async () => {
  try {
    console.log("Running yarn build...");
    await run("yarn", ["run", "build"]);

    const testInstallDir = path.join(__dirname, "test-install");
    if (!fs.existsSync(testInstallDir)) {
      fs.mkdirSync(testInstallDir);
    }

    console.log("Packing the package...");
    await run("yarn", ["pack", "--filename", "test-install/package.tar.gz"]);

    console.log("Initializing new Yarn project in test-install...");
    await run("yarn", ["init", "-y"], { cwd: testInstallDir });

    console.log("Adding the packaged tar.gz as a dev dependency...");
    await run("yarn", ["add", "-D", "./package.tar.gz"], { cwd: testInstallDir });

    console.log("Pre-commit check completed successfully!");
  } catch (error) {
    console.error("An error occurred during the pre-commit check:", error);
    process.exit(1); 
  }
})();
