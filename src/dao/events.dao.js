import { eventModel } from "../models/Event.js";

class EventsDao {
    async find(filter = {}) {
        return eventModel.find(filter).lean();
    }
}

export const eventsDao = new EventsDao();
