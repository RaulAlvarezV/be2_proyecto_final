import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB() {
    return mongoose.connect(env.MONGO_URL);
}

// Para los scripts que terminan solos (ej. sync:seats): cierra la conexión y el proceso puede salir
export async function disconnectDB() {
    return mongoose.disconnect();
}
