import { usersDao } from "../dao/users.dao.js";

class UsersRepository {
    constructor(dao) {
        this.dao = dao;
    }

    async getByEmail(email) {
        return this.dao.findOne({ email });
    }

    async create(data) {
        return this.dao.create(data);
    }
}

export const usersRepository = new UsersRepository(usersDao);
