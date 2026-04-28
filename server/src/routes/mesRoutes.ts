import { Router } from "express";
import * as MesController from "../controllers/MesController";

const router = Router();

// Sipariş No ile SAP verisini çekme
router.get("/order/:orderId", MesController.getSapOrder);

export default router;
