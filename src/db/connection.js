import mongoose from "mongoose";
import { log } from "../utils/logger.js";

const DEFAULT_URI = "mongodb://localhost:27017/narration-converter";

export async function connectDB() {
    const uri = process.env.MONGO_URI || DEFAULT_URI;

    try {
        await mongoose.connect(uri);
        log.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    } catch (error) {
        log.error("Error connecting to MongoDB", error);
        throw error;
    }
}

export async function disconnectDB() {
    try {
        await mongoose.disconnect();
        log.info("MongoDB disconnected");
    } catch (error) {
        log.error("Error disconnecting from MongoDB", error);
        throw error;
    }
}