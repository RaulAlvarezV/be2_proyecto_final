import { connectDB, disconnectDB } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { ROLES } from "../src/config/permissions.js";
import { EVENT_STATUS } from "../src/config/event-status.js";
import { usersRepository } from "../src/repositories/users.repository.js";
import { categoriesRepository } from "../src/repositories/categories.repository.js";
import { eventsRepository } from "../src/repositories/events.repository.js";
import { createHash } from "../src/utils/hash.js";

// Datos de prueba para desarrollo: un usuario por rol, las categorías y eventos publicados del organizer.
// Se puede correr varias veces: lo que ya existe no se vuelve a crear. Las contraseñas son solo de prueba
const TEST_USERS = [
    { first_name: "Ana", last_name: "Admin", email: "admin@hockey.local", password: "Admin12345", role: ROLES.ADMIN },
    { first_name: "Club", last_name: "Atlético", email: "club@hockey.local", password: "Club12345", role: ROLES.ORGANIZER },
    { first_name: "Lucía", last_name: "Gómez", email: "jugadora@hockey.local", password: "Jugadora123", role: ROLES.USER }
];

const TEST_CATEGORIES = [
    { name: "torneo", description: "Torneos por categoría" },
    { name: "clinica", description: "Clínicas técnicas" },
    { name: "workshop", description: "Workshops de formación para jugadores y entrenadores" }
];

const DAY = 24 * 60 * 60 * 1000;
const inDays = days => new Date(Date.now() + days * DAY);

// La clínica tiene 1 solo lugar: sirve para probar el caso "sin cupo"
const TEST_EVENTS = [
    { title: "Torneo Apertura Sub 16", description: "Torneo de seven para la categoría sub 16", category: "torneo", date: inDays(30), location: "Rosario", capacity: 12, price: 15000 },
    { title: "Clínica de arqueras", description: "Salida, achique y despeje", category: "clinica", date: inDays(20), location: "Funes", capacity: 1, price: 9000 },
    { title: "Workshop de corners cortos", description: "Variantes de ataque y defensa del corner corto", category: "workshop", date: inDays(45), location: "Buenos Aires", capacity: 20, price: 0 }
];

async function seedUsers() {
    const users = {};

    for (const { password, ...data } of TEST_USERS) {
        const existing = await usersRepository.getByEmail(data.email);
        users[data.role] = existing ?? await usersRepository.create({ ...data, password: await createHash(password) });
    }

    return users;
}

async function seedCategories() {
    const categories = {};

    for (const data of TEST_CATEGORIES) {
        categories[data.name] = await categoriesRepository.getByName(data.name) ?? await categoriesRepository.create(data);
    }

    return categories;
}

async function seedEvents(organizer, categories) {
    // Si el organizer de prueba ya tiene eventos, no se agregan otros
    if (await eventsRepository.countByOrganizer(organizer._id) > 0) {
        return 0;
    }

    for (const { category, ...data } of TEST_EVENTS) {
        await eventsRepository.create({
            ...data,
            category: categories[category]._id,
            organizer: organizer._id,
            status: EVENT_STATUS.PUBLISHED
        });
    }

    return TEST_EVENTS.length;
}

async function seed() {
    // Las contraseñas de prueba son públicas (están en el README): nunca en producción
    if (env.NODE_ENV === "production") {
        throw new Error("El seed es solo para desarrollo (NODE_ENV=production)");
    }

    await connectDB();

    const users = await seedUsers();
    const categories = await seedCategories();
    const createdEvents = await seedEvents(users[ROLES.ORGANIZER], categories);

    console.log(`Datos de prueba listos: ${TEST_USERS.length} usuarios, ${TEST_CATEGORIES.length} categorías, ${createdEvents} eventos nuevos`);
}

seed()
    .catch(error => {
        console.error("No se pudieron cargar los datos de prueba:", error.message);
        process.exitCode = 1;
    })
    .finally(() => disconnectDB());
