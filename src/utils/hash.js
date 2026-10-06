import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// Genera el hash de la contraseña (nunca se guarda en texto plano)
export async function createHash(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

// Compara la contraseña ingresada con el hash guardado (se usa en el login)
export async function isValidPassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
}
