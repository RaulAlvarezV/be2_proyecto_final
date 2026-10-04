import { Router } from "express";
import { healthStatus } from "../controllers/health.controller.js";

const router = Router();

router.get("/", healthStatus);

export default router;
