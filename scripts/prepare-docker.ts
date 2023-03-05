import { SpawnSyncOptions } from "child_process";
import spawn from "cross-spawn";

const options: SpawnSyncOptions = { stdio: "inherit" };
const projectName = "fastypest";

const run = (command: string, args?: string[], options?: SpawnSyncOptions) =>
  new Promise((resolve, reject) => {
    const childProcess = spawn.sync(command, args, options);
    if (childProcess?.status) {
      process.exit(childProcess.status);
    }
    if (childProcess.error) {
      reject(childProcess.error);
    } else {
      resolve(childProcess);
    }
  });

(async () => {
  await run(
    "docker-compose",
    ["-p", projectName, "down", "--rmi", "all", "--volumes"],
    options
  );
  await run("docker", ["volume", "prune", "-f"], options);
  await run("docker-compose", ["-p", projectName, "up", "-d"], options);
})();
