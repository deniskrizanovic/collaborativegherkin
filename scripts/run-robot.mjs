#!/usr/bin/env node
// Robot Framework e2e runner.
//
// Mirrors Playwright's `globalSetup` + `webServer.reuseExistingServer`:
//   1. Mints the auth storage states via e2e/global-setup.ts.
//   2. Probes http://localhost:3000; if nothing answers, starts `pnpm dev` and
//      waits (120 s cap) for it to respond.
//   3. Clears robot/results/ so no stale screenshots or traces survive, then
//      runs `uv run robot --outputdir robot/results robot/suites`, forwarding
//      any extra CLI args (e.g. `--include chunk1`, `--test "SC-7.1.4*"`).
//   4. Stops the server only if this script started it (also on SIGINT and
//      SIGTERM), then exits with Robot's exit code.
//
// See openspec/changes/add-robot-framework-e2e-suite (design D4).

import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE_URL = "http://localhost:3000";
const RESULTS_DIR = "robot/results";
const SERVER_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 500;

/**
 * Run a command to completion, inheriting stdio. Resolves with its exit code.
 * @param {string} cmd
 * @param {string[]} args
 * @returns {Promise<number>}
 */
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

/** @returns {Promise<boolean>} true when something answers HTTP at BASE_URL. */
async function isServerUp() {
  try {
    await fetch(BASE_URL, { redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

/** Start `pnpm dev` in its own process group so the whole tree can be stopped. */
function startServer() {
  return spawn("pnpm", ["dev"], { stdio: "inherit", detached: true });
}

/** @param {import("node:child_process").ChildProcess} server */
async function waitForServer(server) {
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`pnpm dev exited early with code ${server.exitCode}`);
    }
    if (await isServerUp()) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Dev server did not respond at ${BASE_URL} within ${SERVER_TIMEOUT_MS / 1000}s`);
}

/** @param {import("node:child_process").ChildProcess | null} server */
function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  try {
    // Negative pid signals the whole process group (pnpm -> node server.js).
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // Already gone.
  }
}

// The server this script started, if any. Module-level so the signal handlers
// below can stop it: the server runs in its own process group, so a Ctrl-C in
// the terminal (or a cancelled CI job) never reaches it directly.
let server = null;

for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.on(signal, () => {
    stopServer(server);
    process.exit(code);
  });
}

async function main() {
  const authCode = await run("pnpm", ["exec", "tsx", "scripts/mint-e2e-auth.ts"]);
  if (authCode !== 0) {
    console.error("run-robot: auth minting failed");
    return authCode;
  }

  if (!(await isServerUp())) {
    console.log(`run-robot: no server at ${BASE_URL}, starting pnpm dev`);
    server = startServer();
    try {
      await waitForServer(server);
    } catch (err) {
      console.error(`run-robot: ${err.message}`);
      stopServer(server);
      return 1;
    }
  } else {
    console.log(`run-robot: reusing existing server at ${BASE_URL}`);
  }

  rmSync(RESULTS_DIR, { recursive: true, force: true });
  const forwarded = process.argv.slice(2);
  try {
    return await run("uv", [
      "run",
      "robot",
      "--outputdir",
      RESULTS_DIR,
      ...forwarded,
      "robot/suites",
    ]);
  } finally {
    stopServer(server);
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
