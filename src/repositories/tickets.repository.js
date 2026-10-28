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

    // Lugares ocupados = suma de quantity de los tickets activos. Los cancelados no se cuentan,
    // por eso al cancelar un ticket el cupo se libera solo, sin tocar el evento
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

    // Cancelar no borra el ticket: cambia el estado y guarda la fecha
    async cancelTicket(id) {
        return this.dao.updateById(id, { status: TICKET_STATUS.CANCELLED, cancelledAt: new Date() });
    }
}

export const ticketsRepository = new TicketsRepository(ticketsDao);
