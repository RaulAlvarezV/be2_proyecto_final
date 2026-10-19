/**
 * Autorización por rol: recibe los roles permitidos y compara contra req.user.role.
 * Va siempre después de auth (que carga req.user), por eso el orden en la ruta es auth → authorizeRoles → controller.
 * 401 si no hay usuario autenticado; 403 si está autenticado pero su rol no tiene permiso.
 * Fail closed: si no se indica ningún rol permitido, nadie pasa.
 */
export function authorizeRoles(...allowedRoles) {
    return function (req, res, next) {
        if (!req.user) {
            return res.status(401).json({ status: "error", message: "No autenticado" });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ status: "error", message: "No tenés permisos para realizar esta acción" });
        }

        next();
    };
}
