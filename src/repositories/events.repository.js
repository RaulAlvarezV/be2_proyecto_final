import { eventsDao } from "../dao/events.dao.js";

class EventsRepository {
    constructor(dao) {
        this.dao = dao;
    }

    async getAll(filter = {}) {
        return this.dao.find(filter);
    }

    async getById(id) {
        return this.dao.findById(id);
    }

    async create(data) {
        return this.dao.create(data);
    }

    async update(id, data) {
        return this.dao.updateById(id, data);
    }
}

export const eventsRepository = new EventsRepository(eventsDao);
