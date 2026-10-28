import { toPublicRef } from "../utils/public-ref.js";

// Campos de los documentos relacionados cuando el ticket viene con populate.
// Del usuario nunca la contraseña: aunque el populate trajera más campos, el DTO solo deja pasar estos
export const TICKET_EVENT_FIELDS = Object.freeze(["title", "date", "location", "status"]);
export const TICKET_USER_FIELDS = Object.freeze(["first_name", "last_name", "email"]);

// DTO de ticket: id en lugar de _id, sin campos internos (__v, updatedAt) y las referencias filtradas
export class TicketDTO {
    constructor(ticket) {
        this.id = ticket._id;
        this.reservationCode = ticket.reservationCode;
        this.status = ticket.status;
        this.quantity = ticket.quantity;
        this.event = toPublicRef(ticket.event, TICKET_EVENT_FIELDS);
        this.user = toPublicRef(ticket.user, TICKET_USER_FIELDS);
        this.createdAt = ticket.createdAt;
        this.cancelledAt = ticket.cancelledAt;
    }
}
