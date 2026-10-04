// Estructura inicial: la autenticación (bcrypt, JWT, cookies y Passport) se suma en la próxima entrega
function notImplemented(req, res) {
    res.status(501).json({ status: "error", message: "Funcionalidad en desarrollo" });
}

export const register = notImplemented;
export const login = notImplemented;
export const current = notImplemented;
export const logout = notImplemented;
