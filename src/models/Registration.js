import { Schema, model, Types } from "mongoose";

// Inscripción de un jugador o jugadora a un torneo o clínica
const registrationSchema = new Schema(
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
            enum: ["active", "cancelled"],
            default: "active"
        }
    },
    {
        timestamps: true
    }
);

// Un usuario no puede inscribirse dos veces al mismo evento
registrationSchema.index({ user: 1, event: 1 }, { unique: true });

export const registrationModel = model("Registrations", registrationSchema);
