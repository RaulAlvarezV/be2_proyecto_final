import { eventsDao } from "../dao/events.dao.js";

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

    async updateMany(filter, data) {
        return this.dao.updateMany(filter, data);
    }
}

export const eventsRepository = new EventsRepository(eventsDao);
