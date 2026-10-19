import { ticketsDao } from "../dao/tickets.dao.js";
import { ACTIVE_TICKET_STATUS } from "../config/ticket-status.js";

class TicketsRepository {
    constructor(dao) {
        this.dao = dao;
    }

    async getActiveByUserAndEvent(userId, eventId) {
        return this.dao.findOne({ user: userId, event: eventId, status: { $in: ACTIVE_TICKET_STATUS } });
    }

    // Lugares ocupados = suma de quantity de los tickets activos. Los cancelados no se cuentan,
    // por eso al cancelar un ticket el cupo se libera solo, sin tocar el evento
    async getReservedSeats(eventId) {
        return this.dao.sumQuantity({ event: eventId, status: { $in: ACTIVE_TICKET_STATUS } });
    }

    async create(data) {
        return this.dao.create(data);
    }
}

export const ticketsRepository = new TicketsRepository(ticketsDao);
