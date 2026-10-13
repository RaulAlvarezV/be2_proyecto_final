import { test, describe } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ||= "clave-solo-para-los-tests-de-jwt";
const { generateToken, verifyToken } = await import("../src/utils/jwt.js");

const tokenUser = { id: "665f2a", email: "ana@mail.com", role: "user" };

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
