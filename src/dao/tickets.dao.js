import { Types } from "mongoose";
import { ticketModel } from "../models/Ticket.js";

// Datos del evento que se muestran junto a cada ticket
const EVENT_FIELDS = "title date location status";
// Datos del inscripto que ve el organizador del evento (nunca la contraseña)
const USER_FIELDS = "first_name last_name email";

class TicketsDao {
    async findOne(filter) {
        return ticketModel.findOne(filter).lean();
    }

    async findByUser(userId) {
        return ticketModel
            .find({ user: userId })
            .populate("event", EVENT_FIELDS)
            .sort({ createdAt: -1 })
            .lean();
    }

    async findByEvent(eventId) {
        return ticketModel
            .find({ event: eventId })
            .populate("user", USER_FIELDS)
            .sort({ createdAt: 1 })
            .lean();
    }

    async findById(id) {
        return ticketModel.findById(id).lean();
    }

    async create(data) {
        const ticket = await ticketModel.create(data);
        return ticket.toObject();
    }

    // aggregate no convierte los tipos como find: el id del evento se pasa a ObjectId a mano
    async sumQuantity({ event, status }) {
        const [result] = await ticketModel.aggregate([
            { $match: { event: new Types.ObjectId(String(event)), status } },
            { $group: { _id: "$event", total: { $sum: "$quantity" } } }
        ]);

        return result?.total ?? 0;
    }

    async updateMany(filter, data) {
        return ticketModel.updateMany(filter, data);
    }

    async updateById(id, data) {
        return ticketModel.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true }).lean();
    }
}

export const ticketsDao = new TicketsDao();
