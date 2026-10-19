// Ciclo de vida de un evento. Se usa un estado y no solo la fecha: un torneo puede ser futuro y estar cancelado
export const EVENT_STATUS = Object.freeze({
    DRAFT: "draft",
    PUBLISHED: "published",
    CANCELLED: "cancelled",
    FINISHED: "finished"
});

export const EVENT_STATUS_VALUES = Object.freeze(Object.values(EVENT_STATUS));

// Cambios de estado permitidos a mano (PATCH /api/events/:id/status).
// cancelled y finished son finales; finished no se elige: se asigna solo cuando pasa la fecha del evento
export const STATUS_TRANSITIONS = Object.freeze({
    [EVENT_STATUS.DRAFT]: Object.freeze([EVENT_STATUS.PUBLISHED, EVENT_STATUS.CANCELLED]),
    [EVENT_STATUS.PUBLISHED]: Object.freeze([EVENT_STATUS.CANCELLED]),
    [EVENT_STATUS.CANCELLED]: Object.freeze([]),
    [EVENT_STATUS.FINISHED]: Object.freeze([])
});
