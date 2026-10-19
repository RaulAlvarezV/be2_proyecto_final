import { eventsRepository } from "../repositories/events.repository.js";
import { AppError } from "../utils/errors.js";

// Campos que se toman del body: organizer y status nunca los decide el cliente
const EVENT_FIELDS = ["name", "description", "type", "date", "place", "capacity", "price", "category"];

function pickEventFields(data = {}) {
    return Object.fromEntries(
        Object.entries(data).filter(([field]) => EVENT_FIELDS.includes(field))
    );
}

// Regla de negocio: un torneo o clínica no se puede programar en el pasado
function validateFutureDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new AppError("La fecha no es válida", 400);
    }

    if (date <= new Date()) {
        throw new AppError("La fecha del evento debe ser futura", 400);
    }

    return date;
}

// Datos que devuelve la API (id en lugar de _id, sin campos internos)
function toPublicEvent(event) {
    return {
        id: event._id,
        name: event.name,
        description: event.description,
        type: event.type,
        date: event.date,
        place: event.place,
        capacity: event.capacity,
        price: event.price,
        status: event.status,
        category: event.category,
        organizer: event.organizer
    };
}

export class EventsService {
    constructor(repository) {
        this.repository = repository;
    }

    // Consulta pública: solo los eventos publicados (activos), no los cancelados
    async getAll() {
        const events = await this.repository.getAll({ status: "active" });
        return events.map(toPublicEvent);
    }

    async create(data, organizerId) {
        const eventData = pickEventFields(data);

        if (eventData.date !== undefined) {
            eventData.date = validateFutureDate(eventData.date);
        }

        // El organizador es siempre el usuario logueado y todo evento nace activo.
        // Los campos obligatorios, el tipo, el cupo y el precio los valida el schema de Mongoose
        const newEvent = await this.repository.create({
            ...eventData,
            organizer: organizerId,
            status: "active"
        });

        return toPublicEvent(newEvent);
    }

    // El permiso (dueño o admin) ya lo validó authorizeEventOwnerOrAdmin; acá van las reglas del evento
    async update(event, changes) {
        if (event.status === "cancelled") {
            throw new AppError("Un evento cancelado no puede modificarse", 409);
        }

        const eventData = pickEventFields(changes);
        if (Object.keys(eventData).length === 0) {
            throw new AppError("No hay campos válidos para actualizar", 400);
        }

        if (eventData.date !== undefined) {
            eventData.date = validateFutureDate(eventData.date);
        }

        const updatedEvent = await this.repository.update(event._id, eventData);
        return toPublicEvent(updatedEvent);
    }

    async cancel(event) {
        if (event.status === "cancelled") {
            throw new AppError("El evento ya está cancelado", 409);
        }

        const cancelledEvent = await this.repository.update(event._id, { status: "cancelled" });
        return toPublicEvent(cancelledEvent);
    }
}

export const eventsService = new EventsService(eventsRepository);
