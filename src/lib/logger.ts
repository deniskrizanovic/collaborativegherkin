import pino from "pino";
import path from "path";

const transport =
  process.env.NODE_ENV === "production"
    ? undefined
    : pino.transport({
        targets: [
          {
            target: "pino-pretty",
            options: { colorize: true },
            level: "debug",
          },
          {
            target: "pino/file",
            options: {
              destination: path.join(process.cwd(), "logs", "app.log"),
            },
            level: "debug",
          },
          {
            target: "pino/file",
            options: {
              destination: path.join(process.cwd(), "logs", "error.log"),
            },
            level: "error",
          },
        ],
      });

const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: { service: "collaborativegherkin" },
  },
  transport
);

export default logger;
