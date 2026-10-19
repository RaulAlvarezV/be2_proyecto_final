// Estados de un ticket (inscripción a un evento)
export const TICKET_STATUS = Object.freeze({
    CONFIRMED: "confirmed",
    // Reservado para un flujo con pago: el lugar se guarda hasta que se confirma
    PENDING: "pending",
    CANCELLED: "cancelled"
});

export const TICKET_STATUS_VALUES = Object.freeze(Object.values(TICKET_STATUS));

// Tickets que ocupan cupo y cuentan como inscripción activa. Los cancelados no ocupan lugar
export const ACTIVE_TICKET_STATUS = Object.freeze([TICKET_STATUS.CONFIRMED, TICKET_STATUS.PENDING]);
