import { eventsService } from "../services/events.service.js";

// Los filtros y la paginación llegan por query params; la respuesta incluye data, page, limit, total y totalPages
export async function getEvents(req, res, next) {
    try {
        const result = await eventsService.getAll(req.query);
        res.status(200).json({ status: "success", ...result });
    } catch (error) {
        next(error);
    }
}

// Ya pasó por auth y authorizeRoles: req.user es organizer o admin
export async function createEvent(req, res, next) {
    try {
        const newEvent = await eventsService.create(req.body, req.user.id);
        res.status(201).json({ status: "success", payload: newEvent });
    } catch (error) {
        next(error);
    }
}

// req.event lo deja authorizeEventOwnerOrAdmin: ya se validó que el usuario es el dueño o un admin
export async function updateEvent(req, res, next) {
    try {
        const updatedEvent = await eventsService.update(req.event, req.body);
        res.status(200).json({ status: "success", payload: updatedEvent });
    } catch (error) {
        next(error);
    }
}

export async function cancelEvent(req, res, next) {
    try {
        const cancelledEvent = await eventsService.cancel(req.event);
        res.status(200).json({ status: "success", message: "Evento cancelado", payload: cancelledEvent });
    } catch (error) {
        next(error);
    }
}
