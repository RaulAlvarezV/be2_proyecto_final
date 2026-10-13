import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ||= "clave-solo-para-los-tests-de-sesiones";
const { SessionsService } = await import("../src/services/sessions.service.js");

// Repository falso en memoria: el service no sabe si atrás hay MongoDB o un array
function createFakeRepository() {
    const users = [];
    return {
        users,
        async getByEmail(email) {
            return users.find(user => user.email === email) ?? null;
        },
        async create(data) {
            const user = { _id: `id_${users.length + 1}`, ...data };
            users.push(user);
            return user;
        }
    };
}

const validUser = { first_name: "Ana", last_name: "Pérez", email: "Ana@Mail.com ", password: "Secreta123" };

describe("Registro", () => {
    let repository;
    let service;

    beforeEach(() => {
        repository = createFakeRepository();
        service = new SessionsService(repository);
    });

    test("registra al usuario con el email normalizado y rol user", async () => {
        const user = await service.register(validUser);

        assert.equal(user.email, "ana@mail.com");
        assert.equal(user.role, "user");
        assert.ok(user.id);
    });

    test("la respuesta no incluye la contraseña", async () => {
        const user = await service.register(validUser);

        assert.deepEqual(Object.keys(user), ["id", "first_name", "last_name", "email", "role"]);
        assert.ok(!JSON.stringify(user).includes("Secreta123"));
    });

    test("guarda la contraseña hasheada con bcrypt, nunca en texto plano", async () => {
        await service.register(validUser);
        const saved = repository.users[0];

        assert.notEqual(saved.password, "Secreta123");
        assert.match(saved.password, /^\$2b\$10\$/);
    });

    test("ignora el rol que venga en el body", async () => {
        const user = await service.register({ ...validUser, role: "admin" });

        assert.equal(user.role, "user");
    });

    test("rechaza un email ya registrado con 409, aunque cambien mayúsculas y espacios", async () => {
        await service.register(validUser);

        await assert.rejects(
            service.register({ ...validUser, email: "  ANA@mail.COM" }),
            { status: 409, message: "El email ya está registrado" }
        );
        assert.equal(repository.users.length, 1);
    });

    test("rechaza campos faltantes con 400", async () => {
        for (const field of ["first_name", "last_name", "email", "password"]) {
            const { [field]: _omitted, ...data } = validUser;
            await assert.rejects(service.register(data), { status: 400, message: "Faltan campos obligatorios" });
        }
        await assert.rejects(service.register(), { status: 400, message: "Faltan campos obligatorios" });
    });

    test("rechaza un email con formato inválido con 400", async () => {
        for (const email of ["anamail.com", "ana@mail", "ana @mail.com", "ana@@mail.com"]) {
            await assert.rejects(service.register({ ...validUser, email }), { status: 400, message: "Formato de email inválido" });
        }
    });

    test("rechaza una contraseña corta o de solo espacios con 400", async () => {
        await assert.rejects(service.register({ ...validUser, password: "1234567" }), { status: 400 });
        await assert.rejects(
            service.register({ ...validUser, password: "          " }),
            { status: 400, message: "La contraseña no puede estar vacía" }
        );
    });

    test("rechaza campos que no son texto con 400", async () => {
        await assert.rejects(service.register({ ...validUser, first_name: 123 }), { status: 400, message: "Los campos deben ser texto" });
    });
});

describe("Login", () => {
    let service;

    beforeEach(async () => {
        service = new SessionsService(createFakeRepository());
        await service.register(validUser);
    });

    test("con credenciales correctas devuelve solo id, email y role", async () => {
        const tokenUser = await service.login({ email: " ANA@mail.com", password: "Secreta123" });

        assert.deepEqual(Object.keys(tokenUser), ["id", "email", "role"]);
        assert.equal(tokenUser.email, "ana@mail.com");
    });

    test("email inexistente y contraseña incorrecta responden el mismo 401", async () => {
        const expected = { status: 401, message: "Credenciales inválidas" };

        await assert.rejects(service.login({ email: "noexiste@mail.com", password: "Secreta123" }), expected);
        await assert.rejects(service.login({ email: "ana@mail.com", password: "Incorrecta99" }), expected);
    });

    test("sin email o sin contraseña responde 400", async () => {
        const expected = { status: 400, message: "Email y contraseña son obligatorios" };

        await assert.rejects(service.login({ email: "ana@mail.com" }), expected);
        await assert.rejects(service.login({ password: "Secreta123" }), expected);
        await assert.rejects(service.login(), expected);
    });
});
