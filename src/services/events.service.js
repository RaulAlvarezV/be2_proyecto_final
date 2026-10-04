import { eventsRepository } from "../repositories/events.repository.js";

// Acá van a ir las reglas de negocio (cupos, eventos cancelados, fechas pasadas)
class EventsService {
    constructor(repository) {
        this.repository = repository;
    }

    async getAll() {
        return this.repository.getAll();
    }
}

export const eventsService = new EventsService(eventsRepository);
