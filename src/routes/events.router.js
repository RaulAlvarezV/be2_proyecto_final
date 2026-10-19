import { Router } from "express";
import { getEvents, getEventById, createEvent, updateEvent, changeEventStatus } from "../controllers/events.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { authorizeRoles, authorizeEventOwnerOrAdmin } from "../middlewares/authorize.middleware.js";
import { createTicket } from "../controllers/tickets.controller.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router();

// Consultar eventos (listado y detalle) es público
router.get("/", getEvents);
router.get("/:id", getEventById);

// Orden: autenticación (401) → autorización por rol (403) → controller
router.post("/", auth, authorizeRoles(...PERMISSIONS.CREATE_EVENT), createEvent);

// Modificar y cambiar el estado (publicar o cancelar): además del rol, el organizer tiene que ser el dueño del evento (403 si no lo es)
router.put("/:id", auth, authorizeRoles(...PERMISSIONS.MANAGE_EVENT), authorizeEventOwnerOrAdmin, updateEvent);
router.patch("/:id/status", auth, authorizeRoles(...PERMISSIONS.MANAGE_EVENT), authorizeEventOwnerOrAdmin, changeEventStatus);

// Inscripción: cualquier usuario autenticado (las reglas de estado, duplicados y cupo están en el service)
router.post("/:eid/tickets", auth, createTicket);

export default router;
