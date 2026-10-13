import { userModel } from "../models/User.js";

class UsersDao {
    async findOne(filter) {
        return userModel.findOne(filter).lean();
    }

    async findById(id) {
        return userModel.findById(id).lean();
    }

    async create(data) {
        const user = await userModel.create(data);
        return user.toObject();
    }
}

export const usersDao = new UsersDao();
