import { Schema, model, Types } from "mongoose";
import { EVENT_STATUS, EVENT_STATUS_VALUES } from "../config/event-status.js";

// Torneo o clínica de hockey. El modelo define la forma del dato; las reglas de negocio (fecha futura,
// qué estados se pueden cambiar) están en services/events.service.js
const eventSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            required: true,
            trim: true
        },
        category: {
            type: Types.ObjectId,
            ref: "Categories",
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        location: {
            type: String,
            required: true,
            trim: true
        },
        capacity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            default: 0,
            min: 0
        },
        // Lugares ocupados por tickets activos. Lo actualiza solo el backend, en la misma operación que controla
        // el cupo (reserva atómica); nunca se toma del body
        reservedSeats: {
            type: Number,
            default: 0,
            min: 0
        },
        status: {
            type: String,
            enum: EVENT_STATUS_VALUES,
            default: EVENT_STATUS.DRAFT
        },
        // Referencia al usuario que lo creó (no el objeto completo)
        organizer: {
            type: Types.ObjectId,
            ref: "Users",
            required: true
        }
    },
    {
        timestamps: true
    }
);

export const eventModel = model("Events", eventSchema);
