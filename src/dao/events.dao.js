import { eventModel } from "../models/Event.js";

class EventsDao {
    async find(filter = {}) {
        return eventModel.find(filter).lean();
    }

    async findById(id) {
        return eventModel.findById(id).lean();
    }

    async create(data) {
        const event = await eventModel.create(data);
        return event.toObject();
    }

    async updateById(id, data) {
        return eventModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
    }
}

export const eventsDao = new EventsDao();
