// Roles del sistema. En la temática: user = jugadores, organizer = clubes y entrenadores, admin = administración
export const ROLES = Object.freeze({
    USER: "user",
    ORGANIZER: "organizer",
    ADMIN: "admin"
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

// Matriz de permisos: qué roles pueden hacer cada acción. Las rutas la usan con authorizeRoles(...PERMISSIONS.X),
// así ningún rol queda escrito suelto en el código. Se congela para que no pueda modificarse en tiempo de ejecución
export const PERMISSIONS = Object.freeze({
    // crear torneos y clínicas
    CREATE_EVENT: Object.freeze([ROLES.ORGANIZER, ROLES.ADMIN]),
    // modificar o cancelar eventos: el organizer solo los propios (lo controla authorizeEventOwnerOrAdmin), el admin cualquiera
    MANAGE_EVENT: Object.freeze([ROLES.ORGANIZER, ROLES.ADMIN]),
    // ver todos los usuarios y cambiar roles
    MANAGE_USERS: Object.freeze([ROLES.ADMIN])
});
