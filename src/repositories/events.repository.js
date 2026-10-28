import { eventsDao } from "../dao/events.dao.js";
import { EVENT_STATUS } from "../config/event-status.js";

class EventsRepository {
    constructor(dao) {
        this.dao = dao;
    }

    // Una página de resultados y el total que cumple el filtro (para calcular totalPages)
    async getPage(filter, options) {
        const [docs, total] = await Promise.all([
            this.dao.findPage(filter, options),
            this.dao.count(filter)
        ]);

        return { docs, total };
    }

    // Sin populate: lo usa el middleware de propiedad para comparar el organizer con el usuario logueado
    async getById(id) {
        return this.dao.findById(id);
    }

    // Con los datos de la categoría y del organizador, para mostrar el evento
    async getDetailById(id) {
        return this.dao.findDetailById(id);
    }

    async create(data) {
        return this.dao.create(data);
    }

    async update(id, data) {
        return this.dao.updateById(id, data);
    }

    // Reserva atómica del cupo: suma los lugares solo si el evento sigue publicado, su fecha no pasó y hay lugar.
    // Devuelve el evento actualizado, o null si no se pudo reservar
    async reserveSeats(id, quantity, now) {
        return this.dao.findOneAndUpdate(
            {
                _id: id,
                status: EVENT_STATUS.PUBLISHED,
                date: { $gt: now },
                // $ifNull: un evento creado antes del contador cuenta como 0 reservados.
                // Sin esto la suma da null, y en MongoDB null es menor que cualquier número: la condición pasaría siempre
                $expr: { $lte: [{ $add: [{ $ifNull: ["$reservedSeats", 0] }, quantity] }, "$capacity"] }
            },
            { $inc: { reservedSeats: quantity } }
        );
    }

    // Devuelve lugares (cancelación de un ticket o compensación). El contador nunca queda por debajo de cero
    async releaseSeats(id, quantity) {
        return this.dao.findOneAndUpdatePipeline(
            { _id: id },
            [{ $set: { reservedSeats: { $max: [0, { $subtract: [{ $ifNull: ["$reservedSeats", 0] }, quantity] }] } } }]
        );
    }

    // Recalcula el contador a partir de los tickets activos (sync:seats)
    async setReservedSeats(id, reservedSeats) {
        return this.dao.updateById(id, { reservedSeats });
    }

    // Al cancelar un evento se cancelan sus tickets: no queda ningún lugar reservado
    async resetReservedSeats(id) {
        return this.setReservedSeats(id, 0);
    }

    async getAllIds() {
        return this.dao.findIds();
    }

    async updateStatus(id, status) {
        return this.dao.updateById(id, { status });
    }

    // Los publicados cuya fecha ya pasó pasan a finalizados
    async finishPastEvents(now) {
        return this.dao.updateMany(
            { status: EVENT_STATUS.PUBLISHED, date: { $lt: now } },
            { status: EVENT_STATUS.FINISHED }
        );
    }
}

export const eventsRepository = new EventsRepository(eventsDao);
