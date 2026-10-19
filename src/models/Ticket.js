import { Schema, model, Types } from "mongoose";
import { TICKET_STATUS, TICKET_STATUS_VALUES, ACTIVE_TICKET_STATUS } from "../config/ticket-status.js";

// Inscripción de un jugador o jugadora a un torneo, clínica o workshop.
// Guarda solo referencias al usuario y al evento, nunca los objetos completos
const ticketSchema = new Schema(
    {
        user: {
            type: Types.ObjectId,
            ref: "Users",
            required: true
        },
        event: {
            type: Types.ObjectId,
            ref: "Events",
            required: true
        },
        status: {
            type: String,
            enum: TICKET_STATUS_VALUES,
            default: TICKET_STATUS.CONFIRMED
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },
        // Código para identificar la reserva sin exponer el id de MongoDB
        reservationCode: {
            type: String,
            required: true,
            unique: true
        },
        cancelledAt: {
            type: Date,
            default: null
        }
    },
    {
        // createdAt registra cuándo se hizo la inscripción
        timestamps: true
    }
);

// Un usuario no puede tener dos tickets activos para el mismo evento. El índice es parcial:
// los cancelados no cuentan, así que después de cancelar se puede volver a inscribir
ticketSchema.index(
    { user: 1, event: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ACTIVE_TICKET_STATUS } } }
);

// Para sumar rápido los lugares ocupados de un evento
ticketSchema.index({ event: 1, status: 1 });

export const ticketModel = model("Tickets", ticketSchema);
