import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

// Test de integración: corre contra una base MongoDB real porque la atomicidad la garantiza MongoDB, no el código.
// Solo se ejecuta si se define MONGO_TEST_URL (ej. mongodb://localhost:27017/be2_seats_test); sin esa variable se saltea,
// así npm test sigue funcionando sin base. La base indicada se borra al terminar: usar una exclusiva para tests
const MONGO_TEST_URL = process.env.MONGO_TEST_URL;
const SIMULTANEOUS_REQUESTS = 30;

describe("Reserva atómica del cupo con MongoDB", { skip: !MONGO_TEST_URL && "definir MONGO_TEST_URL para correrlo" }, () => {
    let mongoose;
    let eventModel;
    let eventsRepository;

    before(async () => {
        mongoose = (await import("mongoose")).default;
        ({ eventModel } = await import("../src/models/Event.js"));
        ({ eventsRepository } = await import("../src/repositories/events.repository.js"));
        await mongoose.connect(MONGO_TEST_URL);
    });

    after(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    async function createEvent(capacity, reservedSeats) {
        const event = await eventModel.create({
            title: "Final",
            description: "Test de concurrencia",
            category: new mongoose.Types.ObjectId(),
            date: new Date(Date.now() + 24 * 3600 * 1000),
            location: "Rosario",
            capacity,
            status: "published",
            organizer: new mongoose.Types.ObjectId(),
            ...(reservedSeats === undefined ? {} : { reservedSeats })
        });
        return event._id;
    }

    test(`${SIMULTANEOUS_REQUESTS} reservas simultáneas por el último lugar: entra una sola`, async () => {
        const eventId = await createEvent(1);

        const results = await Promise.all(
            Array.from({ length: SIMULTANEOUS_REQUESTS }, () => eventsRepository.reserveSeats(eventId, 1, new Date()))
        );

        assert.equal(results.filter(Boolean).length, 1);
        assert.equal((await eventModel.findById(eventId).lean()).reservedSeats, 1);
    });

    test("con varios lugares nunca se supera la capacidad", async () => {
        const eventId = await createEvent(7);

        const results = await Promise.all(
            Array.from({ length: SIMULTANEOUS_REQUESTS }, () => eventsRepository.reserveSeats(eventId, 2, new Date()))
        );

        // 7 lugares, de a 2: entran 3 reservas (6 lugares) y la cuarta ya no cabe
        assert.equal(results.filter(Boolean).length, 3);
        assert.equal((await eventModel.findById(eventId).lean()).reservedSeats, 6);
    });

    test("un evento creado antes del contador cuenta como 0 reservados (no como null)", async () => {
        const eventId = await createEvent(2);
        await eventModel.collection.updateOne({ _id: eventId }, { $unset: { reservedSeats: "" } });

        // Sin $ifNull, null + 3 da null y la condición pasaría: se reservarían 3 lugares en un evento de 2
        assert.equal(await eventsRepository.reserveSeats(eventId, 3, new Date()), null);
        assert.ok(await eventsRepository.reserveSeats(eventId, 2, new Date()));
    });

    test("liberaciones simultáneas no dejan el contador negativo", async () => {
        const eventId = await createEvent(5, 1);

        await Promise.all(Array.from({ length: 5 }, () => eventsRepository.releaseSeats(eventId, 1)));

        assert.equal((await eventModel.findById(eventId).lean()).reservedSeats, 0);
    });
});
