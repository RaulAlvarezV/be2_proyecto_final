import { categoryModel } from "../models/Category.js";

class CategoriesDao {
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
