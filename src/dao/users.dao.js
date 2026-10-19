import { userModel } from "../models/User.js";

class UsersDao {
    async find(filter = {}) {
        return userModel.find(filter).lean();
    }

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

    async updateById(id, data) {
        return userModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
    }
}

export const usersDao = new UsersDao();
