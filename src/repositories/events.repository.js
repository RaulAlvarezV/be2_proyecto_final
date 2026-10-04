import { eventsDao } from "../dao/events.dao.js";

class EventsRepository {
    constructor(dao) {
        this.dao = dao;
    }

    async getAll() {
        return this.dao.find();
    }
}

export const eventsRepository = new EventsRepository(eventsDao);
