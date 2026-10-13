import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET ||= "clave-solo-para-los-tests-de-passport";
const { initializePassport } = await import("../src/config/passport.config.js");
const { passportCall, auth } = await import("../src/middlewares/auth.middleware.js");
const { generateToken } = await import("../src/utils/jwt.js");

// Repository falso en memoria: las estrategias no saben si atrás hay MongoDB o un array
function createFakeRepository() {
    const users = [];
    return {
        users,
        async getByEmail(email) {
            return users.find(user => user.email === email) ?? null;
        },
        async getById(id) {
            return users.find(user => user._id === id) ?? null;
        },
        async create(data) {
            const user = { _id: `id_${users.length + 1}`, ...data };
            users.push(user);
            return user;
        }
    };
}

// Ejecuta un middleware de Passport como lo hace Express y devuelve cómo terminó
function run(middleware, { body = {}, cookies = {} } = {}) {
    return new Promise(resolve => {
        const req = { body, cookies, query: {}, headers: {} };
        const res = {
            statusCode: null,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(data) { this.body = data; resolve({ req, res, nextCalled: false }); return this; }
        };
        middleware(req, res, error => resolve({ req, res, nextCalled: true, error }));
    });
}

const validUser = { first_name: "Ana", last_name: "Pérez", email: "Ana@Mail.com ", password: "Secreta123" };
const register = body => run(passportCall("register"), { body });
const login = body => run(passportCall("login", { missingMessage: "Email y contraseña son obligatorios" }), { body });
const current = cookies => run(auth, { cookies });

let repository;

beforeEach(() => {
    repository = createFakeRepository();
    initializePassport(repository);
});

describe("Estrategia register", () => {
    test("registra al usuario con el email normalizado y rol user, sin la contraseña", async () => {
        const { req, nextCalled } = await register(validUser);

        assert.equal(nextCalled, true);
        assert.deepEqual(Object.keys(req.user), ["id", "first_name", "last_name", "email", "role"]);
        assert.equal(req.user.email, "ana@mail.com");
        assert.equal(req.user.role, "user");
    });

    test("guarda la contraseña hasheada con bcrypt, nunca en texto plano", async () => {
        await register(validUser);

        assert.notEqual(repository.users[0].password, "Secreta123");
        assert.match(repository.users[0].password, /^\$2b\$10\$/);
    });

    test("ignora el rol que venga en el body", async () => {
        const { req } = await register({ ...validUser, role: "admin" });

        assert.equal(req.user.role, "user");
    });

    test("rechaza un email ya registrado con 409, aunque cambien mayúsculas y espacios", async () => {
        await register(validUser);
        const { res, nextCalled } = await register({ ...validUser, email: "  ANA@mail.COM" });

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 409);
        assert.equal(res.body.message, "El email ya está registrado");
        assert.equal(repository.users.length, 1);
    });

    test("rechaza campos faltantes con 400", async () => {
        for (const field of ["first_name", "last_name", "email", "password"]) {
            const { [field]: _omitted, ...body } = validUser;
            const { res } = await register(body);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.message, "Faltan campos obligatorios");
        }
    });

    test("rechaza un email con formato inválido con 400", async () => {
        for (const email of ["anamail.com", "ana@mail", "ana @mail.com", "ana@@mail.com"]) {
            const { res } = await register({ ...validUser, email });

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.message, "Formato de email inválido");
        }
    });

    test("rechaza una contraseña de solo espacios o corta con 400", async () => {
        const spaces = await register({ ...validUser, password: "          " });
        const short = await register({ ...validUser, password: "1234567" });

        assert.equal(spaces.res.statusCode, 400);
        assert.equal(spaces.res.body.message, "La contraseña no puede estar vacía");
        assert.equal(short.res.statusCode, 400);
    });

    test("rechaza campos que no son texto con 400", async () => {
        const { res } = await register({ ...validUser, first_name: 123 });

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.message, "Los campos deben ser texto");
    });
});

describe("Estrategia login", () => {
    beforeEach(async () => {
        await register(validUser);
    });

    test("con credenciales correctas deja solo id, email y role en req.user", async () => {
        const { req, nextCalled } = await login({ email: " ANA@mail.com", password: "Secreta123" });

        assert.equal(nextCalled, true);
        assert.deepEqual(Object.keys(req.user), ["id", "email", "role"]);
        assert.equal(req.user.email, "ana@mail.com");
    });

    test("email inexistente y contraseña incorrecta responden el mismo 401", async () => {
        const noEmail = await login({ email: "noexiste@mail.com", password: "Secreta123" });
        const badPassword = await login({ email: "ana@mail.com", password: "Incorrecta99" });

        assert.equal(noEmail.res.statusCode, 401);
        assert.deepEqual(noEmail.res.body, badPassword.res.body);
        assert.equal(noEmail.res.body.message, "Credenciales inválidas");
    });

    test("sin email o sin contraseña responde 400", async () => {
        for (const body of [{ email: "ana@mail.com" }, { password: "Secreta123" }, {}]) {
            const { res } = await login(body);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.message, "Email y contraseña son obligatorios");
        }
    });
});

describe("Estrategia current", () => {
    let token;

    beforeEach(async () => {
        await register(validUser);
        token = generateToken({ id: "id_1", email: "ana@mail.com", role: "user" });
    });

    test("con un token válido en la cookie carga req.user con id, email y role", async () => {
        const { req, nextCalled } = await current({ currentUser: token });

        assert.equal(nextCalled, true);
        assert.deepEqual(req.user, { id: "id_1", email: "ana@mail.com", role: "user" });
    });

    test("sin cookie responde 401 No autenticado", async () => {
        const { res, nextCalled } = await current({});

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.message, "No autenticado");
    });

    test("con un token alterado, mal formado, vencido, de otra clave o sin firma responde 401", async (t) => {
        t.mock.method(console, "error", () => {});
        const [header, , signature] = token.split(".");
        const encode = data => Buffer.from(JSON.stringify(data)).toString("base64url");

        const badTokens = [
            `${header}.${encode({ id: "id_1", role: "admin" })}.${signature}`,
            "abc.def",
            jwt.sign({ id: "id_1", exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET),
            jwt.sign({ id: "id_1" }, "otra-clave-que-no-es-la-del-servidor"),
            `${encode({ alg: "none", typ: "JWT" })}.${encode({ id: "id_1", role: "admin" })}.`
        ];

        for (const badToken of badTokens) {
            const { res, nextCalled } = await current({ currentUser: badToken });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 401);
            assert.equal(res.body.message, "Token inválido o expirado");
        }
    });

    test("si el usuario del token ya no existe responde 401", async () => {
        repository.users.length = 0;
        const { res } = await current({ currentUser: token });

        assert.equal(res.statusCode, 401);
    });
});
