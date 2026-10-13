import { verifyToken } from "../utils/jwt.js";
import { COOKIE_NAME } from "../config/cookie.js";

// Lee el JWT de la cookie, lo verifica y deja los datos del usuario en req.user
export function auth(req, res, next) {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
        return res.status(401).json({ status: "error", message: "No autenticado" });
    }

    try {
        const { id, email, role } = verifyToken(token);
        req.user = { id, email, role };
        return next();
    } catch (error) {
        // Token vencido, alterado o mal formado: se rechaza sin dar detalles al cliente
        console.error("Token rechazado:", error.name, error.message);
        return res.status(401).json({ status: "error", message: "Token inválido o expirado" });
    }
}
