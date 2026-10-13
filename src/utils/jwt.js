import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// Genera el token con la información mínima del usuario: { id, email, role }
export function generateToken(payload) {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

// Devuelve el payload si el token es válido. Si está vencido, alterado o mal formado, lanza un error
export function verifyToken(token) {
    return jwt.verify(token, env.JWT_SECRET);
}
