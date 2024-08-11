import cors from "cors";
import express from "express";
import { connectDB } from "./config/db.ts";
import { verifyToken } from "./middleware/auth.middleware.ts";
import authRoutes from "./routes/auth.routes.ts";
import jobRoutes from "./routes/job.routes.ts";
import aiRoutes from "./routes/openai.routes.ts";
import userRoutes from "./routes/user.routes.ts";

const PORT = process.env.PORT || 3000;

const app = express();

async function main() {
  await connectDB();

  app.use(express.json());
  app.use(cors());
  app.use("/api/auth", authRoutes);
  app.use("/api/user", verifyToken, userRoutes);
  app.use("/api/job", verifyToken, jobRoutes);
  app.use("/api/openai", verifyToken, aiRoutes);
  app.listen(PORT, () => {
    console.log(`index: Server listening on`, PORT);
  });
}

main();
