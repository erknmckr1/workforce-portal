import { Router } from "express";
import multer from "multer";
import {
    createRequest,
    getRequests,
    getRequestMessages,
    sendMessage,
    updateRequestStatus
} from "../controllers/itRequestController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Bütün rotalar oturum açmış kullanıcı gerektirir
router.use(requireAuth);

router.post("/", upload.single("attachment"), createRequest);
router.get("/", getRequests);
router.get("/:id/messages", getRequestMessages);
router.post("/:id/messages", upload.single("attachment"), sendMessage);
router.put("/:id/status", updateRequestStatus);

export default router;
