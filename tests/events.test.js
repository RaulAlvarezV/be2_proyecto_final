import { test, describe } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ||= "clave-solo-para-los-tests-de-eventos";
const { EVENT_STATUS, STATUS_TRANSITIONS } = await import("../src/config/event-status.js");
const { EventsService } = await import("../src/services/events.service.js");
const { CategoriesService } = await import("../src/services/categories.service.js");

const DAY = 24 * 3600 * 1000;
const futureDate = (days = 7) => new Date(Date.now() + days * DAY).toISOString();
const pastDate = () => new Date(Date.now() - DAY).toISOString();

const categories = [
    { _id: "cat-torneo", name: "torneo" },
    { _id: "cat-workshop", name: "workshop" }
];

// Repository falso de categorías: acepta id o nombre, como el real
const categoriesRepository = {
    async getByIdOrName(value) {
        return categories.find(c => c._id === value || c.name === value.trim().toLowerCase()) ?? null;
    }
};

// Repository falso de tickets: sin lugares reservados y registra las cancelaciones en cascada
const ticketsRepository = {
    reserved: 0,
    cancelledEvents: [],
    async getReservedSeats() { return this.reserved; },
    async cancelActiveByEvent(eventId) { this.cancelledEvents.push(eventId); return { modifiedCount: 1 }; }
};

// Repository falso de eventos: guarda en memoria y registra la última consulta del listado
function createFakeRepository(initial = []) {
    const events = [...initial];
    return {
        events,
        lastPage: null,
        finishCalls: 0,
        async getPage(filter, options) {
            this.lastPage = { filter, options };
            return { docs: events.slice(options.skip, options.skip + options.limit), total: events.length };
        },
        async getDetailById(id) { return events.find(e => e._id === id) ?? null; },
        async create(data) { const e = { _id: `ev${events.length + 1}`, ...data }; events.push(e); return e; },
        async update(id, data) { const e = events.find(ev => ev._id === id); Object.assign(e, data); return e; },
        async updateMany() { this.finishCalls += 1; return { modifiedCount: 0 }; }
    };
}

const validEvent = (changes = {}) => ({
    title: "Torneo Apertura",
    description: "Torneo de seven sub 16",
    category: "torneo",
    date: futureDate(),
    location: "Rosario",
    capacity: 16,
    price: 15000,
    ...changes
});

describe("Crear eventos (EventsService.create)", () => {
    test("crea el evento como borrador, con la referencia de la categoría y el organizer de la sesión", async () => {
        const repository = createFakeRepository();
        const service = new EventsService(repository, categoriesRepository, ticketsRepository);

        const event = await service.create(validEvent({ title: "  Torneo Apertura  ", organizer: "otro", status: "published" }), "org1");

        assert.equal(event.status, EVENT_STATUS.DRAFT);
        assert.equal(event.organizer, "org1");
        assert.equal(event.category, "cat-torneo");
        assert.equal(event.title, "Torneo Apertura");
        assert.ok(event.date instanceof Date);
    });

    test("acepta la categoría por id", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);

        const event = await service.create(validEvent({ category: "cat-workshop" }), "org1");

        assert.equal(event.category, "cat-workshop");
    });

    test("rechaza fecha pasada y fecha inválida con mensajes distintos", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);

        await assert.rejects(service.create(validEvent({ date: pastDate() }), "org1"), { status: 400, message: "La fecha del evento debe ser futura" });
        await assert.rejects(service.create(validEvent({ date: "no-es-fecha" }), "org1"), { status: 400, message: "La fecha no es válida" });
    });

    test("rechaza capacity 0, negativa, decimal o como texto", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);

        for (const capacity of [0, -5, 2.5]) {
            await assert.rejects(service.create(validEvent({ capacity }), "org1"), { status: 400, message: "La capacidad debe ser un número entero mayor a cero" });
        }
        await assert.rejects(service.create(validEvent({ capacity: "10" }), "org1"), { status: 400, message: "La capacidad debe ser un número" });
    });

    test("rechaza precio negativo y acepta precio 0 (evento gratuito)", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);

        await assert.rejects(service.create(validEvent({ price: -1 }), "org1"), { status: 400, message: "El precio no puede ser negativo" });
        await assert.rejects(service.create(validEvent({ price: "gratis" }), "org1"), { status: 400, message: "El precio debe ser un número" });

        const free = await service.create(validEvent({ price: 0 }), "org1");
        assert.equal(free.price, 0);
    });

    test("informa qué campos obligatorios faltan y rechaza textos vacíos", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);

        await assert.rejects(service.create({ title: "Torneo" }, "org1"), {
            status: 400,
            message: "Faltan campos obligatorios: description, category, date, location, capacity"
        });
        await assert.rejects(service.create(validEvent({ location: "   " }), "org1"), { status: 400, message: "El campo location no puede estar vacío" });
        await assert.rejects(service.create(undefined, "org1"), { status: 400 });
    });

    test("rechaza una categoría que no existe o que no es texto", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);

        await assert.rejects(service.create(validEvent({ category: "hockey-sobre-hielo" }), "org1"), { status: 400, message: "La categoría no existe" });
        await assert.rejects(service.create(validEvent({ category: { $ne: null } }), "org1"), { status: 400, message: "La categoría no es válida" });
    });
});

