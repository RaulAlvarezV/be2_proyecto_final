import { eventsDao } from "../dao/events.dao.js";

class EventsRepository {
    constructor(dao) {
        this.dao = dao;
    }

    async getAll() {
        return this.dao.find();
    }

    async create(data) {
        return this.dao.create(data);
    }
}

export const eventsRepository = new EventsRepository(eventsDao);
