import { ticketsService } from "../services/tickets.service.js";

// Ya pasó por auth: req.user es el usuario que se inscribe. Body opcional: { "quantity": 2 }
export async function createTicket(req, res, next) {
    try {
        const ticket = await ticketsService.create(req.params.eid, req.body?.quantity, req.user);
        res.status(201).json({ status: "success", message: "Inscripción confirmada", payload: ticket });
    } catch (error) {
        next(error);
    }
}
