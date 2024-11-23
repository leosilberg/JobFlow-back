import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import pinoHttp from "pino-http";
import { connectDB } from "./libs/db";
import { logger } from "./libs/logger";
import { verifyToken } from "./middleware/auth.middleware";
import { errorHandler } from "./middleware/error.middleware";
import authRoutes from "./routes/auth.routes";
import jobRoutes from "./routes/job.routes";
import linkedinRoutes from "./routes/linkedin.routes";
import aiRoutes from "./routes/openai.routes";
import userRoutes from "./routes/user.routes";

const PORT = process.env.PORT || 3000;

async function main() {
  await connectDB();
  const app = express();

  app.use(pinoHttp({ logger, autoLogging: false }));
  app.use(express.json());
  app.use(cors());
  app.use(express.static("public"));
  app.use("/api/auth", authRoutes);
  app.use("/api/user", verifyToken, userRoutes);
  app.use("/api/job", verifyToken, jobRoutes);
  app.use("/api/linkedin", linkedinRoutes);
  app.use("/api/openai", verifyToken, aiRoutes);

  app.get("*path", (req, res) => {
    res.sendFile(
      path.join(path.resolve(__dirname, ".."), "public", "index.html"),
    );
  });

  app.use(errorHandler);
  app.listen(PORT, () => {
    logger.info(`index: Server listening on ${PORT}`);
  });
}

main();
