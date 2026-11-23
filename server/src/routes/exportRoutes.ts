import { Router } from "express";
import {
  getExportData,
  getAvailableAreas,
  logAndAuthorizeExport,
  downloadExcelFile,
} from "../controllers/ExportController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

// Dışa veri aktarımı sadece oturum açmış yetkili kullanıcılar içindir
router.use(requireAuth);

router.get("/data", getExportData);
router.get("/areas", getAvailableAreas);
router.post("/log-download", logAndAuthorizeExport);
router.post("/download-excel", downloadExcelFile);

export default router;
