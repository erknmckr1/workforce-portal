import { Router } from "express";
import {
  getExportData,
  getAvailableAreas,
  logAndAuthorizeExport,
  downloadExcelFile,
} from "../controllers/ExportController";

const router = Router();

router.get("/data", getExportData);
router.get("/areas", getAvailableAreas);
router.post("/log-download", logAndAuthorizeExport);
router.post("/download-excel", downloadExcelFile);

export default router;