describe("Editar eventos (EventsService.update)", () => {
    test("actualiza solo los campos permitidos y los valida", async () => {
        const repository = createFakeRepository([{ _id: "ev1", ...validEvent(), status: EVENT_STATUS.PUBLISHED, organizer: "org1" }]);
        const service = new EventsService(repository, categoriesRepository, ticketsRepository);

        const updated = await service.update(repository.events[0], { capacity: 20, organizer: "otro", status: "cancelled" });

        assert.equal(updated.capacity, 20);
        assert.equal(updated.organizer, "org1");
        assert.equal(updated.status, EVENT_STATUS.PUBLISHED);
        await assert.rejects(service.update(repository.events[0], { capacity: 0 }), { status: 400 });
        await assert.rejects(service.update(repository.events[0], { date: pastDate() }), { status: 400 });
    });

    test("sin campos válidos responde 400", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);

        await assert.rejects(service.update({ _id: "ev1", status: EVENT_STATUS.DRAFT }, { status: "published" }), {
            status: 400,
            message: "No hay campos válidos para actualizar"
        });
    });

    test("un evento cancelado o finalizado no se modifica", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);

        await assert.rejects(service.update({ _id: "ev1", status: EVENT_STATUS.CANCELLED, date: futureDate() }, { title: "Otro" }), {
            status: 409,
            message: "Un evento cancelado no puede modificarse"
        });
        await assert.rejects(service.update({ _id: "ev1", status: EVENT_STATUS.FINISHED, date: pastDate() }, { title: "Otro" }), {
            status: 409,
            message: "Un evento finalizado no puede modificarse"
        });
    });

    test("un publicado cuya fecha ya pasó cuenta como finalizado aunque la base diga published", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);

        await assert.rejects(service.update({ _id: "ev1", status: EVENT_STATUS.PUBLISHED, date: pastDate() }, { title: "Otro" }), {
            status: 409,
            message: "Un evento finalizado no puede modificarse"
        });
    });
});

