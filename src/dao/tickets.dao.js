import { Types } from "mongoose";
import { ticketModel } from "../models/Ticket.js";

class TicketsDao {
    async findOne(filter) {
        return ticketModel.findOne(filter).lean();
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
}

export const ticketsDao = new TicketsDao();
