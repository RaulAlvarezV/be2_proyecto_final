import { connectDB, disconnectDB } from "../src/config/db.js";
import { eventsRepository } from "../src/repositories/events.repository.js";
import { ticketsRepository } from "../src/repositories/tickets.repository.js";

// Recalcula reservedSeats de cada evento sumando la quantity de sus tickets activos.
// Sirve para los eventos creados antes del contador y para corregirlo si alguna vez quedara desfasado
// (por ejemplo, si el servidor se cae entre la reserva del cupo y la creación del ticket)
async function syncReservedSeats() {
    await connectDB();

    const events = await eventsRepository.getAllIds();
    let updated = 0;

    for (const { _id } of events) {
        const reserved = await ticketsRepository.countReservedSeats(_id);
        await eventsRepository.setReservedSeats(_id, reserved);
        updated += 1;
    }

    console.log(`Contador de lugares reservados sincronizado en ${updated} eventos`);
}

syncReservedSeats()
    .catch(error => {
        console.error("No se pudo sincronizar el contador de lugares:", error.message);
        process.exitCode = 1;
    })
    .finally(() => disconnectDB());
