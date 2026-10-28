// DTO (Data Transfer Object): define qué datos de un usuario salen de la API.
// Se arma un objeto nuevo solo con los campos públicos (lista blanca): la contraseña nunca se incluye, ni hasheada,
// y un campo sensible que se agregue al modelo en el futuro tampoco sale por accidente

// Usuario completo: registro y listado de administración
export class UserDTO {
    constructor(user) {
        this.id = user._id;
        this.first_name = user.first_name;
        this.last_name = user.last_name;
        this.email = user.email;
        this.role = user.role;
    }
}

// Usuario autenticado (/current): los datos de la sesión que cargó la estrategia current
export class CurrentUserDTO {
    constructor(user) {
        this.id = user.id;
        this.email = user.email;
        this.role = user.role;
    }
}
