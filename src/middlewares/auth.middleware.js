import passport from "passport";
import { AppError } from "../utils/errors.js";

// Mensaje para el cliente cuando falla la autenticación, sin exponer detalles internos
function failureMessage(info) {
    // passport-jwt informa los problemas del token como errores (sin token, vencido, alterado, mal formado)
    if (info instanceof Error) {
        if (info.message === "No auth token") return "No autenticado";

        console.error("Token rechazado:", info.name, info.message);
        return "Token inválido o expirado";
    }

    return info?.message || "No autenticado";
}

/**
 * Ejecuta una estrategia de Passport y, si la autenticación falla, pasa el error al manejador global.
 * Con passport.authenticate a secas, cualquier fallo responde 401; acá se respeta el status
 * que indica la estrategia (400 datos inválidos, 409 email duplicado) para no cambiar el contrato de la API.
 * missingMessage: mensaje si faltan email o password (passport-local corta antes de llegar a la estrategia)
 */
export function passportCall(strategy, { missingMessage = "Faltan campos obligatorios" } = {}) {
    return function (req, res, next) {
        passport.authenticate(strategy, { session: false, badRequestMessage: missingMessage }, (error, user, info, status) => {
            if (error) return next(error);

            if (!user) {
                return next(new AppError(failureMessage(info), info?.status || status || 401));
            }

            req.user = user;
            next();
        })(req, res, next);
    };
}

// Middleware para las rutas protegidas: usa la estrategia current (JWT de la cookie currentUser)
export const auth = passportCall("current");
