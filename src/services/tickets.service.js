import { ticketsRepository } from "../repositories/tickets.repository.js";
import { mailService } from "./mail.service.js";
import { eventsRepository } from "../repositories/events.repository.js";
import { usersRepository } from "../repositories/users.repository.js";
import { EVENT_STATUS } from "../config/event-status.js";
import { TICKET_STATUS } from "../config/ticket-status.js";
import { currentStatus } from "./events.service.js";
import { TicketDTO } from "../dto/ticket.dto.js";
import { generateReservationCode } from "../utils/reservation-code.js";
import { AppError } from "../utils/errors.js";

const DEFAULT_QUANTITY = 1;
const DUPLICATE_KEY_CODE = 11000;
const CODE_ATTEMPTS = 3;
// Si la reserva falla pero al releer el evento hay lugar (alguien canceló en el medio), se reintenta una vez
const RESERVE_ATTEMPTS = 2;

// Mensaje de cupo insuficiente con los lugares que quedan
function noSeatsMessage(available) {
    const detail = available > 0 ? `quedan ${available} lugares disponibles` : "el evento no tiene lugares disponibles";
    return `No hay cupos suficientes: ${detail}`;
}

// El evento tiene que existir, estar publicado y no estar cancelado ni finalizado
function ensureOpenForRegistration(event) {
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
}

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
    constructor(repository, eventsRepository, mailer, usersRepository) {
        this.repository = repository;
        this.eventsRepository = eventsRepository;
        this.mailer = mailer;
        this.usersRepository = usersRepository;
    }

    // La operación principal es el ticket; el email es una notificación. Si falla, la inscripción o la cancelación
    // siguen siendo válidas: el error queda en la consola del servidor y la respuesta avisa que no se pudo enviar
    async notify(send, label, email, event, ticket) {
        try {
            return await send({
                to: email,
                eventTitle: event.title,
                eventDate: event.date,
                eventLocation: event.location,
                quantity: ticket.quantity,
                reservationCode: ticket.reservationCode
            });
        } catch (error) {
            console.error(`No se pudo enviar el email de ${label}:`, error.message);
            return false;
        }
    }

    async notifyConfirmation(email, event, ticket) {
        return this.notify(data => this.mailer.sendTicketConfirmation(data), "confirmación", email, event, ticket);
    }

    // Si cancela un admin, el aviso le llega igual al dueño del ticket (no a quien hizo el pedido)
    async notifyCancellation(event, ticket) {
        const owner = await this.usersRepository.getById(ticket.user);
        if (!owner || !event) {
            return false;
        }

        return this.notify(data => this.mailer.sendTicketCancellation(data), "cancelación", owner.email, event, ticket);
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
        const tickets = await this.repository.getByEvent(event._id);
        const reserved = event.reservedSeats ?? 0;

        return {
            summary: { capacity: event.capacity, reserved, available: event.capacity - reserved },
            tickets: tickets.map(ticket => new TicketDTO(ticket))
        };
    }

    // Reserva atómica: leer el cupo y después crear el ticket en dos pasos deja una ventana en la que dos
    // inscripciones simultáneas ven el mismo lugar libre. Por eso la condición de cupo y la suma de lugares
    // se aplican juntas en el repository. Si no se pudo, se relee el evento para responder el motivo real
    async reserveSeats(eventId, quantity) {
        for (let attempt = 1; attempt <= RESERVE_ATTEMPTS; attempt++) {
            const reserved = await this.eventsRepository.reserveSeats(eventId, quantity, new Date());
            if (reserved) {
                return reserved;
            }

            const current = await this.eventsRepository.getById(eventId);
            ensureOpenForRegistration(current);

            const available = current.capacity - (current.reservedSeats ?? 0);
            if (quantity > available) {
                throw new AppError(noSeatsMessage(available), 409);
            }
        }

        throw new AppError("No se pudo reservar el cupo, intentá de nuevo", 409);
    }

    // Inscripción: el usuario sale de la sesión (req.user), nunca del body
    async create(eventId, quantityInput, user) {
        const quantity = validateQuantity(quantityInput);

        const event = await this.eventsRepository.getById(eventId);
        ensureOpenForRegistration(event);

        // Una inscripción activa por usuario y evento (para más lugares se usa quantity)
        const existing = await this.repository.getActiveByUserAndEvent(user.id, event._id);
        if (existing) {
            throw new AppError("Ya tenés una inscripción activa para este evento", 409);
        }

        // Primero se reserva el cupo (operación atómica) y después se crea el ticket
        await this.reserveSeats(event._id, quantity);

        let ticket;
        try {
            ticket = await this.createWithCode({
                user: user.id,
                event: event._id,
                quantity,
                status: TICKET_STATUS.CONFIRMED
            });
        } catch (error) {
            // Compensación: si el ticket no se pudo crear (por ejemplo, un duplicado que llegó al mismo tiempo
            // y rechazó el índice único), los lugares reservados se devuelven antes de responder el error
            await this.eventsRepository.releaseSeats(event._id, quantity);
            throw error;
        }

        const emailSent = await this.notifyConfirmation(user.email, event, ticket);

        return { ticket: new TicketDTO(ticket), emailSent };
    }

    // El permiso (dueño del ticket o admin) ya lo validó authorizeTicketOwnerOrAdmin.
    // Cancelar cambia el estado y guarda la fecha: el ticket no se borra y sus lugares vuelven al cupo del evento
    async cancel(ticket) {
        if (ticket.status === TICKET_STATUS.CANCELLED) {
            throw new AppError("El ticket ya está cancelado", 409);
        }

        const event = await this.eventsRepository.getById(ticket.event);
        if (event && currentStatus(event) === EVENT_STATUS.FINISHED) {
            throw new AppError("No se puede cancelar una inscripción de un evento finalizado", 409);
        }

        // Cancelación condicionada a que el ticket siga activo: con dos pedidos simultáneos, solo uno libera el cupo
        const cancelledTicket = await this.repository.cancelTicket(ticket._id);
        if (!cancelledTicket) {
            throw new AppError("El ticket ya está cancelado", 409);
        }

        await this.eventsRepository.releaseSeats(cancelledTicket.event, cancelledTicket.quantity);

        const emailSent = await this.notifyCancellation(event, cancelledTicket);

        return { ticket: new TicketDTO(cancelledTicket), emailSent };
    }
}

export const ticketsService = new TicketsService(ticketsRepository, eventsRepository, mailService, usersRepository);
