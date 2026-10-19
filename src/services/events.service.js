import { eventsRepository } from "../repositories/events.repository.js";
import { categoriesRepository } from "../repositories/categories.repository.js";
import { EVENT_STATUS } from "../config/event-status.js";
import { AppError } from "../utils/errors.js";

// Campos que se toman del body: organizer y status nunca los decide el cliente
const EVENT_FIELDS = ["title", "description", "category", "date", "location", "capacity", "price"];
const REQUIRED_FIELDS = ["title", "description", "category", "date", "location", "capacity"];
const TEXT_FIELDS = ["title", "description", "location"];

function pickEventFields(data) {
    return Object.fromEntries(
        Object.entries(data ?? {}).filter(([field]) => EVENT_FIELDS.includes(field))
    );
}

function isEmpty(value) {
    return value === undefined || value === null || value === "";
}

function validateText(field, value) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new AppError(`El campo ${field} no puede estar vacío`, 400);
    }

    return value.trim();
}

// El schema también pide min: 1, pero el service responde con un mensaje claro antes de llegar a la base
function validateCapacity(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new AppError("La capacidad debe ser un número", 400);
    }

    if (!Number.isInteger(value) || value <= 0) {
        throw new AppError("La capacidad debe ser un número entero mayor a cero", 400);
    }

    return value;
}

function validatePrice(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new AppError("El precio debe ser un número", 400);
    }

    if (value < 0) {
        throw new AppError("El precio no puede ser negativo", 400);
    }

    return value;
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
        title: event.title,
        description: event.description,
        category: event.category,
        date: event.date,
        location: event.location,
        capacity: event.capacity,
        price: event.price,
        status: event.status,
        organizer: event.organizer
    };
}

export class EventsService {
    constructor(repository, categoriesRepository) {
        this.repository = repository;
        this.categoriesRepository = categoriesRepository;
    }

    // La categoría se acepta por id o por nombre ("workshop"); en el evento siempre se guarda la referencia
    async resolveCategoryId(value) {
        if (typeof value !== "string") {
            throw new AppError("La categoría no es válida", 400);
        }

        const category = await this.categoriesRepository.getByIdOrName(value);
        if (!category) {
            throw new AppError("La categoría no existe", 400);
        }

        return category._id;
    }

    // Valida y normaliza los campos del body. Al crear tienen que estar todos los obligatorios;
    // al editar solo se validan los que llegan
    async normalizeEventData(data, { isNew }) {
        const eventData = pickEventFields(data);

        if (isNew) {
            const missing = REQUIRED_FIELDS.filter(field => isEmpty(eventData[field]));
            if (missing.length > 0) {
                throw new AppError(`Faltan campos obligatorios: ${missing.join(", ")}`, 400);
            }
        }

        for (const field of TEXT_FIELDS) {
            if (eventData[field] !== undefined) {
                eventData[field] = validateText(field, eventData[field]);
            }
        }

        if (eventData.capacity !== undefined) {
            eventData.capacity = validateCapacity(eventData.capacity);
        }

        if (eventData.price !== undefined) {
            eventData.price = validatePrice(eventData.price);
        }

        if (eventData.date !== undefined) {
            eventData.date = validateFutureDate(eventData.date);
        }

        if (eventData.category !== undefined) {
            eventData.category = await this.resolveCategoryId(eventData.category);
        }

        return eventData;
    }

    // Consulta pública: los borradores todavía no se muestran
    async getAll() {
        const events = await this.repository.getAll({ status: { $ne: EVENT_STATUS.DRAFT } });
        return events.map(toPublicEvent);
    }

    async create(data, organizerId) {
        const eventData = await this.normalizeEventData(data, { isNew: true });

        // El organizador es siempre el usuario logueado y todo evento nace como borrador (se publica con un cambio de estado)
        const newEvent = await this.repository.create({
            ...eventData,
            organizer: organizerId,
            status: EVENT_STATUS.DRAFT
        });

        return toPublicEvent(newEvent);
    }

    // El permiso (dueño o admin) ya lo validó authorizeEventOwnerOrAdmin; acá van las reglas del evento
    async update(event, changes) {
        if (event.status === EVENT_STATUS.CANCELLED) {
            throw new AppError("Un evento cancelado no puede modificarse", 409);
        }

        if (event.status === EVENT_STATUS.FINISHED) {
            throw new AppError("Un evento finalizado no puede modificarse", 409);
        }

        const eventData = await this.normalizeEventData(changes, { isNew: false });
        if (Object.keys(eventData).length === 0) {
            throw new AppError("No hay campos válidos para actualizar", 400);
        }

        const updatedEvent = await this.repository.update(event._id, eventData);
        return toPublicEvent(updatedEvent);
    }

    async cancel(event) {
        if (event.status === EVENT_STATUS.CANCELLED) {
            throw new AppError("El evento ya está cancelado", 409);
        }

        const cancelledEvent = await this.repository.update(event._id, { status: EVENT_STATUS.CANCELLED });
        return toPublicEvent(cancelledEvent);
    }
}

export const eventsService = new EventsService(eventsRepository, categoriesRepository);
