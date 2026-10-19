import { Router } from "express";
import { getEvents, createEvent, updateEvent, cancelEvent } from "../controllers/events.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { authorizeRoles, authorizeEventOwnerOrAdmin } from "../middlewares/authorize.middleware.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router();

// Consultar eventos publicados es público
router.get("/", getEvents);

// Orden: autenticación (401) → autorización por rol (403) → controller
router.post("/", auth, authorizeRoles(...PERMISSIONS.CREATE_EVENT), createEvent);

// Modificar y cancelar: además del rol, el organizer tiene que ser el dueño del evento (403 si no lo es)
router.put("/:eid", auth, authorizeRoles(...PERMISSIONS.MANAGE_EVENT), authorizeEventOwnerOrAdmin, updateEvent);
router.patch("/:eid/cancel", auth, authorizeRoles(...PERMISSIONS.MANAGE_EVENT), authorizeEventOwnerOrAdmin, cancelEvent);

export default router;
