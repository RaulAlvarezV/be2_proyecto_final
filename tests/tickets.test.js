import { test, describe } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ||= "clave-solo-para-los-tests-de-tickets";
const { TICKET_STATUS, ACTIVE_TICKET_STATUS } = await import("../src/config/ticket-status.js");
const { EVENT_STATUS } = await import("../src/config/event-status.js");
const { ROLES } = await import("../src/config/permissions.js");
const { TicketsService } = await import("../src/services/tickets.service.js");
const { EventsService } = await import("../src/services/events.service.js");
const { MailService } = await import("../src/services/mail.service.js");
const { ticketsRepository } = await import("../src/repositories/tickets.repository.js");
const { createTicketOwnershipMiddleware, createEventOwnershipMiddleware } = await import("../src/middlewares/authorize.middleware.js");
const { errorHandler } = await import("../src/middlewares/error.middleware.js");

const DAY = 24 * 3600 * 1000;
const futureDate = () => new Date(Date.now() + 7 * DAY);
const pastDate = () => new Date(Date.now() - DAY);

const player = { id: "user1", email: "jugadora@mail.com", role: ROLES.USER };
const otherPlayer = { id: "user2", email: "otro@mail.com", role: ROLES.USER };
const admin = { id: "admin1", email: "admin@mail.com", role: ROLES.ADMIN };

const publishedEvent = (changes = {}) => ({
    _id: "ev1",
    title: "Torneo Apertura",
    date: futureDate(),
    location: "Rosario",
    capacity: 3,
    status: EVENT_STATUS.PUBLISHED,
    organizer: "org1",
    ...changes
});

// Repository falso de tickets en memoria: calcula el cupo igual que el real (solo tickets activos)
function createFakeTickets(initial = []) {
    const tickets = [...initial];
    return {
        tickets,
        async getById(id) { return tickets.find(t => t._id === id) ?? null; },
        async getActiveByUserAndEvent(user, event) {
            return tickets.find(t => t.user === user && t.event === event && ACTIVE_TICKET_STATUS.includes(t.status)) ?? null;
        },
        async countReservedSeats(event) {
            return tickets
                .filter(t => t.event === event && ACTIVE_TICKET_STATUS.includes(t.status))
                .reduce((total, t) => total + t.quantity, 0);
        },
        async getByUser(user) { return tickets.filter(t => t.user === user); },
        async getByEvent(event) { return tickets.filter(t => t.event === event); },
        async create(data) {
            const ticket = { _id: `t${tickets.length + 1}`, createdAt: new Date(), cancelledAt: null, ...data };
            tickets.push(ticket);
            return ticket;
        },
        // Como el real: solo cancela si el ticket sigue activo (si no, null)
        async cancelTicket(id) {
            const t = tickets.find(ticket => ticket._id === id && ACTIVE_TICKET_STATUS.includes(ticket.status));
            if (!t) return null;
            Object.assign(t, { status: TICKET_STATUS.CANCELLED, cancelledAt: new Date() });
            return t;
        }
    };
}

// Repository falso de eventos: la reserva respeta las mismas condiciones que la consulta atómica del real
function createFakeEvents(events = [publishedEvent()]) {
    return {
        events,
        async getById(id) { return events.find(e => e._id === id) ?? null; },
        async reserveSeats(id, quantity, now) {
            const event = events.find(e => e._id === id);
            const fits = event && event.status === EVENT_STATUS.PUBLISHED && new Date(event.date) > now &&
                (event.reservedSeats ?? 0) + quantity <= event.capacity;
            if (!fits) return null;
            event.reservedSeats = (event.reservedSeats ?? 0) + quantity;
            return event;
        },
        async releaseSeats(id, quantity) {
            const event = events.find(e => e._id === id);
            event.reservedSeats = Math.max(0, (event.reservedSeats ?? 0) - quantity);
            return event;
        }
    };
}

// Mailer falso: registra los emails en lugar de enviarlos
function createFakeMailer({ fail = false } = {}) {
    return {
        sent: [],
        async sendTicketConfirmation(data) {
            if (fail) {
                throw new Error("SMTP caído");
            }
            this.sent.push(data);
            return true;
        }
    };
}

function createService({ tickets = createFakeTickets(), events = createFakeEvents(), mailer = createFakeMailer() } = {}) {
    return { service: new TicketsService(tickets, events, mailer), tickets, events, mailer };
}

// Ejecuta un middleware como lo hace Express y devuelve cómo terminó
function run(middleware, req) {
    return new Promise(resolve => {
        const res = {
            statusCode: null,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(data) { this.body = data; resolve({ req, res, nextCalled: false }); return this; }
        };
        // Como Express: next() sin error sigue al controller; next(error) lo responde el manejador global
        middleware(req, res, error => error ? errorHandler(error, req, res, () => {}) : resolve({ req, res, nextCalled: true }));
    });
}

