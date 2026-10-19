import { Router } from "express";
import { getEvents, getEventById, createEvent, updateEvent, cancelEvent } from "../controllers/events.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { authorizeRoles, authorizeEventOwnerOrAdmin } from "../middlewares/authorize.middleware.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router();

// Consultar eventos (listado y detalle) es público
router.get("/", getEvents);
router.get("/:id", getEventById);

// Orden: autenticación (401) → autorización por rol (403) → controller
router.post("/", auth, authorizeRoles(...PERMISSIONS.CREATE_EVENT), createEvent);

// Modificar y cancelar: además del rol, el organizer tiene que ser el dueño del evento (403 si no lo es)
router.put("/:id", auth, authorizeRoles(...PERMISSIONS.MANAGE_EVENT), authorizeEventOwnerOrAdmin, updateEvent);
router.patch("/:id/cancel", auth, authorizeRoles(...PERMISSIONS.MANAGE_EVENT), authorizeEventOwnerOrAdmin, cancelEvent);

export default router;
