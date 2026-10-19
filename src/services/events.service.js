import { eventsRepository } from "../repositories/events.repository.js";
import { categoriesRepository } from "../repositories/categories.repository.js";
import { EVENT_STATUS, EVENT_STATUS_VALUES } from "../config/event-status.js";
import { AppError } from "../utils/errors.js";

// Campos que se toman del body: organizer y status nunca los decide el cliente
const EVENT_FIELDS = ["title", "description", "category", "date", "location", "capacity", "price"];
const REQUIRED_FIELDS = ["title", "description", "category", "date", "location", "capacity"];
const TEXT_FIELDS = ["title", "description", "location"];

// Listado: valores por defecto y un máximo por página para que nadie pida limit=100000
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_SORT = "date";
const SORT_FIELDS = ["date", "price", "capacity", "title", "createdAt"];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

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

function parsePositiveInteger(value, name, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }

    const number = Number(value);
    if (typeof value !== "string" || !Number.isInteger(number) || number < 1) {
        throw new AppError(`${name} debe ser un número entero mayor a cero`, 400);
    }

    return number;
}

// sort=date (ascendente) o sort=-date (descendente), solo sobre campos permitidos
function parseSort(value = DEFAULT_SORT) {
    const descending = typeof value === "string" && value.startsWith("-");
    const field = descending ? value.slice(1) : value;

    if (!SORT_FIELDS.includes(field)) {
        throw new AppError(`sort inválido. Campos permitidos: ${SORT_FIELDS.join(", ")} (con - adelante para orden descendente)`, 400);
    }

    const direction = descending ? -1 : 1;
    // _id desempata: sin un orden estable, dos eventos con la misma fecha podrían repetirse o saltearse entre páginas
    return { [field]: direction, _id: direction };
}

// Un query param repetido (?status=a&status=b) llega como array: se rechaza en lugar de usarlo en la consulta
function readTextParam(value, name) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new AppError(`El filtro ${name} no es válido`, 400);
    }

    return value.trim();
}

function parseDateParam(value, name, { endOfDay = false } = {}) {
    const text = readTextParam(value, name);
    const date = new Date(text);

    if (Number.isNaN(date.getTime())) {
        throw new AppError(`${name} no es una fecha válida`, 400);
    }

    // dateTo=2026-12-31 tiene que incluir los eventos de ese día, no cortar a las 00:00
    if (endOfDay && DATE_ONLY.test(text)) {
        date.setUTCHours(23, 59, 59, 999);
    }

    return date;
}

// El texto del usuario se escapa para que se busque literal y no se interprete como expresión regular
function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Con populate la referencia llega como objeto con sus campos; sin populate es solo el id
function toPublicRef(value, fields) {
    const isPopulated = value !== null && typeof value === "object" && fields.some(field => field in value);
    if (!isPopulated) {
        return value;
    }

    return { id: value._id, ...Object.fromEntries(fields.map(field => [field, value[field]])) };
}

// Datos que devuelve la API (id en lugar de _id, sin campos internos)
function toPublicEvent(event) {
    return {
        id: event._id,
        title: event.title,
        description: event.description,
        category: toPublicRef(event.category, ["name"]),
        date: event.date,
        location: event.location,
        capacity: event.capacity,
        price: event.price,
        status: event.status,
        organizer: toPublicRef(event.organizer, ["first_name", "last_name"])
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

    // Los publicados cuya fecha ya pasó quedan como finalizados antes de consultarlos:
    // así el estado es consistente sin depender de una tarea programada
    async finishPastEvents() {
        await this.repository.updateMany(
            { status: EVENT_STATUS.PUBLISHED, date: { $lt: new Date() } },
            { status: EVENT_STATUS.FINISHED }
        );
    }

    // Listado público con filtros (status, category, location, dateFrom, dateTo), paginación y orden
    async getAll(query = {}) {
        const { status, category, location, dateFrom, dateTo } = query;
        const page = parsePositiveInteger(query.page, "page", DEFAULT_PAGE);
        const limit = Math.min(parsePositiveInteger(query.limit, "limit", DEFAULT_LIMIT), MAX_LIMIT);
        const sort = parseSort(query.sort);

        // Los borradores no son públicos: sin filtro de estado se listan todos menos draft
        const filter = { status: { $ne: EVENT_STATUS.DRAFT } };

        if (status !== undefined) {
            const value = readTextParam(status, "status");

            if (!EVENT_STATUS_VALUES.includes(value)) {
                throw new AppError(`Estado inválido. Valores permitidos: ${EVENT_STATUS_VALUES.join(", ")}`, 400);
            }

            if (value === EVENT_STATUS.DRAFT) {
                throw new AppError("Los eventos en borrador no se listan públicamente", 400);
            }

            filter.status = value;
        }

        if (location !== undefined) {
            // Coincidencia parcial y sin distinguir mayúsculas: "rosa" encuentra "Rosario"
            filter.location = { $regex: escapeRegex(readTextParam(location, "location")), $options: "i" };
        }

        if (dateFrom !== undefined || dateTo !== undefined) {
            filter.date = {};

            if (dateFrom !== undefined) {
                filter.date.$gte = parseDateParam(dateFrom, "dateFrom");
            }

            if (dateTo !== undefined) {
                filter.date.$lte = parseDateParam(dateTo, "dateTo", { endOfDay: true });
            }

            if (filter.date.$gte && filter.date.$lte && filter.date.$gte > filter.date.$lte) {
                throw new AppError("dateFrom no puede ser posterior a dateTo", 400);
            }
        }

        if (category !== undefined) {
            const found = await this.categoriesRepository.getByIdOrName(readTextParam(category, "category"));

            // Una categoría inexistente no es un error del cliente: simplemente no hay eventos de esa categoría
            if (!found) {
                return { data: [], page, limit, total: 0, totalPages: 0 };
            }

            filter.category = found._id;
        }

        await this.finishPastEvents();

        const { docs, total } = await this.repository.getPage(filter, { skip: (page - 1) * limit, limit, sort });

        return {
            data: docs.map(toPublicEvent),
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        };
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
