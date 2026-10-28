import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Revisa los imports de cada capa: las reglas de la arquitectura quedan comprobadas en cada npm test
const SRC = join(import.meta.dirname, "..", "src");
const IMPORT_REGEX = /^import\s[^;]*?from\s+"([^"]+)"/gm;

function importsOf(folder) {
    return readdirSync(join(SRC, folder))
        .filter(file => file.endsWith(".js"))
        .map(file => {
            const source = readFileSync(join(SRC, folder, file), "utf8");
            const imports = [...source.matchAll(IMPORT_REGEX)].map(match => match[1]);
            return { file: `${folder}/${file}`, imports };
        });
}

function offenders(folder, isForbidden) {
    return importsOf(folder)
        .filter(({ imports }) => imports.some(isForbidden))
        .map(({ file }) => file);
}

const importsModel = path => path.includes("/models/");
const importsDao = path => path.includes("/dao/");
const importsMongoose = path => path === "mongoose";

describe("Arquitectura en capas", () => {
    test("solo los DAO importan los modelos de Mongoose", () => {
        const folders = ["controllers", "services", "repositories", "middlewares", "routes", "dto", "config", "utils"];
        const found = folders.flatMap(folder => offenders(folder, importsModel));

        assert.deepEqual(found, []);
        assert.ok(importsOf("dao").every(({ imports }) => imports.some(importsModel)), "cada DAO usa su modelo");
    });

    test("los controllers no importan modelos, DAO, repositories ni Mongoose", () => {
        const found = offenders("controllers", path => importsModel(path) || importsDao(path) || importsMongoose(path) || path.includes("/repositories/"));

        assert.deepEqual(found, []);
    });

    test("los services usan repositories: nunca DAO, modelos ni Mongoose", () => {
        const found = offenders("services", path => importsModel(path) || importsDao(path) || importsMongoose(path));

        assert.deepEqual(found, []);
    });

    test("los repositories usan su DAO y no dependen de Mongoose", () => {
        const found = offenders("repositories", path => importsModel(path) || importsMongoose(path));

        assert.deepEqual(found, []);
        assert.ok(importsOf("repositories").every(({ imports }) => imports.some(importsDao)), "cada repository usa su DAO");
    });

    test("los DTO no consultan la base", () => {
        const found = offenders("dto", path => importsModel(path) || importsDao(path) || path.includes("/repositories/") || importsMongoose(path));

        assert.deepEqual(found, []);
    });
});
