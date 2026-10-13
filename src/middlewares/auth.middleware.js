import passport from "passport";
import { verifyToken } from "../utils/jwt.js";
import { COOKIE_NAME } from "../config/cookie.js";

/**
 * Ejecuta una estrategia de Passport y responde en JSON si la autenticación falla.
 * Con passport.authenticate a secas, cualquier fallo responde 401; acá se respeta el status
 * que indica la estrategia (400 datos inválidos, 409 email duplicado) para no cambiar el contrato de la API.
 * missingMessage: mensaje si faltan email o password (passport-local corta antes de llegar a la estrategia)
 */
export function passportCall(strategy, { missingMessage = "Faltan campos obligatorios" } = {}) {
    return function (req, res, next) {
        passport.authenticate(strategy, { session: false, badRequestMessage: missingMessage }, (error, user, info, status) => {
            if (error) return next(error);

            if (!user) {
                return res.status(info?.status || status || 401).json({ status: "error", message: info?.message || "No autenticado" });
            }

            req.user = user;
            next();
        })(req, res, next);
    };
}

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
