import { usersDao } from "../dao/users.dao.js";

class UsersRepository {
    constructor(dao) {
        this.dao = dao;
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
}

export const usersRepository = new UsersRepository(usersDao);
