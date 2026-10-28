import { ticketsRepository } from "../repositories/tickets.repository.js";
import { mailService } from "./mail.service.js";
import { eventsRepository } from "../repositories/events.repository.js";
import { EVENT_STATUS } from "../config/event-status.js";
import { TICKET_STATUS } from "../config/ticket-status.js";
import { currentStatus } from "./events.service.js";
import { TicketDTO } from "../dto/ticket.dto.js";
import { generateReservationCode } from "../utils/reservation-code.js";
import { AppError } from "../utils/errors.js";

const DEFAULT_QUANTITY = 1;
const DUPLICATE_KEY_CODE = 11000;
const CODE_ATTEMPTS = 3;

// quantity es opcional (por defecto 1 lugar); si llega, tiene que ser un entero mayor a cero
function validateQuantity(value) {
    if (value === undefined) {
        return DEFAULT_QUANTITY;
    }

    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new AppError("La cantidad debe ser un número", 400);
    }

    if (!Number.isInteger(value) || value <= 0) {
        throw new AppError("La cantidad debe ser un número entero mayor a cero", 400);
    }

    return value;
}

export class TicketsService {
    constructor(repository, eventsRepository, mailer) {
        this.repository = repository;
        this.eventsRepository = eventsRepository;
        this.mailer = mailer;
    }

    // La operación principal es el ticket; el email es una notificación. Si falla, la inscripción sigue siendo válida:
    // el error queda en la consola del servidor y la respuesta avisa que no se pudo enviar
    async notifyConfirmation(email, event, ticket) {
        try {
            return await this.mailer.sendTicketConfirmation({
                to: email,
                eventTitle: event.title,
                eventDate: event.date,
                eventLocation: event.location,
                quantity: ticket.quantity,
                reservationCode: ticket.reservationCode
            });
        } catch (error) {
            console.error("No se pudo enviar el email de confirmación:", error.message);
            return false;
        }
    }

    // El ticket se crea con un código de reserva aleatorio. Si justo se repite (muy poco probable),
    // el índice unique lo rechaza y se genera otro
    async createWithCode(data) {
        for (let attempt = 1; attempt <= CODE_ATTEMPTS; attempt++) {
            try {
                return await this.repository.create({ ...data, reservationCode: generateReservationCode() });
            } catch (error) {
                const isCodeCollision = error.code === DUPLICATE_KEY_CODE && error.keyPattern?.reservationCode;
                if (!isCodeCollision || attempt === CODE_ATTEMPTS) {
                    throw error;
                }
            }
        }
    }

    // Solo los tickets del usuario logueado: el id sale de la sesión, así nadie puede pedir los de otro
    async getMine(userId) {
        const tickets = await this.repository.getByUser(userId);
        return tickets.map(ticket => new TicketDTO(ticket));
    }

    // El permiso (organizer dueño o admin) ya lo validó authorizeEventTicketsAccess, que deja el evento en req.event.
    // Además de la lista se devuelve el resumen de cupo del evento
    async getByEvent(event) {
        const [tickets, reserved] = await Promise.all([
            this.repository.getByEvent(event._id),
            this.repository.countReservedSeats(event._id)
        ]);

        return {
            summary: { capacity: event.capacity, reserved, available: event.capacity - reserved },
            tickets: tickets.map(ticket => new TicketDTO(ticket))
        };
    }

    // Inscripción: el usuario sale de la sesión (req.user), nunca del body
    async create(eventId, quantityInput, user) {
        const quantity = validateQuantity(quantityInput);

        const event = await this.eventsRepository.getById(eventId);

        // Un borrador todavía no es público: se responde igual que si no existiera
        if (!event || event.status === EVENT_STATUS.DRAFT) {
            throw new AppError("Evento no encontrado", 404);
        }

        const status = currentStatus(event);

        if (status === EVENT_STATUS.CANCELLED) {
            throw new AppError("El evento está cancelado: no admite inscripciones", 409);
        }

        if (status === EVENT_STATUS.FINISHED) {
            throw new AppError("El evento ya finalizó: no admite inscripciones", 409);
        }

        // Una inscripción activa por usuario y evento (para más lugares se usa quantity)
        const existing = await this.repository.getActiveByUserAndEvent(user.id, event._id);
        if (existing) {
            throw new AppError("Ya tenés una inscripción activa para este evento", 409);
        }

        // Solo cuentan los tickets activos: los cancelados no ocupan cupo
        const reserved = await this.repository.countReservedSeats(event._id);
        const available = event.capacity - reserved;

        if (quantity > available) {
            const detail = available > 0 ? `quedan ${available} lugares disponibles` : "el evento no tiene lugares disponibles";
            throw new AppError(`No hay cupos suficientes: ${detail}`, 409);
        }

        const ticket = await this.createWithCode({
            user: user.id,
            event: event._id,
            quantity,
            status: TICKET_STATUS.CONFIRMED
        });

        const emailSent = await this.notifyConfirmation(user.email, event, ticket);

        return { ticket: new TicketDTO(ticket), emailSent };
    }

    // El permiso (dueño del ticket o admin) ya lo validó authorizeTicketOwnerOrAdmin.
    // Cancelar cambia el estado y guarda la fecha: el ticket no se borra y el cupo se libera solo
    async cancel(ticket) {
        if (ticket.status === TICKET_STATUS.CANCELLED) {
            throw new AppError("El ticket ya está cancelado", 409);
        }

        const event = await this.eventsRepository.getById(ticket.event);
        if (event && currentStatus(event) === EVENT_STATUS.FINISHED) {
            throw new AppError("No se puede cancelar una inscripción de un evento finalizado", 409);
        }

        const cancelledTicket = await this.repository.cancelTicket(ticket._id);

        return new TicketDTO(cancelledTicket);
    }
}

export const ticketsService = new TicketsService(ticketsRepository, eventsRepository, mailService);
