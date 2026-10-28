import { test, describe } from "node:test";
import assert from "node:assert/strict";

const { UserDTO, CurrentUserDTO } = await import("../src/dto/user.dto.js");
const { EventDTO } = await import("../src/dto/event.dto.js");
const { TicketDTO } = await import("../src/dto/ticket.dto.js");
const { CategoryDTO } = await import("../src/dto/category.dto.js");

// Documento como lo devuelve MongoDB, con todo lo que NO tiene que salir de la API
const userDocument = {
    _id: "u1",
    first_name: "Lucía",
    last_name: "Gómez",
    email: "lucia@mail.com",
    password: "$2b$10$hashdelacontrasenia",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
};

describe("DTO de usuario", () => {
    test("UserDTO devuelve solo los datos públicos y nunca la contraseña", () => {
        const dto = new UserDTO(userDocument);

        assert.deepEqual(Object.keys(dto), ["id", "first_name", "last_name", "email", "role"]);
        assert.equal(dto.id, "u1");
        assert.ok(!JSON.stringify(dto).includes("hash"));
    });

    test("CurrentUserDTO (/current) devuelve id, email y role", () => {
        const dto = new CurrentUserDTO({ id: "u1", email: "lucia@mail.com", role: "user", password: "x" });

        assert.deepEqual(Object.keys(dto), ["id", "email", "role"]);
    });

    test("un campo sensible nuevo en el modelo tampoco sale (lista blanca)", () => {
        const dto = new UserDTO({ ...userDocument, resetToken: "secreto" });

        assert.ok(!("resetToken" in dto));
    });

    test("el DTO arma un objeto nuevo: el documento original no se modifica", () => {
        const original = { ...userDocument };
        new UserDTO(original);

        assert.equal(original.password, userDocument.password);
    });
});

describe("DTO de evento", () => {
    const eventDocument = {
        _id: "e1",
        title: "Torneo Apertura",
        description: "Seven sub 16",
        category: { _id: "c1", name: "torneo", createdAt: new Date() },
        date: new Date(),
        location: "Rosario",
        capacity: 10,
        reservedSeats: 4,
        price: 15000,
        status: "published",
        // populate de más: el DTO filtra igual el documento relacionado
        organizer: { _id: "o1", first_name: "Raul", last_name: "Alvarez", email: "raul@mail.com", password: "hash" },
        __v: 0
    };

    test("filtra el organizador: solo nombre, sin email ni contraseña", () => {
        const dto = new EventDTO(eventDocument);

        assert.deepEqual(dto.organizer, { id: "o1", first_name: "Raul", last_name: "Alvarez" });
        assert.deepEqual(dto.category, { id: "c1", name: "torneo" });
        assert.ok(!("__v" in dto));
    });

    test("expone los lugares disponibles, pero no el contador interno", () => {
        const dto = new EventDTO(eventDocument);

        assert.equal(dto.availableSeats, 6);
        assert.ok(!("reservedSeats" in dto));
        assert.equal(new EventDTO({ ...eventDocument, reservedSeats: undefined }).availableSeats, 10);
    });

    test("sin populate deja las referencias como id", () => {
        const dto = new EventDTO({ ...eventDocument, category: "c1", organizer: "o1" });

        assert.equal(dto.category, "c1");
        assert.equal(dto.organizer, "o1");
    });
});

describe("DTO de ticket", () => {
    test("con populate del usuario no incluye la contraseña", () => {
        const dto = new TicketDTO({
            _id: "t1",
            reservationCode: "HKY-1234ABCD",
            status: "confirmed",
            quantity: 2,
            event: { _id: "e1", title: "Torneo", date: new Date(), location: "Rosario", status: "published", capacity: 10 },
            user: userDocument,
            createdAt: new Date(),
            cancelledAt: null,
            updatedAt: new Date(),
            __v: 0
        });

        assert.deepEqual(dto.user, { id: "u1", first_name: "Lucía", last_name: "Gómez", email: "lucia@mail.com" });
        assert.deepEqual(Object.keys(dto.event), ["id", "title", "date", "location", "status"]);
        assert.ok(!JSON.stringify(dto).includes("hash"));
        assert.ok(!("updatedAt" in dto) && !("__v" in dto));
    });
});

describe("DTO de categoría", () => {
    test("id, name y description", () => {
        const dto = new CategoryDTO({ _id: "c1", name: "torneo", description: "Torneos", __v: 0, createdAt: new Date() });

        assert.deepEqual(Object.keys(dto), ["id", "name", "description"]);
    });
});
