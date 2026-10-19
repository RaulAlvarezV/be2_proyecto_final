import { eventModel } from "../models/Event.js";

class EventsDao {
    async find(filter = {}) {
        return eventModel.find(filter).lean();
    }

    async create(data) {
        const event = await eventModel.create(data);
        return event.toObject();
    }
}

export const eventsDao = new EventsDao();
