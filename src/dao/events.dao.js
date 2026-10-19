import { eventModel } from "../models/Event.js";

// Datos de las referencias que se muestran en los listados: del organizador solo el nombre (las rutas son públicas)
const CATEGORY_FIELDS = "name";
const ORGANIZER_FIELDS = "first_name last_name";

class EventsDao {
    async findPage(filter, { skip, limit, sort }) {
        return eventModel
            .find(filter)
            .populate("category", CATEGORY_FIELDS)
            .populate("organizer", ORGANIZER_FIELDS)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();
    }

    async count(filter) {
        return eventModel.countDocuments(filter);
    }

    async findById(id) {
        return eventModel.findById(id).lean();
    }

    async findDetailById(id) {
        return eventModel
            .findById(id)
            .populate("category", CATEGORY_FIELDS)
            .populate("organizer", ORGANIZER_FIELDS)
            .lean();
    }

    async create(data) {
        const event = await eventModel.create(data);
        return event.toObject();
    }

    async updateById(id, data) {
        return eventModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
    }

    async updateMany(filter, data) {
        return eventModel.updateMany(filter, data);
    }
}

export const eventsDao = new EventsDao();
