import { Router } from "express";
import * as MesController from "../controllers/MesController";

const router = Router();

// Sipariş No ile SAP verisini çekme
router.get("/order/:orderId", MesController.getSapOrder);

// Statik veri çekme rotaları
router.get("/processes", MesController.getProcessesByArea);
router.get("/repair-reasons", MesController.getRepairReasonsByArea);
router.get("/stop-reasons", MesController.getStopReasonsByArea);

// İş Başlatma Rotası
router.post("/start-work", MesController.startWork);

// İş Durdurma Rotası
router.post("/stop-work", MesController.stopWork);

// İş İptal Rotası
router.post("/cancel-work", MesController.cancelWork);

// Mevcut işleri cekecek rota
router.get("/work-logs", MesController.getWorkLogs);

// Mevcut işi yeniden başlatacak rota
router.post("/restart-work", MesController.restartWork);

export default router;