describe("Cambio de estado (EventsService.changeStatus)", () => {
    const draft = () => ({ _id: "ev1", status: EVENT_STATUS.DRAFT, date: futureDate() });

    test("draft → published y published → cancelled", async () => {
        const repository = createFakeRepository([draft()]);
        const service = new EventsService(repository, categoriesRepository, ticketsRepository);

        const published = await service.changeStatus(repository.events[0], EVENT_STATUS.PUBLISHED);
        const cancelled = await service.changeStatus(repository.events[0], EVENT_STATUS.CANCELLED);

        assert.equal(published.status, EVENT_STATUS.PUBLISHED);
        assert.equal(cancelled.status, EVENT_STATUS.CANCELLED);
    });

    test("un evento cancelado no cambia de estado", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);
        const cancelled = { _id: "ev1", status: EVENT_STATUS.CANCELLED, date: futureDate() };

        await assert.rejects(service.changeStatus(cancelled, EVENT_STATUS.PUBLISHED), { status: 409, message: "Un evento cancelado no puede cambiar de estado" });
    });

    test("no se publica un evento finalizado ni un borrador con fecha vencida", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);

        await assert.rejects(service.changeStatus({ _id: "ev1", status: EVENT_STATUS.FINISHED, date: pastDate() }, EVENT_STATUS.PUBLISHED), {
            status: 409,
            message: "Un evento finalizado no puede cambiar de estado"
        });
        await assert.rejects(service.changeStatus({ _id: "ev1", status: EVENT_STATUS.DRAFT, date: pastDate() }, EVENT_STATUS.PUBLISHED), {
            status: 400,
            message: "No se puede publicar un evento cuya fecha ya pasó"
        });
    });

    test("rechaza estado faltante, inválido, finished a mano, repetido y transiciones no permitidas", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);
        const published = { _id: "ev1", status: EVENT_STATUS.PUBLISHED, date: futureDate() };

        await assert.rejects(service.changeStatus(draft(), undefined), { status: 400, message: "Falta el nuevo estado (status)" });
        await assert.rejects(service.changeStatus(draft(), "archivado"), { status: 400 });
        await assert.rejects(service.changeStatus(draft(), EVENT_STATUS.FINISHED), { status: 400 });
        await assert.rejects(service.changeStatus(published, EVENT_STATUS.PUBLISHED), { status: 409, message: "El evento ya está en estado published" });
        await assert.rejects(service.changeStatus(published, EVENT_STATUS.DRAFT), { status: 409, message: "No se puede pasar de published a draft" });
    });

    test("la tabla de transiciones no se puede modificar en tiempo de ejecución", () => {
        assert.throws(() => STATUS_TRANSITIONS[EVENT_STATUS.CANCELLED].push(EVENT_STATUS.PUBLISHED), TypeError);
        assert.throws(() => { STATUS_TRANSITIONS[EVENT_STATUS.FINISHED] = [EVENT_STATUS.DRAFT]; }, TypeError);
        assert.throws(() => { EVENT_STATUS.DRAFT = "otro"; }, TypeError);
        assert.deepEqual([...STATUS_TRANSITIONS[EVENT_STATUS.CANCELLED]], []);
    });
});

describe("Listado con filtros y paginación (EventsService.getAll)", () => {
    test("arma el filtro de la consigna: ?status=published&category=workshop&page=2&limit=5", async () => {
        const repository = createFakeRepository(Array.from({ length: 12 }, (_, i) => ({ _id: `ev${i + 1}`, title: `Workshop ${i + 1}` })));
        const service = new EventsService(repository, categoriesRepository, ticketsRepository);

        const result = await service.getAll({ status: "published", category: "workshop", page: "2", limit: "5" });

        assert.deepEqual(repository.lastPage.filter, { status: "published", category: "cat-workshop" });
        assert.equal(repository.lastPage.options.skip, 5);
        assert.equal(repository.lastPage.options.limit, 5);
        assert.deepEqual(Object.keys(result), ["data", "page", "limit", "total", "totalPages"]);
        assert.equal(result.page, 2);
        assert.equal(result.total, 12);
        assert.equal(result.totalPages, 3);
        assert.deepEqual(result.data.map(e => e.title), ["Workshop 6", "Workshop 7", "Workshop 8", "Workshop 9", "Workshop 10"]);
    });

    test("sin filtros oculta los borradores, usa page 1, limit 10, orden por fecha y finaliza los vencidos", async () => {
        const repository = createFakeRepository();
        const service = new EventsService(repository, categoriesRepository, ticketsRepository);

        const result = await service.getAll();

        assert.deepEqual(repository.lastPage.filter, { status: { $ne: EVENT_STATUS.DRAFT } });
        assert.deepEqual(repository.lastPage.options, { skip: 0, limit: 10, sort: { date: 1, _id: 1 } });
        assert.equal(result.totalPages, 0);
        assert.equal(repository.finishCalls, 1);
    });

    test("location parcial sin mayúsculas, con el texto escapado", async () => {
        const repository = createFakeRepository();
        const service = new EventsService(repository, categoriesRepository, ticketsRepository);

        await service.getAll({ location: "buenos" });
        assert.deepEqual(repository.lastPage.filter.location, { $regex: "buenos", $options: "i" });

        await service.getAll({ location: ".*" });
        assert.deepEqual(repository.lastPage.filter.location, { $regex: "\\.\\*", $options: "i" });
    });

    test("rango de fechas: dateTo con solo el día incluye todo ese día", async () => {
        const repository = createFakeRepository();
        const service = new EventsService(repository, categoriesRepository, ticketsRepository);

        await service.getAll({ dateFrom: "2026-11-01", dateTo: "2026-11-30" });

        assert.equal(repository.lastPage.filter.date.$gte.toISOString(), "2026-11-01T00:00:00.000Z");
        assert.equal(repository.lastPage.filter.date.$lte.toISOString(), "2026-11-30T23:59:59.999Z");
    });

    test("sort descendente, limit con tope de 50", async () => {
        const repository = createFakeRepository();
        const service = new EventsService(repository, categoriesRepository, ticketsRepository);

        const result = await service.getAll({ sort: "-price", limit: "100000" });

        assert.deepEqual(repository.lastPage.options.sort, { price: -1, _id: -1 });
        assert.equal(result.limit, 50);
    });

    test("una categoría inexistente devuelve una página vacía sin consultar eventos", async () => {
        const repository = createFakeRepository([{ _id: "ev1" }]);
        const service = new EventsService(repository, categoriesRepository, ticketsRepository);

        const result = await service.getAll({ category: "polo" });

        assert.deepEqual(result, { data: [], page: 1, limit: 10, total: 0, totalPages: 0 });
        assert.equal(repository.lastPage, null);
    });

    test("query params inválidos responden 400 con su propio mensaje", async () => {
        const service = new EventsService(createFakeRepository(), categoriesRepository, ticketsRepository);
        const cases = [
            [{ page: "0" }, "page debe ser un número entero mayor a cero"],
            [{ limit: "diez" }, "limit debe ser un número entero mayor a cero"],
            [{ sort: "password" }, /^sort inválido/],
            [{ status: "archivado" }, /^Estado inválido/],
            [{ status: "draft" }, "Los eventos en borrador no se listan públicamente"],
            [{ status: ["published", "draft"] }, "El filtro status no es válido"],
            [{ dateFrom: "ayer" }, "dateFrom no es una fecha válida"],
            [{ dateFrom: "2027-01-01", dateTo: "2026-01-01" }, "dateFrom no puede ser posterior a dateTo"]
        ];

        for (const [query, message] of cases) {
            await assert.rejects(service.getAll(query), { status: 400, message });
        }
    });
});

