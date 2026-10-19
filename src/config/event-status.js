// Ciclo de vida de un evento. Se usa un estado y no solo la fecha: un torneo puede ser futuro y estar cancelado
export const EVENT_STATUS = Object.freeze({
    DRAFT: "draft",
    PUBLISHED: "published",
    CANCELLED: "cancelled",
    FINISHED: "finished"
});

export const EVENT_STATUS_VALUES = Object.freeze(Object.values(EVENT_STATUS));
