import { isValidObjectId } from "mongoose";
import { categoryModel } from "../models/Category.js";

class CategoriesDao {
    // El formato de los ids depende de la base (ObjectId en MongoDB): por eso lo resuelve el DAO
    isValidId(id) {
        return isValidObjectId(id);
    }

    async find(filter = {}) {
        return categoryModel.find(filter).sort({ name: 1 }).lean();
    }

    async findOne(filter) {
        return categoryModel.findOne(filter).lean();
    }

    async findById(id) {
        return categoryModel.findById(id).lean();
    }

    async create(data) {
        const category = await categoryModel.create(data);
        return category.toObject();
    }
}

export const categoriesDao = new CategoriesDao();
