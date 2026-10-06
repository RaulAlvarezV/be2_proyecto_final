import { usersRepository } from "../repositories/users.repository.js";
import { createHash } from "../utils/hash.js";
import { AppError } from "../utils/errors.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const REQUIRED_FIELDS = ["first_name", "last_name", "email", "password"];

// Datos públicos del usuario: nunca se devuelve la contraseña (ni hasheada)
function toPublicUser(user) {
    return {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role
    };
}

class SessionsService {
    constructor(repository) {
        this.repository = repository;
    }

    async register(data = {}) {
        // Solo se toman estos campos: el rol nunca viene del body
        const { first_name, last_name, email, password } = data;

        const missing = REQUIRED_FIELDS.some(field => data[field] === undefined || data[field] === null || data[field] === "");
        if (missing) {
            throw new AppError("Faltan campos obligatorios", 400);
        }

        const notText = [first_name, last_name, email, password].some(value => typeof value !== "string");
        if (notText) {
            throw new AppError("Los campos deben ser texto", 400);
        }

        const firstName = first_name.trim();
        const lastName = last_name.trim();
        if (!firstName || !lastName) {
            throw new AppError("El nombre y el apellido no pueden estar vacíos", 400);
        }

        // Normalización: sin espacios y en minúsculas, así "Ana@Mail.com " y "ana@mail.com" son el mismo
        const normalizedEmail = email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(normalizedEmail)) {
            throw new AppError("Formato de email inválido", 400);
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
            throw new AppError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`, 400);
        }

        const userExists = await this.repository.getByEmail(normalizedEmail);
        if (userExists) {
            throw new AppError("El email ya está registrado", 409);
        }

        const newUser = await this.repository.create({
            first_name: firstName,
            last_name: lastName,
            email: normalizedEmail,
            password: await createHash(password),
            role: "user"
        });

        return toPublicUser(newUser);
    }
}

export const sessionsService = new SessionsService(usersRepository);
