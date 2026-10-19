import { test, describe } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ||= "clave-solo-para-los-tests-de-autorizacion";
const { ROLES, PERMISSIONS } = await import("../src/config/permissions.js");
const { authorizeRoles, createEventOwnershipMiddleware } = await import("../src/middlewares/authorize.middleware.js");
const { EventsService } = await import("../src/services/events.service.js");
const { UsersService } = await import("../src/services/users.service.js");

// Ejecuta un middleware como lo hace Express y devuelve cómo terminó
function run(middleware, req) {
    return new Promise(resolve => {
        const res = {
            statusCode: null,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(data) { this.body = data; resolve({ req, res, nextCalled: false }); return this; }
        };
        middleware(req, res, error => resolve({ req, res, nextCalled: true, error }));
    });
}

const admin = { id: "admin1", role: ROLES.ADMIN };
const organizer = { id: "org1", role: ROLES.ORGANIZER };
const otherOrganizer = { id: "org2", role: ROLES.ORGANIZER };
const player = { id: "user1", role: ROLES.USER };
const futureDate = () => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

describe("Matriz de permisos", () => {
    test("define quién puede cada acción", () => {
        assert.deepEqual([...PERMISSIONS.CREATE_EVENT], [ROLES.ORGANIZER, ROLES.ADMIN]);
        assert.deepEqual([...PERMISSIONS.MANAGE_EVENT], [ROLES.ORGANIZER, ROLES.ADMIN]);
        assert.deepEqual([...PERMISSIONS.MANAGE_USERS], [ROLES.ADMIN]);
    });

    test("no se puede modificar en tiempo de ejecución (Object.freeze)", () => {
        assert.throws(() => PERMISSIONS.MANAGE_USERS.push(ROLES.USER), TypeError);
        assert.throws(() => { PERMISSIONS.MANAGE_USERS = [ROLES.USER]; }, TypeError);
        assert.throws(() => { PERMISSIONS.NUEVA_ACCION = [ROLES.USER]; }, TypeError);
        assert.throws(() => { ROLES.ADMIN = "user"; }, TypeError);
        assert.deepEqual([...PERMISSIONS.MANAGE_USERS], [ROLES.ADMIN]);
    });
});

describe("authorizeRoles", () => {
    test("sin usuario autenticado responde 401", async () => {
        const { res, nextCalled } = await run(authorizeRoles(...PERMISSIONS.CREATE_EVENT), {});

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.message, "No autenticado");
    });

    test("con un rol no permitido responde 403", async () => {
        const { res, nextCalled } = await run(authorizeRoles(...PERMISSIONS.CREATE_EVENT), { user: player });

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.message, "No tenés permisos para realizar esta acción");
    });

    test("con un rol permitido llama a next()", async () => {
        for (const user of [organizer, admin]) {
            const { nextCalled } = await run(authorizeRoles(...PERMISSIONS.CREATE_EVENT), { user });
            assert.equal(nextCalled, true);
        }
    });

    test("las rutas administrativas son solo para admin", async () => {
        const forOrganizer = await run(authorizeRoles(...PERMISSIONS.MANAGE_USERS), { user: organizer });
        const forAdmin = await run(authorizeRoles(...PERMISSIONS.MANAGE_USERS), { user: admin });

        assert.equal(forOrganizer.res.statusCode, 403);
        assert.equal(forAdmin.nextCalled, true);
    });

    test("fail closed: sin roles permitidos nadie pasa", async () => {
        const { res } = await run(authorizeRoles(), { user: admin });

        assert.equal(res.statusCode, 403);
    });
});

