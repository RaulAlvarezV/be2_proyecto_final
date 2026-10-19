import { eventsService } from "../services/events.service.js";

export async function getEvents(req, res, next) {
    try {
        const events = await eventsService.getAll();
        res.status(200).json({ status: "success", payload: events });
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
