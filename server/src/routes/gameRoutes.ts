import { Router } from "express";
import { 
  saveScore, 
  getLeaderboard, 
  identifyPlayer, 
  createProfile,
  startGameSession,
  finishGameSession,
} from "../controllers/GameController";

const router = Router();

router.get("/identify/:id", identifyPlayer);
router.post("/profile", createProfile);
router.post("/session/start", startGameSession);
router.post("/session/:id/finish", finishGameSession);
router.post("/score", saveScore);
router.get("/leaderboard", getLeaderboard);

export default router;
