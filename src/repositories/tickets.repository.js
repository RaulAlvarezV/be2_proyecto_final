import { ticketsDao } from "../dao/tickets.dao.js";
import { TICKET_STATUS, ACTIVE_TICKET_STATUS } from "../config/ticket-status.js";

class TicketsRepository {
    constructor(dao) {
        this.dao = dao;
    }

    // Sin populate: lo usa el middleware de propiedad para comparar el user con el usuario logueado
    async getById(id) {
        return this.dao.findById(id);
    }

    async getActiveByUserAndEvent(userId, eventId) {
        return this.dao.findOne({ user: userId, event: eventId, status: { $in: ACTIVE_TICKET_STATUS } });
    }

    // Lugares ocupados según los tickets activos (suma de quantity; los cancelados no cuentan).
    // Es la fuente para recalcular el contador del evento con sync:seats
    async countReservedSeats(eventId) {
        return this.dao.sumQuantity({ event: eventId, status: { $in: ACTIVE_TICKET_STATUS } });
    }

    // Tickets del usuario (activos y cancelados) con los datos del evento
    async getByUser(userId) {
        return this.dao.findByUser(userId);
    }

    // Inscriptos de un evento con sus datos de contacto
    async getByEvent(eventId) {
        return this.dao.findByEvent(eventId);
    }

    async create(data) {
        return this.dao.create(data);
    }

    // Cuando se cancela un evento, sus tickets activos también se cancelan: no quedan inscripciones activas a un evento cancelado
    async cancelActiveByEvent(eventId) {
        return this.dao.updateMany(
            { event: eventId, status: { $in: ACTIVE_TICKET_STATUS } },
            { status: TICKET_STATUS.CANCELLED, cancelledAt: new Date() }
        );
    }

    // Cancelar no borra el ticket: cambia el estado y guarda la fecha. Solo si sigue activo:
    // si llegan dos cancelaciones juntas, una sola lo cambia (y solo esa devuelve los lugares). null si ya estaba cancelado
    async cancelTicket(id) {
        return this.dao.findOneAndUpdate(
            { _id: id, status: { $in: ACTIVE_TICKET_STATUS } },
            { status: TICKET_STATUS.CANCELLED, cancelledAt: new Date() }
        );
    }
}

export const ticketsRepository = new TicketsRepository(ticketsDao);
