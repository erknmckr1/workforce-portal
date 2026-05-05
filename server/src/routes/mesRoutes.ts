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

// Mevcut işi bitirecek rota
router.post("/finish-work", MesController.finishWork);

// Mola İşlemleri
router.post("/start-break", MesController.startBreak);
router.post("/end-break", MesController.endBreak);
router.get("/active-breaks", MesController.getActiveBreaks);
router.get("/get-factory-entry", MesController.getFactoryEntryTime);

// Malzeme Görsel Rotası
router.get("/get-product-file/:materialNo", MesController.getProductFile);
router.get("/reports/personnel-movement", MesController.getPersonnelMovementReport);
router.get("/reports/late-arrivals", MesController.getLateArrivals);

export default router;