describe("Estados del ticket", () => {
    test("activos = confirmed y pending; cancelled no ocupa cupo", () => {
        assert.deepEqual([...ACTIVE_TICKET_STATUS], [TICKET_STATUS.CONFIRMED, TICKET_STATUS.PENDING]);
        assert.ok(!ACTIVE_TICKET_STATUS.includes(TICKET_STATUS.CANCELLED));
    });

    test("las constantes no se pueden modificar en tiempo de ejecución", () => {
        assert.throws(() => ACTIVE_TICKET_STATUS.push(TICKET_STATUS.CANCELLED), TypeError);
        assert.throws(() => { TICKET_STATUS.CONFIRMED = "ok"; }, TypeError);
        assert.equal(TICKET_STATUS.CONFIRMED, "confirmed");
    });
});

describe("Inscripción (TicketsService.create)", () => {
    test("crea un ticket confirmado con el usuario de la sesión, código de reserva y email", async () => {
        const { service, mailer } = createService();

        const { ticket, emailSent } = await service.create("ev1", 2, player);

        assert.equal(ticket.status, TICKET_STATUS.CONFIRMED);
        assert.equal(ticket.user, player.id);
        assert.equal(ticket.event, "ev1");
        assert.equal(ticket.quantity, 2);
        assert.match(ticket.reservationCode, /^HKY-[0-9A-F]{8}$/);
        assert.equal(emailSent, true);
        assert.equal(mailer.sent[0].to, player.email);
        assert.equal(mailer.sent[0].reservationCode, ticket.reservationCode);
        assert.equal(mailer.sent[0].eventTitle, "Torneo Apertura");
    });

    test("sin quantity reserva 1 lugar", async () => {
        const { service } = createService();

        const { ticket } = await service.create("ev1", undefined, player);

        assert.equal(ticket.quantity, 1);
    });

    test("si el email falla, la inscripción igual queda hecha", async () => {
        const { service, tickets } = createService({ mailer: createFakeMailer({ fail: true }) });

        const { ticket, emailSent } = await service.create("ev1", 1, player);

        assert.equal(emailSent, false);
        assert.equal(ticket.status, TICKET_STATUS.CONFIRMED);
        assert.equal(tickets.tickets.length, 1);
    });

    test("evento inexistente o en borrador responde 404", async () => {
        const { service } = createService({ events: createFakeEvents([publishedEvent({ _id: "draft", status: EVENT_STATUS.DRAFT })]) });

        await assert.rejects(service.create("nada", 1, player), { status: 404, message: "Evento no encontrado" });
        await assert.rejects(service.create("draft", 1, player), { status: 404 });
    });

    test("evento cancelado o finalizado (también publicado con fecha pasada) no admite inscripciones", async () => {
        const events = createFakeEvents([
            publishedEvent({ _id: "cancelado", status: EVENT_STATUS.CANCELLED }),
            publishedEvent({ _id: "finalizado", status: EVENT_STATUS.FINISHED, date: pastDate() }),
            publishedEvent({ _id: "vencido", date: pastDate() })
        ]);
        const { service } = createService({ events });

        await assert.rejects(service.create("cancelado", 1, player), { status: 409, message: "El evento está cancelado: no admite inscripciones" });
        await assert.rejects(service.create("finalizado", 1, player), { status: 409, message: "El evento ya finalizó: no admite inscripciones" });
        await assert.rejects(service.create("vencido", 1, player), { status: 409, message: "El evento ya finalizó: no admite inscripciones" });
    });

    test("quantity inválida responde 400 sin crear nada", async () => {
        const { service, tickets } = createService();

        for (const quantity of [0, -2, 1.5]) {
            await assert.rejects(service.create("ev1", quantity, player), { status: 400, message: "La cantidad debe ser un número entero mayor a cero" });
        }
        await assert.rejects(service.create("ev1", "2", player), { status: 400, message: "La cantidad debe ser un número" });
        assert.equal(tickets.tickets.length, 0);
    });

    test("no permite dos inscripciones activas al mismo evento", async () => {
        const { service } = createService();
        await service.create("ev1", 1, player);

        await assert.rejects(service.create("ev1", 1, player), { status: 409, message: "Ya tenés una inscripción activa para este evento" });
    });

    test("sin cupo suficiente responde 409 con los lugares que quedan", async () => {
        const { service } = createService();
        await service.create("ev1", 2, player);

        await assert.rejects(service.create("ev1", 2, otherPlayer), { status: 409, message: "No hay cupos suficientes: quedan 1 lugares disponibles" });
        await service.create("ev1", 1, otherPlayer);
        await assert.rejects(service.create("ev1", 1, admin), { status: 409, message: "No hay cupos suficientes: el evento no tiene lugares disponibles" });
    });

    test("los tickets cancelados no ocupan cupo: al cancelar se puede volver a inscribir", async () => {
        const { service, tickets } = createService();
        const { ticket } = await service.create("ev1", 3, player);

        await service.cancel(tickets.tickets.find(t => t._id === ticket.id));

        const { ticket: newTicket } = await service.create("ev1", 3, otherPlayer);
        assert.equal(newTicket.status, TICKET_STATUS.CONFIRMED);

        // El primero ya no tiene inscripción activa (no es duplicado), pero ahora el cupo lo ocupa el otro
        await assert.rejects(service.create("ev1", 1, player), { status: 409, message: "No hay cupos suficientes: el evento no tiene lugares disponibles" });
    });

    test("si el código de reserva se repite, genera otro", async () => {
        const tickets = createFakeTickets();
        const originalCreate = tickets.create;
        let calls = 0;
        tickets.create = async function (data) {
            calls += 1;
            if (calls === 1) {
                throw Object.assign(new Error("duplicado"), { code: 11000, keyPattern: { reservationCode: 1 } });
            }
            return originalCreate.call(this, data);
        };
        const { service } = createService({ tickets });

        const { ticket } = await service.create("ev1", 1, player);

        assert.equal(calls, 2);
        assert.ok(ticket.reservationCode);
    });
});

