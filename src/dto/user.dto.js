// Datos públicos del usuario: nunca se devuelve la contraseña (ni hasheada)
export function toPublicUser(user) {
    return {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role
    };
}
