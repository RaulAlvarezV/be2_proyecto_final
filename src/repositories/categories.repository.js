import { categoriesDao } from "../dao/categories.dao.js";

class CategoriesRepository {
    constructor(dao) {
        this.dao = dao;
    }

    async getAll() {
        return this.dao.find();
    }

    async getById(id) {
        return this.dao.findById(id);
    }

    async getByName(name) {
        return this.dao.findOne({ name });
    }

    // La categoría puede llegar como id o como nombre (?category=workshop): si no tiene formato de id se busca por nombre
    async getByIdOrName(value) {
        if (this.dao.isValidId(value)) {
            return this.getById(value);
        }

        return this.getByName(String(value).trim().toLowerCase());
    }

    async create(data) {
        return this.dao.create(data);
    }
}

export const categoriesRepository = new CategoriesRepository(categoriesDao);
