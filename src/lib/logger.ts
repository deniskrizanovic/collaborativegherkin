import pino from "pino";
import path from "path";
import fs from "fs";

// pino.transport() spawns worker threads, which break in Next.js dev mode
// because webpack rewrites module paths the worker can't resolve.
// pino.multistream() + pino-pretty's sync mode achieves the same result
// without any worker threads.
function createDevDestination(): pino.MultiStreamRes {
  const logsDir = path.join(process.cwd(), "logs");
  fs.mkdirSync(logsDir, { recursive: true });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pretty = require("pino-pretty");

  return pino.multistream([
    { stream: pretty({ colorize: true, sync: true }), level: "debug" },
    {
      stream: fs.createWriteStream(path.join(logsDir, "app.log"), { flags: "a" }),
      level: "debug",
    },
    {
      stream: fs.createWriteStream(path.join(logsDir, "error.log"), { flags: "a" }),
      level: "error",
    },
  ]);
}

const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: { service: "collaborativegherkin" },
  },
  process.env.NODE_ENV !== "production" ? createDevDestination() : undefined
);

export default logger;
