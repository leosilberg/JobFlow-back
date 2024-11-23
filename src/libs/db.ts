import mongoose from "mongoose";
import { logger } from "../libs/logger";

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    logger.info(`db: DB connected`);
  } catch (error) {
    logger.error(`db: ${error}`);
    process.exit(1);
  }
}