describe("Detalle de un evento (EventsService.getById)", () => {
    test("devuelve categoría y organizador con id en lugar de _id y sin el email", async () => {
        const repository = createFakeRepository([{
            _id: "ev1",
            ...validEvent(),
            status: EVENT_STATUS.PUBLISHED,
            category: { _id: "cat-torneo", name: "torneo" },
            organizer: { _id: "org1", first_name: "Raúl", last_name: "Álvarez" }
        }]);
        const service = new EventsService(repository, categoriesRepository, ticketsRepository);

        const event = await service.getById("ev1");

        assert.deepEqual(event.category, { id: "cat-torneo", name: "torneo" });
        assert.deepEqual(event.organizer, { id: "org1", first_name: "Raúl", last_name: "Álvarez" });
    });

    test("inexistente o borrador responde 404", async () => {
        const repository = createFakeRepository([{ _id: "ev1", status: EVENT_STATUS.DRAFT }]);
        const service = new EventsService(repository, categoriesRepository, ticketsRepository);

        await assert.rejects(service.getById("ev1"), { status: 404, message: "Evento no encontrado" });
        await assert.rejects(service.getById("nada"), { status: 404 });
    });
});

describe("Categorías (CategoriesService)", () => {
    function createFakeCategories() {
        const items = [{ _id: "cat1", name: "torneo" }];
        return {
            items,
            async getAll() { return items; },
            async getByName(name) { return items.find(c => c.name === name) ?? null; },
            async create(data) { const c = { _id: `cat${items.length + 1}`, ...data }; items.push(c); return c; }
        };
    }

    test("guarda el nombre en minúsculas y sin espacios", async () => {
        const service = new CategoriesService(createFakeCategories());

        const category = await service.create({ name: "  Workshop " });

        assert.deepEqual({ ...category }, { id: "cat2", name: "workshop", description: undefined });
    });

    test("rechaza nombre vacío (400) y duplicado sin importar mayúsculas (409)", async () => {
        const service = new CategoriesService(createFakeCategories());

        await assert.rejects(service.create({ name: "   " }), { status: 400 });
        await assert.rejects(service.create({}), { status: 400 });
        await assert.rejects(service.create({ name: "TORNEO" }), { status: 409, message: "La categoría ya existe" });
    });
});
