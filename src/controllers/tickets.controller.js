import { ticketsService } from "../services/tickets.service.js";

export async function getMyTickets(req, res, next) {
    try {
        const tickets = await ticketsService.getMine(req.user.id);
        res.status(200).json({ status: "success", payload: tickets });
    } catch (error) {
        next(error);
    }
}

// req.event lo deja authorizeEventTicketsAccess
export async function getEventTickets(req, res, next) {
    try {
        const result = await ticketsService.getByEvent(req.event);
        res.status(200).json({ status: "success", payload: result });
    } catch (error) {
        next(error);
    }
}

// Ya pasó por auth: req.user es el usuario que se inscribe. Body opcional: { "quantity": 2 }
export async function createTicket(req, res, next) {
    try {
        const ticket = await ticketsService.create(req.params.eid, req.body?.quantity, req.user);
        res.status(201).json({ status: "success", message: "Inscripción confirmada", payload: ticket });
    } catch (error) {
        next(error);
    }
}
