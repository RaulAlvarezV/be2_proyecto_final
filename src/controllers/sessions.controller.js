import { sessionsService } from "../services/sessions.service.js";
import { generateToken } from "../utils/jwt.js";
import { COOKIE_NAME, cookieOptions } from "../config/cookie.js";

export async function register(req, res, next) {
    try {
        const user = await sessionsService.register(req.body);
        res.status(201).json({ status: "success", payload: user });
    } catch (error) {
        next(error);
    }
}

export async function login(req, res, next) {
    try {
        // El service valida las credenciales y devuelve solo { id, email, role }
        const tokenUser = await sessionsService.login(req.body);
        const token = generateToken(tokenUser);

        res.cookie(COOKIE_NAME, token, cookieOptions);
        res.status(200).json({ status: "success", message: "Login correcto" });
    } catch (error) {
        next(error);
    }
}

// Current y logout se suman en los próximos pasos
function notImplemented(_req, res) {
    res.status(501).json({ status: "error", message: "Funcionalidad en desarrollo" });
}

export const current = notImplemented;
export const logout = notImplemented;
