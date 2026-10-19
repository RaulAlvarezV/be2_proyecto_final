import { usersService } from "../services/users.service.js";

// Ya pasó por auth y authorizeRoles: req.user es admin
export async function getUsers(_req, res, next) {
    try {
        const users = await usersService.getAll();
        res.status(200).json({ status: "success", payload: users });
    } catch (error) {
        next(error);
    }
}

export async function changeUserRole(req, res, next) {
    try {
        const updatedUser = await usersService.changeRole(req.params.uid, req.body?.role, req.user);
        res.status(200).json({ status: "success", message: "Rol actualizado", payload: updatedUser });
    } catch (error) {
        next(error);
    }
}
