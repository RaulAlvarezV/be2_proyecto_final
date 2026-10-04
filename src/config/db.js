import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB() {
    return mongoose.connect(env.MONGO_URL);
}