describe("authorizeEventOwnerOrAdmin", () => {
    const event = { _id: "ev1", name: "Torneo", organizer: "org1", status: "active" };
    const repository = { async getById(id) { return id === "ev1" ? event : null; } };
    const ownership = createEventOwnershipMiddleware(repository);

    test("el organizer dueño pasa y el evento queda en req.event", async () => {
        const { req, nextCalled } = await run(ownership, { user: organizer, params: { eid: "ev1" } });

        assert.equal(nextCalled, true);
        assert.equal(req.event, event);
    });

    test("otro organizer recibe 403", async () => {
        const { res, nextCalled } = await run(ownership, { user: otherOrganizer, params: { eid: "ev1" } });

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.message, "No tenés permisos para modificar este evento");
    });

    test("el admin puede modificar cualquier evento", async () => {
        const { nextCalled } = await run(ownership, { user: admin, params: { eid: "ev1" } });

        assert.equal(nextCalled, true);
    });

    test("evento inexistente responde 404 y sin sesión 401", async () => {
        const notFound = await run(ownership, { user: organizer, params: { eid: "otro" } });
        const noSession = await run(ownership, { params: { eid: "ev1" } });

        assert.equal(notFound.res.statusCode, 404);
        assert.equal(noSession.res.statusCode, 401);
    });

    test("un error de la base pasa al manejador global", async () => {
        const failing = createEventOwnershipMiddleware({ async getById() { throw new Error("db caída"); } });
        const { nextCalled, error } = await run(failing, { user: organizer, params: { eid: "ev1" } });

        assert.equal(nextCalled, true);
        assert.equal(error.message, "db caída");
    });
});

describe("Reglas de eventos (EventsService)", () => {
    function createFakeRepository() {
        const events = [];
        return {
            events,
            async getAll(filter) { return events.filter(e => !filter?.status || e.status === filter.status); },
            async create(data) { const e = { _id: `ev${events.length + 1}`, ...data }; events.push(e); return e; },
            async update(id, data) { const e = events.find(ev => ev._id === id); Object.assign(e, data); return e; }
        };
    }

    test("al crear, el organizer sale de la sesión y el evento nace activo", async () => {
        const service = new EventsService(createFakeRepository());
        const event = await service.create({ name: "Torneo", type: "torneo", date: futureDate(), organizer: "otro", status: "cancelled" }, "org1");

        assert.equal(event.organizer, "org1");
        assert.equal(event.status, "active");
    });

    test("no se puede crear un evento con fecha pasada", async () => {
        const service = new EventsService(createFakeRepository());

        await assert.rejects(service.create({ name: "Torneo", date: "2020-01-01" }, "org1"), { status: 400 });
    });

    test("un evento cancelado no se modifica ni se vuelve a cancelar", async () => {
        const service = new EventsService(createFakeRepository());
        const cancelled = { _id: "ev1", status: "cancelled" };

        await assert.rejects(service.update(cancelled, { name: "Otro" }), { status: 409 });
        await assert.rejects(service.cancel(cancelled), { status: 409 });
    });

    test("el listado público solo muestra eventos activos", async () => {
        const repository = createFakeRepository();
        const service = new EventsService(repository);
        await service.create({ name: "Activo", date: futureDate() }, "org1");
        const toCancel = await service.create({ name: "Cancelado", date: futureDate() }, "org1");
        await service.cancel({ _id: toCancel.id, status: "active" });

        const events = await service.getAll();
        assert.deepEqual(events.map(e => e.name), ["Activo"]);
    });
});

describe("Administración de usuarios (UsersService)", () => {
    const users = [
        { _id: "admin1", first_name: "Ana", last_name: "Admin", email: "a@mail.com", password: "$2b$10$hash", role: ROLES.ADMIN },
        { _id: "user1", first_name: "Sofía", last_name: "García", email: "s@mail.com", password: "$2b$10$hash", role: ROLES.USER }
    ];
    const repository = {
        async getAll() { return users; },
        async getById(id) { return users.find(u => u._id === id) ?? null; },
        async updateRole(id, role) { return { ...users.find(u => u._id === id), role }; }
    };
    const service = new UsersService(repository);

    test("la lista de usuarios no incluye contraseñas", async () => {
        const list = await service.getAll();

        assert.ok(list.every(user => !("password" in user)));
    });

    test("cambia el rol con un valor válido", async () => {
        const updated = await service.changeRole("user1", ROLES.ORGANIZER, admin);

        assert.equal(updated.role, ROLES.ORGANIZER);
        assert.ok(!("password" in updated));
    });

    test("rechaza un rol inválido (400), el propio rol (409) y un usuario inexistente (404)", async () => {
        await assert.rejects(service.changeRole("user1", "superadmin", admin), { status: 400 });
        await assert.rejects(service.changeRole("admin1", ROLES.USER, admin), { status: 409 });
        await assert.rejects(service.changeRole("nadie", ROLES.USER, admin), { status: 404 });
    });
});
