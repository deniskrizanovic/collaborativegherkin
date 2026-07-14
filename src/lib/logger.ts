import pino from "pino";
import path from "path";
import fs from "fs";
import { createRequire } from "module";

// The custom Node server (`server.js`) imports this module from a plain ESM
// entry point where the CommonJS `require` global is absent, so build a local
// one from the module URL. This keeps working under Next's bundler too.
const require = createRequire(import.meta.url);

// pino.transport() spawns worker threads, which break in Next.js dev mode
// because webpack rewrites module paths the worker can't resolve.
// pino.multistream() + pino-pretty's sync mode achieves the same result
// without any worker threads.
//
// Production logs to stdout only (see the pino() call below), so the disk
// streams here are dev-only. If the logs/ dir can't be created or opened
// (read-only checkout, missing perms), fall back to pretty stdout alone with a
// warning rather than throwing at import and taking the process down.
function createDevDestination(): pino.MultiStreamRes {
  const pretty = require("pino-pretty");
  const prettyStream = { stream: pretty({ colorize: true, sync: true }), level: "debug" as const };

  try {
    const logsDir = path.join(process.cwd(), "logs");
    fs.mkdirSync(logsDir, { recursive: true });

    return pino.multistream([
      prettyStream,
      {
        stream: fs.createWriteStream(path.join(logsDir, "app.log"), { flags: "a" }),
        level: "debug",
      },
      {
        stream: fs.createWriteStream(path.join(logsDir, "error.log"), { flags: "a" }),
        level: "error",
      },
    ]);
  } catch (err) {
    // Content-free: the logger isn't up yet, so warn on stderr directly.
    console.warn(
      `[logger] could not open disk log files, using stdout only: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return pino.multistream([prettyStream]);
  }
}

const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: { service: "collaborativegherkin" },
  },
  process.env.NODE_ENV !== "production" ? createDevDestination() : undefined
);

export default logger;
