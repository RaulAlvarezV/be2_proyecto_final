import { usersRepository } from "../repositories/users.repository.js";
import { ROLE_VALUES } from "../config/permissions.js";
import { toPublicUser } from "../dto/user.dto.js";
import { AppError } from "../utils/errors.js";

// El permiso (solo admin) lo validan auth y authorizeRoles en la ruta; acá van las reglas de los usuarios
export class UsersService {
    constructor(repository) {
        this.repository = repository;
    }

    async getAll() {
        const users = await this.repository.getAll();
        return users.map(toPublicUser);
    }

    async changeRole(userId, role, currentUser) {
        if (!ROLE_VALUES.includes(role)) {
            throw new AppError(`Rol inválido. Valores posibles: ${ROLE_VALUES.join(", ")}`, 400);
        }

        // Un admin no puede quitarse el rol a sí mismo: así la plataforma nunca se queda sin administradores
        if (String(userId) === String(currentUser.id)) {
            throw new AppError("No podés cambiar tu propio rol", 409);
        }

        const user = await this.repository.getById(userId);
        if (!user) {
            throw new AppError("Usuario no encontrado", 404);
        }

        const updatedUser = await this.repository.updateRole(userId, role);
        return toPublicUser(updatedUser);
    }
}

export const usersService = new UsersService(usersRepository);
