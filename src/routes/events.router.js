import { Router } from "express";
import { getEvents, createEvent } from "../controllers/events.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorize.middleware.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router();

// Consultar eventos es público
router.get("/", getEvents);

// Orden: autenticación (401) → autorización por rol (403) → controller
router.post("/", auth, authorizeRoles(...PERMISSIONS.CREATE_EVENT), createEvent);

export default router;
