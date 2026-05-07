import { Router } from "express";
import {
  getPhoneDirectory,
  createPhoneEntry,
  updatePhoneEntry,
  deletePhoneEntry,
} from "../controllers/phoneDirectoryController";

const router = Router();

router.get("/", getPhoneDirectory);
router.post("/", createPhoneEntry);
router.put("/:id", updatePhoneEntry);
router.delete("/:id", deletePhoneEntry);

export default router;
