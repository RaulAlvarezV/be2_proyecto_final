import { Schema, model, Types } from "mongoose";

const eventSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        type: {
            type: String,
            enum: ["torneo", "clinica"],
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        place: {
            type: String,
            required: true
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
        status: {
            type: String,
            enum: ["active", "cancelled"],
            default: "active"
        },
        category: {
            type: Types.ObjectId,
            ref: "Categories"
        },
        organizer: {
            type: Types.ObjectId,
            ref: "Users"
        }
    },
    {
        timestamps: true
    }
);

export const eventModel = model("Events", eventSchema);
