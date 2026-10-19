import { ROLES } from "../config/permissions.js";
import { eventsRepository } from "../repositories/events.repository.js";

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

/**
 * Autorización por propiedad del recurso: solo el organizador dueño del evento o un admin pueden modificarlo.
 * Va después de authorizeRoles (el rol ya es organizer o admin). Recibe el repository para poder probarlo sin MongoDB.
 * Deja el evento en req.event para que el controller no lo vuelva a buscar.
 */
export function createEventOwnershipMiddleware(repository) {
    return async function (req, res, next) {
        try {
            if (!req.user) {
                return res.status(401).json({ status: "error", message: "No autenticado" });
            }

            // Un id mal formado lanza CastError, que el manejador global responde con 400
            const event = await repository.getById(req.params.id);
            if (!event) {
                return res.status(404).json({ status: "error", message: "Evento no encontrado" });
            }

            // El admin se evalúa primero porque tiene permisos globales: no depende de ser el dueño.
            // Para el resto, el dueño es la regla: los ids se comparan como texto (ObjectId vs string)
            const isAdmin = req.user.role === ROLES.ADMIN;
            const isOwner = event.organizer != null && String(event.organizer) === String(req.user.id);

            if (!isAdmin && !isOwner) {
                return res.status(403).json({ status: "error", message: "No tenés permisos para modificar este evento" });
            }

            req.event = event;
            next();
        } catch (error) {
            next(error);
        }
    };
}

export const authorizeEventOwnerOrAdmin = createEventOwnershipMiddleware(eventsRepository);