describe("Consultas de tickets", () => {
    test("mis tickets: solo los del usuario de la sesión", async () => {
        const { service } = createService();
        await service.create("ev1", 1, player);
        await service.create("ev1", 1, otherPlayer);

        const mine = await service.getMine(player.id);

        assert.equal(mine.length, 1);
        assert.equal(mine[0].user, player.id);
    });

    test("inscriptos de un evento con el resumen de cupo", async () => {
        const { service, events } = createService();
        await service.create("ev1", 2, player);

        const result = await service.getByEvent(events.events[0]);

        assert.deepEqual(result.summary, { capacity: 3, reserved: 2, available: 1 });
        assert.equal(result.tickets.length, 1);
    });
});

describe("Cancelación (TicketsService.cancel)", () => {
    test("pasa a cancelled, guarda cancelledAt y no borra el ticket", async () => {
        const { service, tickets } = createService();
        await service.create("ev1", 1, player);

        const cancelled = await service.cancel(tickets.tickets[0]);

        assert.equal(cancelled.status, TICKET_STATUS.CANCELLED);
        assert.ok(cancelled.cancelledAt instanceof Date);
        assert.equal(tickets.tickets.length, 1);
    });

    test("no se cancela dos veces ni un ticket de un evento finalizado", async () => {
        const events = createFakeEvents([publishedEvent(), publishedEvent({ _id: "pasado", date: pastDate() })]);
        const { service } = createService({ events });

        await assert.rejects(service.cancel({ _id: "t1", event: "ev1", status: TICKET_STATUS.CANCELLED }), { status: 409, message: "El ticket ya está cancelado" });
        await assert.rejects(service.cancel({ _id: "t2", event: "pasado", status: TICKET_STATUS.CONFIRMED }), {
            status: 409,
            message: "No se puede cancelar una inscripción de un evento finalizado"
        });
    });
});

describe("authorizeTicketOwnerOrAdmin", () => {
    const repository = { async getById(id) { return id === "t1" ? { _id: "t1", user: "user1", status: TICKET_STATUS.CONFIRMED } : null; } };
    const ownership = createTicketOwnershipMiddleware(repository);

    test("el dueño pasa y el ticket queda en req.ticket", async () => {
        const { req, nextCalled } = await run(ownership, { user: player, params: { tid: "t1" } });

        assert.equal(nextCalled, true);
        assert.equal(req.ticket._id, "t1");
    });

    test("otro usuario recibe 403 y el admin pasa", async () => {
        const forOther = await run(ownership, { user: otherPlayer, params: { tid: "t1" } });
        const forAdmin = await run(ownership, { user: admin, params: { tid: "t1" } });

        assert.equal(forOther.res.statusCode, 403);
        assert.equal(forOther.res.body.message, "No tenés permisos para cancelar este ticket");
        assert.equal(forAdmin.nextCalled, true);
    });

    test("ticket inexistente 404 y sin sesión 401", async () => {
        const notFound = await run(ownership, { user: player, params: { tid: "otro" } });
        const noSession = await run(ownership, { params: { tid: "t1" } });

        assert.equal(notFound.res.statusCode, 404);
        assert.equal(noSession.res.statusCode, 401);
    });
});

