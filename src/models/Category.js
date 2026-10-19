import { Schema, model } from "mongoose";

// Categorías de los eventos (por ejemplo: torneo, clinica, workshop). El nombre se guarda en minúsculas para filtrar por él
const categorySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },
        description: {
            type: String,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

export const categoryModel = model("Categories", categorySchema);
