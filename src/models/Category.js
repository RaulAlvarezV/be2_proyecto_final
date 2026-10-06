import { Schema, model } from "mongoose";

// Categorías de los eventos (por ejemplo: Sub 14, Sub 16, Primera, Arqueras)
const categorySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
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