describe("Inscriptos de un evento: propiedad sobre /:eid/tickets", () => {
    const repository = { async getById(id) { return id === "ev1" ? publishedEvent() : null; } };
    const access = createEventOwnershipMiddleware(repository, { param: "eid", forbiddenMessage: "No tenés permisos para ver los inscriptos de este evento" });

    test("el organizer dueño pasa y otro organizer recibe 403 con su mensaje", async () => {
        const forOwner = await run(access, { user: { id: "org1", role: ROLES.ORGANIZER }, params: { eid: "ev1" } });
        const forOther = await run(access, { user: { id: "org2", role: ROLES.ORGANIZER }, params: { eid: "ev1" } });

        assert.equal(forOwner.nextCalled, true);
        assert.equal(forOther.res.statusCode, 403);
        assert.equal(forOther.res.body.message, "No tenés permisos para ver los inscriptos de este evento");
    });
});

describe("Consistencia entre eventos y tickets (EventsService)", () => {
    function createEventsService(reserved) {
        const events = [{ _id: "ev1", status: EVENT_STATUS.PUBLISHED, date: futureDate(), capacity: 10 }];
        const eventsRepository = {
            async update(id, data) { const e = events.find(ev => ev._id === id); Object.assign(e, data); return e; },
            async updateStatus(id, status) { return this.update(id, { status }); },
            async resetReservedSeats(id) { return this.update(id, { reservedSeats: 0 }); }
        };
        const tickets = {
            cancelledEvents: [],
            async countReservedSeats() { return reserved; },
            async cancelActiveByEvent(eventId) { this.cancelledEvents.push(eventId); }
        };
        return { service: new EventsService(eventsRepository, {}, tickets), events, tickets };
    }

    test("no se puede bajar la capacidad por debajo de los lugares reservados", async () => {
        const { service, events } = createEventsService(6);

        await assert.rejects(service.update(events[0], { capacity: 5 }), { status: 409, message: "La capacidad no puede ser menor a los lugares ya reservados (6)" });
        const updated = await service.update(events[0], { capacity: 6 });
        assert.equal(updated.capacity, 6);
    });

    test("al cancelar el evento se cancelan sus tickets activos", async () => {
        const { service, events, tickets } = createEventsService(0);

        await service.changeStatus(events[0], EVENT_STATUS.CANCELLED);

        assert.deepEqual(tickets.cancelledEvents, ["ev1"]);
    });
});

describe("TicketsRepository", () => {
    const TicketsRepository = ticketsRepository.constructor;

    test("el cupo ocupado suma solo los tickets activos", async () => {
        let received;
        const repository = new TicketsRepository({ async sumQuantity(filter) { received = filter; return 4; } });

        const reserved = await repository.countReservedSeats("ev1");

        assert.equal(reserved, 4);
        assert.deepEqual(received, { event: "ev1", status: { $in: [...ACTIVE_TICKET_STATUS] } });
    });

    test("cancelar por evento solo toca los activos y guarda la fecha", async () => {
        let received;
        const repository = new TicketsRepository({ async updateMany(filter, data) { received = { filter, data }; } });

        await repository.cancelActiveByEvent("ev1");

        assert.deepEqual(received.filter, { event: "ev1", status: { $in: [...ACTIVE_TICKET_STATUS] } });
        assert.equal(received.data.status, TICKET_STATUS.CANCELLED);
        assert.ok(received.data.cancelledAt instanceof Date);
    });
});

describe("Email de confirmación (MailService)", () => {
    test("escapa el HTML de los datos del evento", async () => {
        let mail;
        const mailer = new MailService({ async sendMail(data) { mail = data; } }, "Hockey <no-reply@hockey.local>");

        const sent = await mailer.sendTicketConfirmation({
            to: "jugadora@mail.com",
            eventTitle: "<script>alert(1)</script>",
            eventDate: futureDate(),
            eventLocation: "Rosario & Funes",
            quantity: 2,
            reservationCode: "HKY-ABCD1234"
        });

        assert.equal(sent, true);
        assert.equal(mail.to, "jugadora@mail.com");
        assert.ok(!mail.html.includes("<script>"));
        assert.ok(mail.html.includes("&lt;script&gt;"));
        assert.ok(mail.html.includes("Rosario &amp; Funes"));
        assert.ok(mail.html.includes("HKY-ABCD1234"));
    });

    test("sin configuración no intenta enviar", async () => {
        const mailer = new MailService(null, undefined);

        assert.equal(await mailer.sendTicketConfirmation({ to: "a@mail.com" }), false);
    });
});
