import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { connectDB } from "./config/db.ts";
import { verifyToken } from "./middleware/auth.middleware.ts";
import authRoutes from "./routes/auth.routes.ts";
import jobRoutes from "./routes/job.routes.ts";
import linkedinRoutes from "./routes/linkedin.routes.ts";
import aiRoutes from "./routes/openai.routes.ts";
import userRoutes from "./routes/user.routes.ts";
import path from "path";

const PORT = process.env.PORT || 3000;

const app = express();

async function main() {
  await connectDB();

  app.use(express.json());
  app.use(cors());
  app.use(express.static("public"));
  app.use("/api/auth", authRoutes);
  app.use("/api/user", verifyToken, userRoutes);
  app.use("/api/job", verifyToken, jobRoutes);
  app.use("/api/linkedin", linkedinRoutes);
  app.use("/api/openai", verifyToken, aiRoutes);

  app.get("*", (req, res) => {
    res.sendFile(
      path.join(path.resolve(__dirname, ".."), "public", "index.html")
    );
  });
  app.listen(PORT, () => {
    console.log(`index: Server listening on`, PORT);
  });
}

main();
