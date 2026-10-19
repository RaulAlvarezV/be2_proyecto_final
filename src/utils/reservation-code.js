import { randomBytes } from "node:crypto";

const CODE_PREFIX = "HKY";
const CODE_BYTES = 4;

// Código de reserva legible para el usuario (ej. HKY-8F3A2C1D). Es aleatorio y el índice unique del modelo evita repetidos
export function generateReservationCode() {
    return `${CODE_PREFIX}-${randomBytes(CODE_BYTES).toString("hex").toUpperCase()}`;
}
