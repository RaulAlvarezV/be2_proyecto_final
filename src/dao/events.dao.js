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
        return eventModel.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true }).lean();
    }

    // Actualiza solo si el documento cumple el filtro: MongoDB evalúa la condición y aplica el cambio
    // en una sola operación sobre el documento, así dos pedidos simultáneos no pueden pasar los dos
    async findOneAndUpdate(filter, update) {
        return eventModel.findOneAndUpdate(filter, update, { returnDocument: "after", runValidators: true }).lean();
    }

    // Igual, pero el valor nuevo se calcula a partir del actual (pipeline de agregación)
    async findOneAndUpdatePipeline(filter, pipeline) {
        return eventModel.findOneAndUpdate(filter, pipeline, { returnDocument: "after", updatePipeline: true }).lean();
    }

    async findIds() {
        return eventModel.find({}, { _id: 1 }).lean();
    }

    async updateMany(filter, data) {
        return eventModel.updateMany(filter, data);
    }
}

export const eventsDao = new EventsDao();
