import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readExecutionProfile } from "./execution-profile.mjs";

const isVercel = Boolean(process.env.VERCEL);

if (!isVercel) {
  try {
    const dns = await import("node:dns");
    const resolver = new dns.Resolver();
    resolver.setServers(["8.8.8.8", "8.8.4.4"]);
    const undiciUrl = new URL("../node_modules/.pnpm/undici@7.24.8/node_modules/undici/index.js", import.meta.url).href;
    const { Agent, setGlobalDispatcher } = await import(undiciUrl);
    setGlobalDispatcher(
      new Agent({
        connect: {
          lookup: (hostname, options, callback) => {
            if (typeof options === "function") {
              callback = options;
              options = {};
            }
            resolver.resolve4(hostname, (err, addresses) => {
              if (err) return callback(err);
              if (!addresses || !addresses.length) return callback(new Error("No address found for " + hostname));
              if (options && options.all) {
                return callback(
                  null,
                  addresses.map((a) => ({ address: a, family: 4 }))
                );
              }
              return callback(null, addresses[0], 4);
            });
          },
        },
      })
    );
  } catch {}
}

const [command, ...args] = process.argv.slice(2);
if (!["dev", "build"].includes(command)) throw new Error("Expected dev or build.");

if (isVercel) {
  const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
  const result = spawnSync(process.execPath, [nextCli, command, ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

process.env.EQUITY_FISHING_RUNTIME = "vinext";
const managedLinux = readExecutionProfile() === "managed-linux";

if (managedLinux && command === "build") {
  const result = spawnSync("bash", [
    fileURLToPath(new URL("./build-verified.sh", import.meta.url)), ...args,
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Import in this process so the preview owner retains its PID and signals.
const cli = new URL(managedLinux
  ? "../node_modules/vite/bin/vite.js"
  : "../node_modules/vinext/dist/cli.js", import.meta.url);
const port = process.env.PORT || "5173";
process.argv = [process.execPath, fileURLToPath(cli), command,
  ...(!managedLinux && command === "dev" && !args.includes("--port") ? ["--port", port] : []), ...args];
await import(cli.href);
