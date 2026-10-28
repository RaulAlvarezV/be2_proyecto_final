import { ROLES } from "../config/permissions.js";
import { AppError } from "../utils/errors.js";
import { eventsRepository } from "../repositories/events.repository.js";
import { ticketsRepository } from "../repositories/tickets.repository.js";

/**
 * Autorización por rol: recibe los roles permitidos y compara contra req.user.role.
 * Va siempre después de auth (que carga req.user), por eso el orden en la ruta es auth → authorizeRoles → controller.
 * 401 si no hay usuario autenticado; 403 si está autenticado pero su rol no tiene permiso.
 * Los errores se pasan con next(): el manejador global arma la respuesta, igual que para el resto de la API.
 * Fail closed: si no se indica ningún rol permitido, nadie pasa.
 */
export function authorizeRoles(...allowedRoles) {
    return function (req, _res, next) {
        if (!req.user) {
            return next(new AppError("No autenticado", 401));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new AppError("No tenés permisos para realizar esta acción", 403));
        }

        next();
    };
}

/**
 * Autorización por propiedad del recurso: solo el organizador dueño del evento o un admin pueden modificarlo.
 * Va después de authorizeRoles (el rol ya es organizer o admin). Recibe el repository para poder probarlo sin MongoDB.
 * Deja el evento en req.event para que el controller no lo vuelva a buscar.
 * param indica de qué parámetro de la ruta sale el id (/:id o /:eid/tickets) y forbiddenMessage el texto del 403.
 */
export function createEventOwnershipMiddleware(repository, { param = "id", forbiddenMessage = "No tenés permisos para modificar este evento" } = {}) {
    return async function (req, _res, next) {
        try {
            if (!req.user) {
                return next(new AppError("No autenticado", 401));
            }

            // Un id mal formado lanza CastError, que el manejador global responde con 400
            const event = await repository.getById(req.params[param]);
            if (!event) {
                return next(new AppError("Evento no encontrado", 404));
            }

            // El admin se evalúa primero porque tiene permisos globales: no depende de ser el dueño.
            // Para el resto, el dueño es la regla: los ids se comparan como texto (ObjectId vs string)
            const isAdmin = req.user.role === ROLES.ADMIN;
            const isOwner = event.organizer != null && String(event.organizer) === String(req.user.id);

            if (!isAdmin && !isOwner) {
                return next(new AppError(forbiddenMessage, 403));
            }

            req.event = event;
            next();
        } catch (error) {
            next(error);
        }
    };
}

export const authorizeEventOwnerOrAdmin = createEventOwnershipMiddleware(eventsRepository);

// Ver los inscriptos de un evento: misma regla de propiedad, sobre /api/events/:eid/tickets
export const authorizeEventTicketsAccess = createEventOwnershipMiddleware(eventsRepository, {
    param: "eid",
    forbiddenMessage: "No tenés permisos para ver los inscriptos de este evento"
});

/**
 * Autorización por propiedad del ticket: solo quien se inscribió o un admin pueden cancelarlo.
 * Deja el ticket en req.ticket. Recibe el repository para poder probarlo sin MongoDB.
 */
export function createTicketOwnershipMiddleware(repository) {
    return async function (req, _res, next) {
        try {
            if (!req.user) {
                return next(new AppError("No autenticado", 401));
            }

            const ticket = await repository.getById(req.params.tid);
            if (!ticket) {
                return next(new AppError("Ticket no encontrado", 404));
            }

            // Igual que con los eventos: el admin primero (permiso global), después el dueño
            const isAdmin = req.user.role === ROLES.ADMIN;
            const isOwner = String(ticket.user) === String(req.user.id);

            if (!isAdmin && !isOwner) {
                return next(new AppError("No tenés permisos para cancelar este ticket", 403));
            }

            req.ticket = ticket;
            next();
        } catch (error) {
            next(error);
        }
    };
}

export const authorizeTicketOwnerOrAdmin = createTicketOwnershipMiddleware(ticketsRepository);
