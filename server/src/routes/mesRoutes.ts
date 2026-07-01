import { Router } from "express";
import * as MesController from "../controllers/MesController";

const router = Router();

// Sipariş No ile SAP verisini çekme
router.get("/order/:orderId", MesController.getSapOrder);
router.get("/operator/:id", MesController.getOperatorById);

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

// Fire (Scrap) Ölçüm Rotaları
router.get("/scrap-measurements", MesController.getScrapMeasurements);
router.post("/scrap-measurements", MesController.submitScrapMeasurement);
router.put("/scrap-measurements", MesController.updateScrapMeasurement);

// Makine Rotaları
router.get("/machines", MesController.getMachines);

// Ölçüm (Measurement) Rotaları
router.get("/measure-limits/:materialNo", MesController.getMeasureLimits);
router.get("/measurements/by-material", MesController.getMeasurementsByMaterial);
router.get("/measurements", MesController.getMeasurements);
router.post("/measurements", MesController.saveMeasurement);
router.put("/measurements/:id", MesController.updateMeasurement);
router.delete("/measurements/:id", MesController.deleteMeasurement);

// Field Participation (Alan Katılım) Rotaları
router.post("/field/join", MesController.joinField);
router.post("/field/leave", MesController.leaveField);
router.get("/field/participants", MesController.getActiveFieldParticipants);

// Setup (Hazırlık) Rotaları
router.post("/start-setup", MesController.startSetup);
router.post("/finish-setup", MesController.finishSetup);
router.post("/start-process", MesController.startProcessFromSetup);

export default router;
