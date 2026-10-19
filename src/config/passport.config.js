import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JwtStrategy } from "passport-jwt";
import { env } from "./env.js";
import { COOKIE_NAME } from "./cookie.js";
import { ROLES } from "./permissions.js";
import { usersRepository } from "../repositories/users.repository.js";
import { createHash, isValidPassword } from "../utils/hash.js";
import { toPublicUser } from "../dto/user.dto.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Autenticación fallida sin error interno: done(null, false, info). El status lo usa passportCall para responder
const fail = (done, message, status) => done(null, false, { message, status });

// Estrategia register: valida, normaliza el email, controla duplicados, hashea y crea el usuario con rol user
function registerStrategy(repository) {
    passport.use("register", new LocalStrategy(
        { usernameField: "email", passReqToCallback: true },
        async (req, email, password, done) => {
            try {
                const { first_name, last_name } = req.body;

                if (!first_name || !last_name) {
                    return fail(done, "Faltan campos obligatorios", 400);
                }

                const notText = [first_name, last_name, email, password].some(value => typeof value !== "string");
                if (notText) {
                    return fail(done, "Los campos deben ser texto", 400);
                }

                const firstName = first_name.trim();
                const lastName = last_name.trim();
                if (!firstName || !lastName) {
                    return fail(done, "El nombre y el apellido no pueden estar vacíos", 400);
                }

                // Normalización: sin espacios y en minúsculas, así "Ana@Mail.com " y "ana@mail.com" son el mismo
                const normalizedEmail = email.trim().toLowerCase();
                if (!EMAIL_REGEX.test(normalizedEmail)) {
                    return fail(done, "Formato de email inválido", 400);
                }

                // Una contraseña de solo espacios no vale. No se recorta la que se guarda
                if (!password.trim()) {
                    return fail(done, "La contraseña no puede estar vacía", 400);
                }

                if (password.length < MIN_PASSWORD_LENGTH) {
                    return fail(done, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`, 400);
                }

                const userExists = await repository.getByEmail(normalizedEmail);
                if (userExists) {
                    return fail(done, "El email ya está registrado", 409);
                }

                // El rol lo asigna el backend: nunca se toma del body
                const newUser = await repository.create({
                    first_name: firstName,
                    last_name: lastName,
                    email: normalizedEmail,
                    password: await createHash(password),
                    role: ROLES.USER
                });

                return done(null, toPublicUser(newUser));
            } catch (error) {
                return done(error);
            }
        }
    ));
}

// Estrategia login: valida las credenciales. El JWT y la cookie los genera el controller, no la estrategia
function loginStrategy(repository) {
    passport.use("login", new LocalStrategy(
        { usernameField: "email" },
        async (email, password, done) => {
            try {
                if (typeof email !== "string" || typeof password !== "string") {
                    return fail(done, "Los campos deben ser texto", 400);
                }

                const user = await repository.getByEmail(email.trim().toLowerCase());

                // Mismo mensaje si no existe el email o si la contraseña no coincide: no se da ninguna pista
                if (!user || !(await isValidPassword(password, user.password))) {
                    return fail(done, "Credenciales inválidas", 401);
                }

                // Datos mínimos para el token: nunca la contraseña
                return done(null, {
                    id: user._id.toString(),
                    email: user.email,
                    role: user.role
                });
            } catch (error) {
                return done(error);
            }
        }
    ));
}

// Le indica a passport-jwt de dónde sacar el token: de la cookie currentUser (no del header)
const cookieExtractor = req => req?.cookies?.[COOKIE_NAME] ?? null;

// Estrategia current: verifica el JWT de la cookie (firma y vencimiento) y busca al usuario por el id del token
function currentStrategy(repository) {
    passport.use("current", new JwtStrategy(
        {
            jwtFromRequest: cookieExtractor,
            secretOrKey: env.JWT_SECRET,
            algorithms: ["HS256"] // el algoritmo lo fija el servidor, no el header del token
        },
        async (jwtPayload, done) => {
            try {
                // Se busca en la base para confirmar que la cuenta sigue existiendo y tener el rol actualizado
                const user = await repository.getById(jwtPayload.id);
                if (!user) {
                    return fail(done, "Usuario no encontrado", 401);
                }

                // Solo id, email y role: nunca la contraseña
                return done(null, {
                    id: user._id.toString(),
                    email: user.email,
                    role: user.role
                });
            } catch (error) {
                return done(error);
            }
        }
    ));
}

// Registra todas las estrategias. Para sumar un proveedor externo (Google, GitHub, etc.)
// se agrega su función acá, sin tocar app.js. Recibe el repository para poder probarlas con uno falso
export function initializePassport(repository = usersRepository) {
    registerStrategy(repository);
    loginStrategy(repository);
    currentStrategy(repository);
}
