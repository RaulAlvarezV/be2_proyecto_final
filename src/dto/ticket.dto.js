import { toPublicRef } from "../utils/public-ref.js";

// Campos que se muestran del evento y del usuario cuando el ticket viene con populate
export const TICKET_EVENT_FIELDS = Object.freeze(["title", "date", "location", "status"]);
export const TICKET_USER_FIELDS = Object.freeze(["first_name", "last_name", "email"]);

// Datos públicos de un ticket (id en lugar de _id, sin campos internos)
export function toPublicTicket(ticket) {
    return {
        id: ticket._id,
        reservationCode: ticket.reservationCode,
        status: ticket.status,
        quantity: ticket.quantity,
        event: toPublicRef(ticket.event, TICKET_EVENT_FIELDS),
        user: toPublicRef(ticket.user, TICKET_USER_FIELDS),
        createdAt: ticket.createdAt,
        cancelledAt: ticket.cancelledAt
    };
}
