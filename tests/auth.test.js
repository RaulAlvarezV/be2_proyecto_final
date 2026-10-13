import { test, describe } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET ||= "clave-solo-para-los-tests-de-auth";
const { generateToken, verifyToken } = await import("../src/utils/jwt.js");
const { auth } = await import("../src/middlewares/auth.middleware.js");

const tokenUser = { id: "665f2a", email: "ana@mail.com", role: "user" };

// Response de prueba que guarda el status y el body
function createRes() {
    const res = { statusCode: null, body: null };
    res.status = code => { res.statusCode = code; return res; };
    res.json = body => { res.body = body; return res; };
    return res;
}

function runAuth(cookies) {
    const req = { cookies };
    const res = createRes();
    let nextCalls = 0;
    auth(req, res, () => { nextCalls++; });
    return { req, res, nextCalls };
}

describe("Helper de JWT", () => {
    test("genera un token con id, email y role, y lo verifica", () => {
        const payload = verifyToken(generateToken(tokenUser));

        assert.equal(payload.id, tokenUser.id);
        assert.equal(payload.email, tokenUser.email);
        assert.equal(payload.role, tokenUser.role);
        assert.equal(payload.password, undefined);
    });

    test("el token vence según JWT_EXPIRES_IN (1h por defecto)", () => {
        const payload = verifyToken(generateToken(tokenUser));

        assert.equal(payload.exp - payload.iat, 3600);
    });

    test("un token alterado no se puede verificar", () => {
        const [header, , signature] = generateToken(tokenUser).split(".");
        const forged = Buffer.from(JSON.stringify({ ...tokenUser, role: "admin" })).toString("base64url");

        assert.throws(() => verifyToken(`${header}.${forged}.${signature}`), { name: "JsonWebTokenError" });
    });
});

describe("Middleware auth", () => {
    test("con un token válido llama a next() y carga req.user", () => {
        const { req, res, nextCalls } = runAuth({ currentUser: generateToken(tokenUser) });

        assert.equal(nextCalls, 1);
        assert.equal(res.statusCode, null);
        assert.deepEqual(req.user, tokenUser);
    });

    test("sin cookie responde 401 No autenticado", () => {
        const { res, nextCalls } = runAuth({});

        assert.equal(nextCalls, 0);
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.message, "No autenticado");
    });

    test("con un token alterado, mal formado, vencido o de otra clave responde 401", (t) => {
        t.mock.method(console, "error", () => {});
        const expired = jwt.sign({ ...tokenUser, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
        const otherKey = jwt.sign(tokenUser, "otra-clave-que-no-es-la-del-servidor");
        const valid = generateToken(tokenUser);

        for (const token of [valid.slice(0, -3) + "abc", "abc.def", expired, otherKey]) {
            const { req, res, nextCalls } = runAuth({ currentUser: token });

            assert.equal(nextCalls, 0);
            assert.equal(res.statusCode, 401);
            assert.equal(res.body.message, "Token inválido o expirado");
            assert.equal(req.user, undefined);
        }
    });
});
