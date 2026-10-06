import { sessionsService } from "../services/sessions.service.js";

export async function register(req, res, next) {
    try {
        const user = await sessionsService.register(req.body);
        res.status(201).json({ status: "success", payload: user });
    } catch (error) {
        next(error);
    }
}

// Login, current y logout (JWT, cookies y Passport) se suman en la próxima entrega
function notImplemented(_req, res) {
    res.status(501).json({ status: "error", message: "Funcionalidad en desarrollo" });
}

export const login = notImplemented;
export const current = notImplemented;
export const logout = notImplemented;
