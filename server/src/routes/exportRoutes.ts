import { Router } from "express";
import {
  getExportData,
  getAvailableAreas,
  logAndAuthorizeExport,
} from "../controllers/ExportController";

const router = Router();

router.get("/data", getExportData);
router.get("/areas", getAvailableAreas);
router.post("/log-download", logAndAuthorizeExport);

export default router;
