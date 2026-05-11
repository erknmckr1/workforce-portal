import { Router } from "express";
import { 
  saveScore, 
  getLeaderboard, 
  identifyPlayer, 
  createProfile 
} from "../controllers/GameController";

const router = Router();

router.get("/identify/:id", identifyPlayer);
router.post("/profile", createProfile);
router.post("/score", saveScore);
router.get("/leaderboard", getLeaderboard);

export default router;
