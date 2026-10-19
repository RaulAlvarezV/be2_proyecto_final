import { usersDao } from "../dao/users.dao.js";

class UsersRepository {
    constructor(dao) {
        this.dao = dao;
    }

    async getAll() {
        return this.dao.find();
    }

    async getByEmail(email) {
        return this.dao.findOne({ email });
    }

    async getById(id) {
        return this.dao.findById(id);
    }

    async create(data) {
        return this.dao.create(data);
    }

    async updateRole(id, role) {
        return this.dao.updateById(id, { role });
    }
}

export const usersRepository = new UsersRepository(usersDao);
