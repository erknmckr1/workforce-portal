import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import apiClient from "../../lib/api";
import area1Background from "../../assets/game/area1.jpg";
import area2Background from "../../assets/game/area2.jpg";
import area3Background from "../../assets/game/area3.jpg";
import area4Background from "../../assets/game/area4.jpg";
import fireObstacle from "../../assets/game/engeller/ates1.svg";
import airObstacle1 from "../../assets/game/engeller/hava_engeli1.svg";
import airObstacle2 from "../../assets/game/engeller/hava_engeli2.svg";
import blueObstacle from "../../assets/game/engeller/maviengel.svg";
import emeraldObstacle from "../../assets/game/engeller/zümrüt.svg";
import bonusItem from "../../assets/game/items/bonus.svg";
import boostItem from "../../assets/game/items/boost.svg";
import magnetItem from "../../assets/game/items/mıknatıs.svg";
import {
  Trophy,
  User as UserIcon,
  ChevronRight,
  Magnet,
  Volume2,
  VolumeX,
} from "lucide-react";

interface ShiftRunnerProps {
  onClose: () => void;
  operatorId?: string;
}

type GameState =
  | "IDENTIFY"
  | "REGISTER"
  | "START"
  | "COUNTDOWN"
  | "PLAYING"
  | "GAMEOVER";
type LocationName = "PRODUCTION" | "WAREHOUSE" | "OFFICE" | "SNOWY";
type ObstacleType =
  | "BIN"
  | "CONE"
  | "PIPE"
  | "FORKLIFT"
  | "CHAIR"
  | "ROBOT_ARM"
  | "PALLET_STACK"
  | "BOX_STACK"
  | "DESK"
  | "SNOW_BARRIER"
  | "SNOW_PILE"
  | "WARNING_SIGN";
type SoundType =
  | "jump"
  | "collect"
  | "hit"
  | "countdown"
  | "start"
  | "transition";
type ObstacleAssetKey = "FIRE" | "BLUE" | "EMERALD" | "AIR_1" | "AIR_2";

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

interface LeaderboardEntry {
  player_name: string;
  score: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const LOCATION_LABELS: Record<LocationName, string> = {
  PRODUCTION: "KIZIL GEZEGEN",
  WAREHOUSE: "ASTEROİT KUŞAĞI",
  OFFICE: "ORBİTAL İSTASYON",
  SNOWY: "BUZUL AY",
};

const LOCATION_BACKGROUNDS: Record<LocationName, string> = {
  PRODUCTION: area1Background,
  WAREHOUSE: area2Background,
  OFFICE: area3Background,
  SNOWY: area4Background,
};

const OBSTACLE_ASSETS: Record<ObstacleAssetKey, string> = {
  FIRE: fireObstacle,
  BLUE: blueObstacle,
  EMERALD: emeraldObstacle,
  AIR_1: airObstacle1,
  AIR_2: airObstacle2,
};

const BACKGROUND_TRANSITION_FRAMES = 120;

const drawScrollingImageBackground = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  offset: number,
  width: number,
  height: number
) => {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const tileRatio = width / height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (imageRatio > tileRatio) {
    sourceWidth = image.naturalHeight * tileRatio;
  } else {
    sourceHeight = image.naturalWidth / tileRatio;
  }

  const maxSourceX = Math.max(0, image.naturalWidth - sourceWidth);
  const maxSourceY = Math.max(0, image.naturalHeight - sourceHeight);
  const panX = maxSourceX * (0.5 + Math.sin(offset * 0.001) * 0.5);
  const panY = maxSourceY * (0.5 + Math.sin(offset * 0.0007) * 0.5);

  ctx.drawImage(
    image,
    panX,
    panY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height
  );
};

const ShiftRunner: React.FC<ShiftRunnerProps> = ({ onClose, operatorId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundImagesRef = useRef<
    Partial<Record<LocationName, HTMLImageElement>>
  >({});
  const obstacleImagesRef = useRef<
    Partial<Record<ObstacleAssetKey, CanvasImageSource>>
  >({});
  const bonusItemImageRef = useRef<HTMLImageElement | null>(null);
  const boostItemImageRef = useRef<HTMLImageElement | null>(null);
  const magnetItemImageRef = useRef<HTMLImageElement | null>(null);
  const [gameState, setGameState] = useState<GameState>("IDENTIFY");
  const gameStateRef = useRef<GameState>("IDENTIFY");
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [operatorName, setOperatorName] = useState<string>("");
  const [nickname, setNickname] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [molaPowerDisplay, setMolaPowerDisplay] = useState(0);
  const [countdown, setCountdown] = useState<3 | 2 | 1 | "BAŞLA">(3);
  const [locationBanner, setLocationBanner] = useState<string | null>(null);
  const [comboDisplay, setComboDisplay] = useState(0);
  const [newRecordBanner, setNewRecordBanner] = useState(false);
  const [showControlsHint, setShowControlsHint] = useState(false);
  const [runStats, setRunStats] = useState({
    ordersCollected: 0,
    bestCombo: 0,
    durationSeconds: 0,
    finalLocation: "PRODUCTION" as LocationName,
  });
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem("shiftRunner_muted") === "true";
  });

  const GRAVITY = 0.5;
  const JUMP_FORCE = -11.2;
  const FALL_GRAVITY_MULTIPLIER = 1.08;
  const HELD_JUMP_GRAVITY_MULTIPLIER = 0.86;
  const MAX_JUMP_HOLD_FRAMES = 10;
  const MIN_PLAYER_Y = 84;
  const COYOTE_FRAMES = 6;
  const JUMP_BUFFER_FRAMES = 8;
  const GROUND_Y = 320;
  const PLAYER_WIDTH = 46;
  const PLAYER_HEIGHT = 68;

  const playerRef = useRef({
    y: GROUND_Y - PLAYER_HEIGHT,
    dy: 0,
    isJumping: false,
    isJumpHeld: false,
    jumpHoldFrames: 0,
    coyoteFrames: 0,
    jumpBufferFrames: 0,
    isDucking: false,
  });

  const obstaclesRef = useRef<any[]>([]);
  const itemsRef = useRef<any[]>([]);
  const particlesRef = useRef<any[]>([]); // Yeni: Toz ve parıltı efektleri
  const molaPowerRef = useRef(0);
  const magnetPowerRef = useRef(0);
  const [magnetPowerDisplay, setMagnetPowerDisplay] = useState(0);
  const frameRef = useRef<number>(0);
  const nextObstacleFrameRef = useRef<number>(0);
  const nextItemFrameRef = useRef<number>(0);
  const consecutiveGroundObstaclesRef = useRef(0);
  const gameLoopRef = useRef<number>(0);
  const countdownTimerRef = useRef<number>(0);
  const locationBannerTimerRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isMutedRef = useRef(isMuted);
  const isStartingGameRef = useRef(isStartingGame);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const ordersCollectedRef = useRef(0);
  const runStartedAtRef = useRef(0);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const floatingTextIdRef = useRef(0);
  const newRecordShownRef = useRef(false);
  const newRecordTimerRef = useRef<number>(0);
  const controlsHintTimerRef = useRef<number>(0);
  const gameSessionIdRef = useRef<string>("");
  const gameSessionTokenRef = useRef<string>("");
  const playerOperatorIdRef = useRef<string>("");
  const locationRef = useRef<LocationName>("PRODUCTION");
  const previousLocationRef = useRef<LocationName>("PRODUCTION");
  const backgroundTransitionFrameRef = useRef(BACKGROUND_TRANSITION_FRAMES);
  const trailRef = useRef<{ y: number; h: number; opacity: number }[]>([]);
  const shakeRef = useRef(0);

  const createParticles = (
    x: number,
    y: number,
    color: string,
    count: number,
  ) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        dx: (Math.random() - 0.5) * 5,
        dy: (Math.random() - 0.5) * 5,
        size: Math.random() * 4,
        life: 1,
        color,
      });
    }
  };

  const resetScore = () => {
    scoreRef.current = 0;
    setScore(0);
  };

  const addScore = (points: number) => {
    scoreRef.current += points;
    setScore(scoreRef.current);
  };

  const showNewRecordBanner = () => {
    if (newRecordTimerRef.current) {
      window.clearTimeout(newRecordTimerRef.current);
    }

    setNewRecordBanner(true);
    playSound("transition");
    newRecordTimerRef.current = window.setTimeout(() => {
      setNewRecordBanner(false);
      newRecordTimerRef.current = 0;
    }, 2200);
  };

  const showFirstGameControlsHint = () => {
    if (localStorage.getItem("shiftRunner_controlsSeen") === "true") return;

    localStorage.setItem("shiftRunner_controlsSeen", "true");
    setShowControlsHint(true);

    if (controlsHintTimerRef.current) {
      window.clearTimeout(controlsHintTimerRef.current);
    }

    controlsHintTimerRef.current = window.setTimeout(() => {
      setShowControlsHint(false);
      controlsHintTimerRef.current = 0;
    }, 3200);
  };

  const resetCombo = () => {
    comboRef.current = 0;
    setComboDisplay(0);
  };

  const captureRunStats = () => {
    const durationSeconds = runStartedAtRef.current
      ? Math.max(0, Math.floor((Date.now() - runStartedAtRef.current) / 1000))
      : 0;

    setRunStats({
      ordersCollected: ordersCollectedRef.current,
      bestCombo: bestComboRef.current,
      durationSeconds,
      finalLocation: locationRef.current,
    });
  };

  const addFloatingText = (
    x: number,
    y: number,
    text: string,
    color = "#facc15",
  ) => {
    floatingTextIdRef.current += 1;
    floatingTextsRef.current.push({
      id: floatingTextIdRef.current,
      x,
      y,
      text,
      color,
      life: 1,
    });
  };

  const collectOrder = (x: number, y: number) => {
    comboRef.current = Math.min(comboRef.current + 1, 12);
    bestComboRef.current = Math.max(bestComboRef.current, comboRef.current);
    ordersCollectedRef.current += 1;
    setComboDisplay(comboRef.current);

    const multiplier = Math.min(1 + Math.floor((comboRef.current - 1) / 3), 4);
    const points = 50 * multiplier;
    addScore(points);
    addFloatingText(
      x,
      y,
      multiplier > 1 ? `+${points} x${multiplier}` : `+${points}`,
      multiplier > 1 ? "#f97316" : "#facc15",
    );
  };

  const getAudioContext = () => {
    if (typeof window === "undefined") return null;

    const AudioContextClass =
      window.AudioContext ||
      (window as WindowWithWebkitAudio).webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }

    return audioContextRef.current;
  };

  const playTone = (
    ctx: AudioContext,
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
    endFrequency?: number,
  ) => {
    const startAt = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency),
        startAt + duration,
      );
    }

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  };

  const playSound = (sound: SoundType) => {
    if (isMutedRef.current) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    if (sound === "jump") {
      playTone(ctx, 260, 0.12, "square", 0.045, 0, 520);
    } else if (sound === "collect") {
      playTone(ctx, 760, 0.07, "sine", 0.045);
      playTone(ctx, 1120, 0.09, "sine", 0.035, 0.055);
    } else if (sound === "hit") {
      playTone(ctx, 180, 0.16, "sawtooth", 0.06, 0, 70);
      playTone(ctx, 90, 0.2, "square", 0.035, 0.025, 45);
    } else if (sound === "countdown") {
      playTone(ctx, 520, 0.055, "square", 0.035);
    } else if (sound === "start") {
      playTone(ctx, 560, 0.08, "triangle", 0.04);
      playTone(ctx, 840, 0.12, "triangle", 0.045, 0.07);
    } else if (sound === "transition") {
      playTone(ctx, 420, 0.09, "triangle", 0.035);
      playTone(ctx, 640, 0.13, "triangle", 0.04, 0.09);
    }
  };

  const toggleMute = () => {
    setIsMuted((current) => {
      const next = !current;
      isMutedRef.current = next;
      localStorage.setItem("shiftRunner_muted", String(next));
      if (!next) {
        void getAudioContext()?.resume();
      }
      return next;
    });
  };

  const showLocationBanner = (nextLocation: LocationName) => {
    if (locationBannerTimerRef.current) {
      window.clearTimeout(locationBannerTimerRef.current);
    }

    playSound("transition");
    setLocationBanner(LOCATION_LABELS[nextLocation]);
    locationBannerTimerRef.current = window.setTimeout(() => {
      setLocationBanner(null);
      locationBannerTimerRef.current = 0;
    }, 1800);
  };

  const isOverheadObstacle = (type: ObstacleType) =>
    type === "PIPE" || type === "WARNING_SIGN";

  const getObstacleAssetKey = (type: ObstacleType): ObstacleAssetKey => {
    if (type === "PIPE") return "AIR_1";
    if (type === "WARNING_SIGN") return "AIR_2";
    if (type === "FORKLIFT" || type === "SNOW_BARRIER") return "BLUE";
    if (type === "ROBOT_ARM" || type === "BOX_STACK" || type === "DESK") {
      return "EMERALD";
    }
    return "FIRE";
  };

  const getObstacleSize = (type: ObstacleType) => {
    switch (type) {
      case "FORKLIFT":
        return { width: 90, height: 64 };
      case "CHAIR":
        return { width: 44, height: 54 };
      case "PIPE":
        return { width: 68, height: 150 };
      case "ROBOT_ARM":
        return { width: 74, height: 68 };
      case "PALLET_STACK":
        return { width: 72, height: 58 };
      case "BOX_STACK":
        return { width: 62, height: 76 };
      case "DESK":
        return { width: 76, height: 56 };
      case "SNOW_BARRIER":
        return { width: 76, height: 48 };
      case "SNOW_PILE":
        return { width: 70, height: 42 };
      case "WARNING_SIGN":
        return { width: 70, height: 115 };
      default:
        return { width: 50, height: 50 };
    }
  };

  const pickObstacleType = (): ObstacleType => {
    const rand = Math.random();

    if (locationRef.current === "PRODUCTION") {
      if (rand > 0.78) return "PIPE";
      if (rand > 0.55) return "ROBOT_ARM";
      if (rand > 0.28) return "CONE";
      return "BIN";
    }

    if (locationRef.current === "WAREHOUSE") {
      if (rand > 0.74) return "WARNING_SIGN";
      if (rand > 0.52) return "FORKLIFT";
      if (rand > 0.26) return "PALLET_STACK";
      return "BOX_STACK";
    }

    if (locationRef.current === "OFFICE") {
      if (rand > 0.75) return "PIPE";
      if (rand > 0.48) return "DESK";
      return "CHAIR";
    }

    if (rand > 0.75) return "WARNING_SIGN";
    if (rand > 0.42) return "SNOW_BARRIER";
    return "SNOW_PILE";
  };

  const getObstacleBounds = (obs: any) => {
    const isOverhead = isOverheadObstacle(obs.type);
    const top = isOverhead ? obs.y - obs.height : GROUND_Y - obs.height;
    const bottom = isOverhead ? obs.y : GROUND_Y;

    return {
      left: obs.x,
      right: obs.x + obs.width,
      top,
      bottom,
    };
  };

  const overlapsObstacle = (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    return obstaclesRef.current.some((obs) => {
      const bounds = getObstacleBounds(obs);
      const safePadding = 28;

      return (
        x < bounds.right + safePadding &&
        x + width > bounds.left - safePadding &&
        y < bounds.bottom + safePadding &&
        y + height > bounds.top - safePadding
      );
    });
  };

  const findSafeItemY = (x: number, width: number, height: number) => {
    const hasHorizontalObstacleConflict = obstaclesRef.current.some((obs) => {
      const bounds = getObstacleBounds(obs);
      const horizontalPadding = 180;

      return (
        x < bounds.right + horizontalPadding &&
        x + width > bounds.left - horizontalPadding
      );
    });

    if (hasHorizontalObstacleConflict) return undefined;
    if (nextObstacleFrameRef.current - frameRef.current < 42) return undefined;

    const candidates = [
      GROUND_Y - 125,
      GROUND_Y - 155,
      GROUND_Y - 185,
    ].sort(() => Math.random() - 0.5);

    return candidates.find((y) => !overlapsObstacle(x, y, width, height));
  };

  const startSecureGameSession = async () => {
    const finalId = playerOperatorIdRef.current || operatorId || sessionId;
    if (!finalId) {
      toast.error("Yolculuğa başlamak için yolcu kodu gerekli.");
      return false;
    }

    isStartingGameRef.current = true;
    setIsStartingGame(true);
    try {
      const res = await apiClient.post("/game/session/start", {
        operator_id: finalId,
      });

      if (
        res.data?.success &&
        res.data.data?.sessionId &&
        res.data.data?.finishToken
      ) {
        gameSessionIdRef.current = res.data.data.sessionId;
        gameSessionTokenRef.current = res.data.data.finishToken;
        return true;
      }

      toast.error("Oyun oturumu başlatılamadı.");
      return false;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Oyun oturumu başlatılamadı.");
      return false;
    } finally {
      isStartingGameRef.current = false;
      setIsStartingGame(false);
    }
  };

  const beginCountdown = async () => {
    if (isStartingGameRef.current || gameStateRef.current === "COUNTDOWN")
      return;

    const sessionStarted = await startSecureGameSession();
    if (!sessionStarted) return;

    if (countdownTimerRef.current) {
      window.clearTimeout(countdownTimerRef.current);
    }

    gameStateRef.current = "COUNTDOWN";
    setGameState("COUNTDOWN");
    setCountdown(3);

    const steps: (3 | 2 | 1 | "BAŞLA")[] = [2, 1, "BAŞLA"];
    let index = 0;

    const tick = () => {
      const nextStep = steps[index];
      setCountdown(nextStep);
      playSound(nextStep === "BAŞLA" ? "start" : "countdown");
      index += 1;

      if (nextStep === "BAŞLA") {
        countdownTimerRef.current = window.setTimeout(() => {
          countdownTimerRef.current = 0;
          startGame();
        }, 650);
        return;
      }

      countdownTimerRef.current = window.setTimeout(tick, 700);
    };

    countdownTimerRef.current = window.setTimeout(tick, 700);
  };

  const startGame = () => {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (countdownTimerRef.current) {
      window.clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = 0;
    }
    if (locationBannerTimerRef.current) {
      window.clearTimeout(locationBannerTimerRef.current);
      locationBannerTimerRef.current = 0;
    }
    if (newRecordTimerRef.current) {
      window.clearTimeout(newRecordTimerRef.current);
      newRecordTimerRef.current = 0;
    }
    if (controlsHintTimerRef.current) {
      window.clearTimeout(controlsHintTimerRef.current);
      controlsHintTimerRef.current = 0;
    }
    setLocationBanner(null);
    setNewRecordBanner(false);
    setShowControlsHint(false);
    newRecordShownRef.current = false;
    gameStateRef.current = "PLAYING";
    setGameState("PLAYING");
    resetScore();
    resetCombo();
    bestComboRef.current = 0;
    ordersCollectedRef.current = 0;
    runStartedAtRef.current = Date.now();
    setRunStats({
      ordersCollected: 0,
      bestCombo: 0,
      durationSeconds: 0,
      finalLocation: "PRODUCTION",
    });
    setMolaPowerDisplay(0);
    setMagnetPowerDisplay(0);
    setHasSaved(false); // Kayıt durumunu her yeni oyunda sıfırla
    molaPowerRef.current = 0;
    magnetPowerRef.current = 0;
    obstaclesRef.current = [];
    itemsRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    trailRef.current = [];
    shakeRef.current = 0;
    playerRef.current = {
      y: GROUND_Y - PLAYER_HEIGHT,
      dy: 0,
      isJumping: false,
      isJumpHeld: false,
      jumpHoldFrames: 0,
      coyoteFrames: 0,
      jumpBufferFrames: 0,
      isDucking: false,
    };
    frameRef.current = 0;
    nextObstacleFrameRef.current = 140;
    nextItemFrameRef.current = 190;
    consecutiveGroundObstaclesRef.current = 0;
    locationRef.current = "PRODUCTION";
    previousLocationRef.current = "PRODUCTION";
    backgroundTransitionFrameRef.current = BACKGROUND_TRANSITION_FRAMES;
    setLocation("PRODUCTION");
    showFirstGameControlsHint();
    animate();
  };

  const performJump = () => {
    const player = playerRef.current;
    player.dy = JUMP_FORCE;
    player.isJumping = true;
    player.isJumpHeld = true;
    player.jumpHoldFrames = 0;
    player.jumpBufferFrames = 0;
    player.coyoteFrames = 0;
    playSound("jump");
    createParticles(70, GROUND_Y, "#ffffff", 10); // Kalkış tozu
  };

  const jump = () => {
    if (gameStateRef.current === "PLAYING" && !playerRef.current.isDucking) {
      const player = playerRef.current;
      player.isJumpHeld = true;
      player.jumpBufferFrames = JUMP_BUFFER_FRAMES;

      if (!player.isJumping || player.coyoteFrames > 0) {
        performJump();
      }
    } else if (
      gameStateRef.current === "START" ||
      gameStateRef.current === "GAMEOVER"
    ) {
      beginCountdown();
    }
  };

  const releaseJump = () => {
    playerRef.current.isJumpHeld = false;
  };

  const [location, setLocation] = useState<LocationName>("PRODUCTION");

  const animate = () => {
    if (gameStateRef.current !== "PLAYING") return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // --- 0. SCREEN SHAKE (SARSINTI) ---
    ctx.save();
    try {
      if (shakeRef.current > 0) {
        const shakeX = (Math.random() - 0.5) * shakeRef.current;
        const shakeY = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(shakeX, shakeY);
        shakeRef.current *= 0.9;
        if (shakeRef.current < 0.1) shakeRef.current = 0;
      }

      // --- 0. LOKASYON KONTROLÜ (750 PUANLIK DÖNGÜLER) ---
      const themes: LocationName[] = [
        "PRODUCTION",
        "WAREHOUSE",
        "OFFICE",
        "SNOWY",
      ];
      const themeIndex = Math.floor((scoreRef.current % 3000) / 750); // Her tema 750 puan
      const currentLocation = themes[themeIndex];

      if (currentLocation !== locationRef.current) {
        previousLocationRef.current = locationRef.current;
        locationRef.current = currentLocation;
        backgroundTransitionFrameRef.current = 0;
        setLocation(currentLocation);
        showLocationBanner(currentLocation);
      }

      // --- 0. HIZ VE MESAFE HESAPLAMASI ---
      const currentSpeed = 3.5 + frameRef.current / 3000;
      const scrollOffset = frameRef.current * currentSpeed;

      // --- 1. DİNAMİK GÖKYÜZÜ ---
      const skyProgress = Math.min(frameRef.current / 5000, 1);
      let r = Math.floor(59 - (59 - 15) * skyProgress);
      let g = Math.floor(130 - (130 - 23) * skyProgress);
      let b = Math.floor(246 - (246 - 42) * skyProgress);

      // Ofiste gökyüzü daha açık/modern olsun
      if (locationRef.current === "OFFICE") {
        r = 30;
        g = 41;
        b = 59; // Dark slate
      } else if (locationRef.current === "SNOWY") {
        r = 203;
        g = 213;
        b = 225; // Karlı Hava
      }

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- 2. KATMANLI ARKA PLAN (LOCATION BASED) ---
      const drawBackgroundImageForLocation = (
        locationName: LocationName,
        alpha = 1
      ) => {
        const image = backgroundImagesRef.current[locationName];
        if (!image?.complete || image.naturalWidth <= 0) return false;

        ctx.save();
        ctx.globalAlpha = alpha;
        drawScrollingImageBackground(
          ctx,
          image,
          scrollOffset * 0.14,
          canvas.width,
          canvas.height
        );
        ctx.restore();
        return true;
      };

      const transitionProgress = Math.min(
        backgroundTransitionFrameRef.current / BACKGROUND_TRANSITION_FRAMES,
        1
      );
      const easedTransitionProgress =
        transitionProgress * transitionProgress * (3 - 2 * transitionProgress);
      const hasPreviousImageBackground =
        transitionProgress < 1
          ? drawBackgroundImageForLocation(
              previousLocationRef.current,
              1 - easedTransitionProgress
            )
          : false;
      const hasCurrentImageBackground = drawBackgroundImageForLocation(
        locationRef.current,
        transitionProgress < 1 ? easedTransitionProgress : 1
      );
      if (backgroundTransitionFrameRef.current < BACKGROUND_TRANSITION_FRAMES) {
        backgroundTransitionFrameRef.current++;
      }

      const backgroundImage = backgroundImagesRef.current[locationRef.current];
      if (hasPreviousImageBackground || hasCurrentImageBackground) {
        // Asset tabanli arka plan cizildi.
      } else if (locationRef.current === "PRODUCTION") {
        // Fabrika Silüeti
        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        for (let i = 0; i < 5; i++) {
          const x =
            ((scrollOffset * 0.1 + i * 250) % (canvas.width + 250)) - 250;
          ctx.fillRect(canvas.width - x, GROUND_Y - 100, 60, 100);
          ctx.fillRect(canvas.width - x + 20, GROUND_Y - 130, 20, 30);
        }
      } else if (locationRef.current === "WAREHOUSE") {
        // Depo Rafları
        ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
        for (let i = 0; i < 6; i++) {
          const x =
            ((scrollOffset * 0.12 + i * 200) % (canvas.width + 200)) - 200;
          ctx.fillRect(canvas.width - x, GROUND_Y - 150, 10, 150); // Raf direkleri
          ctx.fillRect(canvas.width - x, GROUND_Y - 120, 100, 5); // Raf katı 1
          ctx.fillRect(canvas.width - x, GROUND_Y - 60, 100, 5); // Raf katı 2
        }
      } else if (locationRef.current === "OFFICE") {
        // Ofis Pencereleri ve Masalar
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        for (let i = 0; i < 8; i++) {
          const x =
            ((scrollOffset * 0.08 + i * 150) % (canvas.width + 150)) - 150;
          ctx.fillRect(canvas.width - x, 50, 40, 60); // Pencereler
        }
      } else if (locationRef.current === "SNOWY") {
        // Karlı Dağlar / Çamlar
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        for (let i = 0; i < 5; i++) {
          const x =
            ((scrollOffset * 0.05 + i * 300) % (canvas.width + 300)) - 300;
          ctx.beginPath();
          ctx.moveTo(canvas.width - x, GROUND_Y);
          ctx.lineTo(canvas.width - x + 40, GROUND_Y - 80);
          ctx.lineTo(canvas.width - x + 80, GROUND_Y);
          ctx.fill();
        }
        // Kar Taneleri Yağdır
        if (frameRef.current % 5 === 0) {
          particlesRef.current.push({
            x: Math.random() * canvas.width,
            y: -10,
            size: Math.random() * 3 + 1,
            color: "#fff",
            dx: (Math.random() - 0.5) * 1,
            dy: Math.random() * 2 + 1,
            life: 1,
          });
        }
      }

      ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- 3. OYUNCU FİZİKLERİ VE ÇİZİM ---
      const player = playerRef.current;
      if (
        locationRef.current === "SNOWY" &&
        backgroundImage?.complete &&
        backgroundImage.naturalWidth > 0 &&
        frameRef.current % 5 === 0
      ) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: -10,
          size: Math.random() * 3 + 1,
          color: "#fff",
          dx: (Math.random() - 0.5) * 1,
          dy: Math.random() * 2 + 1,
          life: 1,
        });
      }

      const currentH = player.isDucking ? PLAYER_HEIGHT / 2 : PLAYER_HEIGHT;
      const isGrounded = player.y >= GROUND_Y - currentH - 0.5;

      if (isGrounded) {
        player.coyoteFrames = COYOTE_FRAMES;
      } else if (player.coyoteFrames > 0) {
        player.coyoteFrames--;
      }

      if (player.jumpBufferFrames > 0) {
        player.jumpBufferFrames--;
      }

      if (
        player.jumpBufferFrames > 0 &&
        !player.isDucking &&
        (!player.isJumping || player.coyoteFrames > 0)
      ) {
        performJump();
      }

      let gravityMultiplier = 1;
      if (
        player.dy < 0 &&
        player.isJumpHeld &&
        player.jumpHoldFrames < MAX_JUMP_HOLD_FRAMES
      ) {
        gravityMultiplier = HELD_JUMP_GRAVITY_MULTIPLIER;
        player.jumpHoldFrames++;
      } else if (player.jumpHoldFrames >= MAX_JUMP_HOLD_FRAMES) {
        player.isJumpHeld = false;
      } else if (player.dy < 0 && !player.isJumpHeld) {
        gravityMultiplier = FALL_GRAVITY_MULTIPLIER;
      } else if (player.dy > 0) {
        gravityMultiplier = FALL_GRAVITY_MULTIPLIER;
      }

      player.dy += GRAVITY * gravityMultiplier;
      player.y += player.dy;

      if (player.y < MIN_PLAYER_Y) {
        player.y = MIN_PLAYER_Y;
        if (player.dy < 0) player.dy = 0;
        player.isJumpHeld = false;
      }

      if (player.y > GROUND_Y - currentH) {
        if (player.isJumping) createParticles(70, GROUND_Y, "#ffffff", 5);
        player.y = GROUND_Y - currentH;
        player.dy = 0;
        player.isJumping = false;
        player.isJumpHeld = false;
        player.jumpHoldFrames = 0;
        player.coyoteFrames = COYOTE_FRAMES;
      }

      if (molaPowerRef.current > 0) {
        molaPowerRef.current--;
        if (molaPowerRef.current % 60 === 0)
          setMolaPowerDisplay(Math.ceil(molaPowerRef.current / 60));
      }

      if (magnetPowerRef.current > 0) {
        magnetPowerRef.current--;
        if (magnetPowerRef.current % 60 === 0)
          setMagnetPowerDisplay(Math.ceil(magnetPowerRef.current / 60));
      }

      // GÖLGE
      const shadowWidth =
        PLAYER_WIDTH * (1 - (GROUND_Y - player.y - currentH) / 200);
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.beginPath();
      ctx.ellipse(70, GROUND_Y + 5, shadowWidth / 2, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // --- 3.1 HAYALET İZ (GHOST TRAIL) ---
      trailRef.current.push({ y: player.y, h: currentH, opacity: 0.4 });
      if (trailRef.current.length > 8) trailRef.current.shift();

      trailRef.current.forEach((t, i) => {
        ctx.globalAlpha = t.opacity * (i / trailRef.current.length);
        ctx.fillStyle = molaPowerRef.current > 0 ? "#60a5fa" : "#3b82f6";
        ctx.fillRect(50 + 5, t.y, PLAYER_WIDTH - 10, t.h);
        ctx.globalAlpha = 1.0;
      });

      ctx.save();
      ctx.translate(50, player.y);

      // Mıknatıs Aurası
      if (magnetPowerRef.current > 0) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(168, 85, 247, 0.4)";
        ctx.lineWidth = 2;
        ctx.arc(PLAYER_WIDTH / 2, currentH / 2, 60, 0, Math.PI * 2);
        ctx.stroke();
        // İç halka
        ctx.beginPath();
        ctx.arc(
          PLAYER_WIDTH / 2,
          currentH / 2,
          50 + Math.sin(frameRef.current * 0.2) * 5,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }

      if (molaPowerRef.current > 0) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#fbbf24";
        if (frameRef.current % 10 < 5) ctx.globalAlpha = 0.5;
      }

      // Karakter Çizimi (Lokasyona göre yelek rengi değişebilir)
      const vestColor = location === "OFFICE" ? "#ef4444" : "#fbbf24";
      if (player.isDucking) {
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(0, 10, 50, 20);
        ctx.fillStyle = vestColor;
        ctx.fillRect(10, 12, 30, 10);
        ctx.fillStyle = "#fee2e2";
        ctx.fillRect(35, 5, 12, 12);
        ctx.fillStyle = vestColor;
        ctx.fillRect(32, 0, 18, 6);
      } else {
        const legMove = Math.sin(frameRef.current * 0.2) * 12;
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(player.isJumping ? 5 : 5 + legMove, 45, 12, 15);
        ctx.fillRect(player.isJumping ? 25 : 25 - legMove, 45, 12, 15);
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(5, 15, 30, 35);
        ctx.fillStyle = vestColor;
        ctx.fillRect(5, 20, 30, 12);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 15, 5, 35);
        ctx.strokeRect(25, 15, 5, 35);
        ctx.fillStyle = "#fee2e2";
        ctx.fillRect(12, 0, 16, 18);
        ctx.fillStyle = "#000";
        ctx.fillRect(22, 5, 3, 3);
        ctx.fillStyle = vestColor;
        ctx.fillRect(8, -8, 24, 12);
        ctx.fillRect(12, -12, 16, 6);

        if (skyProgress > 0.4 || location === "OFFICE") {
          const lightAlpha = 0.4;
          const grad = ctx.createRadialGradient(28, 0, 0, 60, 0, 100);
          grad.addColorStop(0, `rgba(251, 191, 36, ${lightAlpha})`);
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(28, 0);
          ctx.lineTo(150, -40);
          ctx.lineTo(150, 40);
          ctx.fill();
        }
      }
      ctx.restore();

      // --- 4. PARÇACIKLAR ---
      particlesRef.current.forEach((p, i) => {
        p.x += p.dx;
        p.y += p.dy;
        p.life -= 0.02;
        if (p.life <= 0) particlesRef.current.splice(i, 1);
        else {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
          ctx.globalAlpha = 1;
        }
      });

      floatingTextsRef.current.forEach((text, index) => {
        text.y -= 0.7;
        text.life -= 0.025;

        if (text.life <= 0) {
          floatingTextsRef.current.splice(index, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = text.life;
        ctx.fillStyle = text.color;
        ctx.font = "900 18px monospace";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 8;
        ctx.fillText(text.text, text.x, text.y);
        ctx.restore();
      });

      // --- 5. ENGELLER (LOCATION BASED) ---
      if (frameRef.current >= nextObstacleFrameRef.current) {
        let type = pickObstacleType();
        if (
          consecutiveGroundObstaclesRef.current >= 2 &&
          !isOverheadObstacle(type)
        ) {
          type =
            locationRef.current === "PRODUCTION" ||
            locationRef.current === "OFFICE"
              ? "PIPE"
              : "WARNING_SIGN";
        }

        const size = getObstacleSize(type);
        const difficulty = Math.min(scoreRef.current / 3000, 1);
        const baseGapPx = 560 - difficulty * 130;
        const randomGapPx = 160 - difficulty * 50;
        const targetGapPx = baseGapPx + Math.random() * randomGapPx;
        const nextGapFrames = Math.max(
          82,
          Math.floor(targetGapPx / currentSpeed),
        );

        obstaclesRef.current.push({
          x: canvas.width,
          width: size.width,
          height: size.height,
          y: isOverheadObstacle(type) ? GROUND_Y - 42 : GROUND_Y,
          type,
        });

        consecutiveGroundObstaclesRef.current = isOverheadObstacle(type)
          ? 0
          : consecutiveGroundObstaclesRef.current + 1;
        nextObstacleFrameRef.current = frameRef.current + nextGapFrames;
      }

      obstaclesRef.current.forEach((obs, index) => {
        // HIZ HESAPLAMASI: 3.5'ten başlar ve daha yavaş artar
        const currentSpeed = 3.5 + frameRef.current / 3000;
        obs.x -= currentSpeed;

        const pTop = player.y;
        const pBottom = player.y + currentH;
        const isOverhead = isOverheadObstacle(obs.type);
        const oTop = isOverhead ? obs.y - obs.height : GROUND_Y - obs.height;
        const oBottom = isOverhead ? obs.y : GROUND_Y;

        // ÇARPIŞMA KONTROLÜ (Daha esnek/affedici hitbox)
        const horizontalPadding = 15;
        const verticalPadding = 10;

        if (
          molaPowerRef.current === 0 &&
          obs.x < 50 + PLAYER_WIDTH - horizontalPadding &&
          obs.x + obs.width > 50 + horizontalPadding &&
          pBottom > oTop + verticalPadding &&
          pTop < oBottom - verticalPadding
        ) {
          gameStateRef.current = "GAMEOVER";
          setGameState("GAMEOVER");
          captureRunStats();
          resetCombo();
          playSound("hit");
          createParticles(70, player.y + 30, "#ef4444", 30);
          shakeRef.current = 15; // Çarpınca sarsıl
          cancelAnimationFrame(gameLoopRef.current);
          return;
        }

        // --- ENGEL ÇİZİMLERİ (PREMIUM SPRITES) ---
        ctx.save();
        ctx.translate(obs.x, oTop);

        if (!isOverhead) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
          ctx.beginPath();
          ctx.ellipse(
            obs.width / 2,
            obs.height + 4,
            obs.width / 2,
            6,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }

        const obstacleImage =
          obstacleImagesRef.current[getObstacleAssetKey(obs.type)];
        if (obstacleImage) {
          ctx.shadowBlur = isOverhead ? 12 : 16;
          ctx.shadowColor = isOverhead
            ? "rgba(96, 165, 250, 0.75)"
            : "rgba(251, 146, 60, 0.6)";
          ctx.drawImage(obstacleImage, 0, 0, obs.width, obs.height);
          ctx.shadowBlur = 0;
        } else if (obs.type === "FORKLIFT") {
          // Gövde (Sarı endüstriyel boya)
          const grad = ctx.createLinearGradient(0, 0, 0, obs.height);
          grad.addColorStop(0, "#facc15");
          grad.addColorStop(1, "#a16207");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(0, 20, obs.width - 10, 30, 5);
          ctx.fill();
          // Kabin
          ctx.strokeStyle = "#1f2937";
          ctx.lineWidth = 3;
          ctx.strokeRect(10, 0, 40, 25);
          ctx.fillStyle = "rgba(147, 197, 253, 0.3)";
          ctx.fillRect(12, 2, 36, 21);
          // Tekerlekler
          ctx.fillStyle = "#000";
          ctx.beginPath();
          ctx.arc(15, 50, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(55, 50, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#6b7280";
          ctx.beginPath();
          ctx.arc(15, 50, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(55, 50, 4, 0, Math.PI * 2);
          ctx.fill();
          // Çatallar ve Palet
          ctx.fillStyle = "#4b5563";
          ctx.fillRect(obs.width - 15, 10, 5, 45); // Mast
          ctx.fillRect(obs.width - 15, 40, 25, 5); // Çatal
          ctx.fillStyle = "#78350f";
          ctx.fillRect(obs.width - 10, 25, 20, 15); // Palet/Kutu
        } else if (obs.type === "CHAIR") {
          // Ofis Koltuğu
          ctx.fillStyle = "#cbd5e1";
          ctx.beginPath();
          ctx.roundRect(5, 0, 8, 30, 2);
          ctx.fill(); // Sırtlık
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "#e2e8f0";
          ctx.fillRect(5, 25, 35, 8); // Oturak
          ctx.strokeRect(5, 25, 35, 8);
          ctx.fillStyle = "#94a3b8";
          ctx.fillRect(18, 33, 6, 12); // Amortisör
          ctx.fillStyle = "#64748b";
          ctx.fillRect(10, 45, 22, 5); // Ayaklar
          ctx.beginPath();
          ctx.arc(10, 52, 4, 0, Math.PI * 2);
          ctx.fill(); // Teker 1
          ctx.beginPath();
          ctx.arc(32, 52, 4, 0, Math.PI * 2);
          ctx.fill(); // Teker 2
        } else if (obs.type === "ROBOT_ARM") {
          ctx.fillStyle = "#475569";
          ctx.beginPath();
          ctx.roundRect(4, 44, 24, 18, 4);
          ctx.fill();
          ctx.fillStyle = "#f59e0b";
          ctx.beginPath();
          ctx.roundRect(18, 28, 38, 14, 5);
          ctx.fill();
          ctx.save();
          ctx.translate(50, 28);
          ctx.rotate(-0.55);
          ctx.beginPath();
          ctx.roundRect(0, 0, 34, 12, 4);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = "#111827";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(22, 37, 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(68, 10);
          ctx.lineTo(68, 28);
          ctx.stroke();
          ctx.fillStyle = "#ef4444";
          ctx.fillRect(62, 8, 12, 6);
        } else if (obs.type === "PALLET_STACK") {
          ctx.fillStyle = "#92400e";
          ctx.fillRect(0, obs.height - 10, obs.width, 10);
          ctx.fillStyle = "#78350f";
          for (let j = 0; j < 3; j++) {
            ctx.fillRect(6 + j * 22, obs.height - 22, 12, 12);
          }
          const boxColors = ["#f59e0b", "#d97706", "#fbbf24"];
          for (let j = 0; j < 3; j++) {
            ctx.fillStyle = boxColors[j];
            ctx.beginPath();
            ctx.roundRect(6 + j * 20, 8 + (j % 2) * 6, 18, 26, 3);
            ctx.fill();
            ctx.strokeStyle = "rgba(120, 53, 15, 0.5)";
            ctx.strokeRect(6 + j * 20, 8 + (j % 2) * 6, 18, 26);
          }
        } else if (obs.type === "BOX_STACK") {
          const boxes = [
            { x: 4, y: 42, w: 26, h: 28, c: "#d97706" },
            { x: 28, y: 36, w: 28, h: 34, c: "#f59e0b" },
            { x: 14, y: 10, w: 30, h: 28, c: "#fbbf24" },
          ];
          boxes.forEach((box) => {
            ctx.fillStyle = box.c;
            ctx.beginPath();
            ctx.roundRect(box.x, box.y, box.w, box.h, 3);
            ctx.fill();
            ctx.strokeStyle = "rgba(120, 53, 15, 0.45)";
            ctx.strokeRect(box.x + 5, box.y + 5, box.w - 10, 2);
          });
        } else if (obs.type === "DESK") {
          ctx.fillStyle = "#78350f";
          ctx.beginPath();
          ctx.roundRect(0, 18, obs.width, 12, 4);
          ctx.fill();
          ctx.fillStyle = "#451a03";
          ctx.fillRect(8, 30, 8, 24);
          ctx.fillRect(obs.width - 16, 30, 8, 24);
          ctx.fillStyle = "#0f172a";
          ctx.beginPath();
          ctx.roundRect(28, 0, 26, 18, 3);
          ctx.fill();
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(31, 3, 20, 11);
          ctx.fillStyle = "#64748b";
          ctx.fillRect(38, 18, 6, 8);
        } else if (obs.type === "SNOW_BARRIER") {
          ctx.fillStyle = "#e2e8f0";
          ctx.beginPath();
          ctx.roundRect(0, 18, obs.width, 22, 8);
          ctx.fill();
          ctx.fillStyle = "#ef4444";
          for (let j = 0; j < 4; j++) {
            ctx.save();
            ctx.translate(10 + j * 18, 20);
            ctx.rotate(-0.55);
            ctx.fillRect(0, 0, 8, 28);
            ctx.restore();
          }
          ctx.fillStyle = "#94a3b8";
          ctx.fillRect(8, 40, obs.width - 16, 6);
        } else if (obs.type === "SNOW_PILE") {
          ctx.fillStyle = "#f8fafc";
          ctx.beginPath();
          ctx.arc(16, 30, 16, Math.PI, 0);
          ctx.arc(36, 24, 22, Math.PI, 0);
          ctx.arc(58, 31, 14, Math.PI, 0);
          ctx.lineTo(obs.width, obs.height);
          ctx.lineTo(0, obs.height);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(59, 130, 246, 0.18)";
          ctx.fillRect(14, 32, 42, 3);
        } else if (obs.type === "PIPE") {
          // Endüstriyel Boru
          const pGrad = ctx.createLinearGradient(0, 0, 0, obs.height);
          pGrad.addColorStop(0, "#94a3b8");
          pGrad.addColorStop(0.5, "#f1f5f9");
          pGrad.addColorStop(1, "#475569");
          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.roundRect(0, 0, obs.width, obs.height, 5);
          ctx.fill();
          // Bağlantı noktaları
          ctx.fillStyle = "#334155";
          ctx.fillRect(5, -5, 10, obs.height + 10);
          ctx.fillRect(obs.width - 15, -5, 10, obs.height + 10);
          // Tehlike çizgileri
          ctx.fillStyle = "#eab308";
          for (let j = 0; j < 3; j++) {
            ctx.save();
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(15 + j * 20, -10, 8, 40);
            ctx.restore();
          }
        } else if (obs.type === "WARNING_SIGN") {
          ctx.fillStyle = "#334155";
          ctx.fillRect(obs.width / 2 - 3, 32, 6, obs.height - 32);
          ctx.fillStyle = "#facc15";
          ctx.beginPath();
          ctx.moveTo(obs.width / 2, 0);
          ctx.lineTo(obs.width - 8, 52);
          ctx.lineTo(8, 52);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#111827";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = "#111827";
          ctx.fillRect(obs.width / 2 - 3, 16, 6, 18);
          ctx.fillRect(obs.width / 2 - 3, 39, 6, 6);
        } else if (obs.type === "BIN") {
          // Fire Sepeti
          ctx.fillStyle = "#1e293b";
          ctx.beginPath();
          ctx.roundRect(0, 0, obs.width, obs.height, 3);
          ctx.fill();
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2;
          for (let j = 0; j < 3; j++) {
            ctx.strokeRect(5 + j * 15, 5, 10, obs.height - 10);
          } // Izgaralar
          // İçindeki metal hurdalar
          ctx.fillStyle = "#94a3b8";
          ctx.beginPath();
          ctx.moveTo(10, 5);
          ctx.lineTo(obs.width - 10, 5);
          ctx.lineTo(obs.width / 2, -10);
          ctx.fill();
        } else {
          // Emniyet Dubası
          ctx.fillStyle = "#f97316";
          ctx.beginPath();
          ctx.moveTo(0, obs.height);
          ctx.lineTo(obs.width, obs.height);
          ctx.lineTo(obs.width / 2, 0);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillRect(obs.width / 2 - 5, obs.height / 2, 10, 8);
        }
        ctx.restore();

        if (obs.x + obs.width < 0) {
          obstaclesRef.current.splice(index, 1);
          addScore(10);
        }
      });

      // --- 6. ÖĞELER (DETAYLI) ---
      if (frameRef.current >= nextItemFrameRef.current) {
        const rand = Math.random();
        let type: "COFFEE" | "ORDER" | "MAGNET" = "ORDER";
        if (rand > 0.95) type = "MAGNET";
        else if (rand > 0.85) type = "COFFEE";
        const width = 35;
        const height = 35;
        const x = canvas.width + 40;
        const y = findSafeItemY(x, width, height);

        if (y !== undefined) {
          itemsRef.current.push({
            x,
            y,
            width,
            height,
            type,
          });

          const itemGapPx = 470 + Math.random() * 250;
          nextItemFrameRef.current =
            frameRef.current + Math.floor(itemGapPx / currentSpeed);
        } else {
          nextItemFrameRef.current = frameRef.current + 12;
        }
      }

      itemsRef.current.forEach((item, index) => {
        // Mıknatıs Çekim Mantığı
        if (magnetPowerRef.current > 0) {
          const dx = 50 - item.x;
          const dy = player.y - item.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 300) {
            item.x += dx * 0.1;
            item.y += dy * 0.1;
          }
        }

        item.x -= currentSpeed;
        const bounce = Math.sin(frameRef.current * 0.1) * 8;
        if (
          item.x < 50 + PLAYER_WIDTH &&
          item.x + item.width > 50 &&
          player.y < item.y + item.height &&
          player.y + currentH > item.y
        ) {
          playSound("collect");
          if (item.type === "ORDER") {
            collectOrder(item.x, item.y);
            createParticles(item.x, item.y, "#fbbf24", 15);
          } else if (item.type === "COFFEE") {
            molaPowerRef.current = 360;
            setMolaPowerDisplay(6);
            createParticles(item.x, item.y, "#ffffff", 15);
          } else {
            magnetPowerRef.current = 480; // 8 saniye (60fps * 8)
            setMagnetPowerDisplay(8);
            createParticles(item.x, item.y, "#a855f7", 20);
          }
          itemsRef.current.splice(index, 1);
          return;
        }

        ctx.save();
        ctx.translate(item.x, item.y + bounce);
        if (item.type === "ORDER") {
          const boostImage = boostItemImageRef.current;
          if (boostImage?.complete && boostImage.naturalWidth > 0) {
            ctx.shadowBlur = 14;
            ctx.shadowColor = "#7dd3fc";
            ctx.drawImage(boostImage, 3, -5, 29, 42);
            ctx.shadowBlur = 0;
          } else {
            ctx.fillStyle = "#facc15";
            ctx.beginPath();
            ctx.roundRect(0, 0, 25, 32, 2);
            ctx.fill();
            ctx.fillStyle = "#a16207";
            ctx.fillRect(5, 5, 15, 2);
            ctx.fillRect(5, 12, 15, 2);
            ctx.fillRect(5, 19, 10, 2);
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#facc15";
            ctx.strokeStyle = "#fff";
            ctx.strokeRect(-2, -2, 29, 36);
          }
        } else if (item.type === "COFFEE") {
          const bonusImage = bonusItemImageRef.current;
          if (bonusImage?.complete && bonusImage.naturalWidth > 0) {
            ctx.shadowBlur = 14;
            ctx.shadowColor = "#fde68a";
            ctx.drawImage(bonusImage, 2, -4, 31, 41);
            ctx.shadowBlur = 0;
          } else {
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.moveTo(5, 0);
            ctx.lineTo(20, 0);
            ctx.lineTo(18, 30);
            ctx.lineTo(7, 30);
            ctx.fill();
            ctx.fillStyle = "#166534";
            ctx.fillRect(6, 10, 13, 10);
            ctx.fillStyle = "#451a03";
            ctx.fillRect(4, -2, 17, 4);
          }
        } else {
          const magnetImage = magnetItemImageRef.current;
          if (magnetImage?.complete && magnetImage.naturalWidth > 0) {
            const glowPulse = 0.55 + Math.sin(frameRef.current * 0.18) * 0.2;
            const glow = ctx.createRadialGradient(17.5, 17, 4, 17.5, 17, 28);
            glow.addColorStop(0, `rgba(251, 146, 60, ${glowPulse})`);
            glow.addColorStop(0.45, "rgba(239, 68, 68, 0.36)");
            glow.addColorStop(1, "rgba(239, 68, 68, 0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(17.5, 17, 28, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 18;
            ctx.shadowColor = "#fb923c";
            ctx.drawImage(magnetImage, 1, -3, 33, 40);
            ctx.shadowBlur = 0;
          } else {
            // Mıknatıs Çizimi (U-Shape)
            ctx.fillStyle = "#ef4444";
            ctx.beginPath();
            ctx.arc(15, 15, 12, Math.PI, 0);
            ctx.lineTo(27, 30);
            ctx.lineTo(20, 30);
            ctx.lineTo(20, 15);
            ctx.arc(15, 15, 5, 0, Math.PI, true);
            ctx.lineTo(10, 30);
            ctx.lineTo(3, 30);
            ctx.closePath();
            ctx.fill();
            // Uçlar (Gümüş)
            ctx.fillStyle = "#cbd5e1";
            ctx.fillRect(3, 25, 7, 5);
            ctx.fillRect(20, 25, 7, 5);
          }
        }
        ctx.restore();
        if (item.x + item.width < 0) {
          if (item.type === "ORDER") {
            resetCombo();
          }
          itemsRef.current.splice(index, 1);
        }
      });

      // --- 7. ZEMİN ---
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(canvas.width, GROUND_Y);
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const lineX =
          ((scrollOffset * 1.5 + i * 80) % (canvas.width + 80)) - 80;
        ctx.fillRect(canvas.width - lineX, GROUND_Y + 4, 30, 2);
      }
    } finally {
      ctx.restore(); // Her durumda context'i geri yükle
    }

    if (gameStateRef.current === "PLAYING") {
      frameRef.current++;
      gameLoopRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    playerOperatorIdRef.current = operatorId || sessionId;
  }, [operatorId, sessionId]);

  useEffect(() => {
    isStartingGameRef.current = isStartingGame;
  }, [isStartingGame]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    (Object.entries(LOCATION_BACKGROUNDS) as [LocationName, string][]).forEach(
      ([locationName, source]) => {
        const image = new Image();
        image.src = source;
        image.onload = () => {
          backgroundImagesRef.current[locationName] = image;
        };
      }
    );

    (Object.entries(OBSTACLE_ASSETS) as [ObstacleAssetKey, string][]).forEach(
      ([assetKey, source]) => {
        const image = new Image();
        image.src = source;
        image.onload = async () => {
          try {
            obstacleImagesRef.current[assetKey] =
              typeof createImageBitmap === "function"
                ? await createImageBitmap(image)
                : image;
          } catch {
            obstacleImagesRef.current[assetKey] = image;
          }
        };
      }
    );

    const bonusImage = new Image();
    bonusImage.src = bonusItem;
    bonusImage.onload = () => {
      bonusItemImageRef.current = bonusImage;
    };

    const boostImage = new Image();
    boostImage.src = boostItem;
    boostImage.onload = () => {
      boostItemImageRef.current = boostImage;
    };

    const magnetImage = new Image();
    magnetImage.src = magnetItem;
    magnetImage.onload = () => {
      magnetItemImageRef.current = magnetImage;
    };
  }, []);

  useEffect(() => {
    if (
      gameState === "PLAYING" &&
      highScore > 0 &&
      score > highScore &&
      !newRecordShownRef.current
    ) {
      newRecordShownRef.current = true;
      showNewRecordBanner();
    }
  }, [gameState, score, highScore]);

  useEffect(() => {
    const isTypingInField = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInField(e.target)) return;

      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (e.repeat) return;
        jump();
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        if (gameStateRef.current === "PLAYING") {
          playerRef.current.isDucking = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isTypingInField(e.target)) return;

      if (e.code === "Space" || e.code === "ArrowUp") {
        releaseJump();
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        playerRef.current.isDucking = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(gameLoopRef.current);
      if (countdownTimerRef.current) {
        window.clearTimeout(countdownTimerRef.current);
      }
      if (locationBannerTimerRef.current) {
        window.clearTimeout(locationBannerTimerRef.current);
      }
      if (newRecordTimerRef.current) {
        window.clearTimeout(newRecordTimerRef.current);
      }
      if (controlsHintTimerRef.current) {
        window.clearTimeout(controlsHintTimerRef.current);
      }
      audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await apiClient.get("/game/leaderboard");
      if (res.data?.success) setLeaderboard(res.data.data);
    } catch (err) {
      console.error("Leaderboard error:", err);
    }
  };

  const handleIdentify = async () => {
    const idToSearch = operatorId || sessionId;
    if (!idToSearch) return;

    setIsIdentifying(true);
    try {
      const res = await apiClient.get(`/game/identify/${idToSearch}`);
      if (res.data?.success) {
        setOperatorName(res.data.operatorName);
        if (res.data.exists) {
          setNickname(res.data.profile.nickname);
          setHighScore(res.data.profile.best_score || 0);
          setGameState("START");
          gameStateRef.current = "START";
        } else {
          setGameState("REGISTER");
          gameStateRef.current = "REGISTER";
        }
        localStorage.setItem("shiftRunner_sessionId", idToSearch);
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Yolcu kodu sorgulanırken hata oluştu.",
      );
    } finally {
      setIsIdentifying(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!nickname) return;
    setIsSaving(true);
    try {
      const res = await apiClient.post("/game/profile", {
        operator_id: operatorId || sessionId,
        nickname,
      });
      if (res.data?.success) {
        setHighScore(0);
        setGameState("START");
        gameStateRef.current = "START";
        fetchLeaderboard(); // Listeyi hemen tazele
        toast.success(`Profilin oluşturuldu, hoş geldin ${nickname}!`);
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Profil oluşturulurken hata oluştu.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const savedId = localStorage.getItem("shiftRunner_sessionId");
    if (operatorId) {
      handleIdentify();
    } else if (savedId) {
      setSessionId(savedId);
      // handleIdentify(); // Otomatik identify yapabiliriz ama kullanıcı görsün diye butona bırakalım
    }
    fetchLeaderboard();
  }, [operatorId]);

  const saveScoreToDB = async () => {
    if (isSaving || hasSaved) return;
    const finalScore = scoreRef.current || score;
    const gameSessionId = gameSessionIdRef.current;
    const finishToken = gameSessionTokenRef.current;

    if (!gameSessionId || !finishToken) {
      toast.error("Oyun oturumu bulunamadı. Skor kaydedilemedi.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiClient.post(
        `/game/session/${gameSessionId}/finish`,
        {
          score: finalScore,
          locationReached: locationRef.current,
          finishToken,
        },
      );
      if (res.data?.success) {
        setHasSaved(true);
        gameSessionIdRef.current = "";
        gameSessionTokenRef.current = "";
        if (res.data.isNewRecord) {
          setHighScore(finalScore);
        }
        fetchLeaderboard(); // Listeyi tazele
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Skor kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  // Oyun bittiğinde eğer yeni rekor ise otomatik kaydet
  useEffect(() => {
    if (gameState === "GAMEOVER") {
      const finalScore = scoreRef.current || score;
      if (gameSessionIdRef.current && finalScore > 0) {
        saveScoreToDB();
      }
    }
    if (gameState === "START") {
      setHasSaved(false);
    }
  }, [gameState, score, highScore, operatorId, sessionId]);

  return (
    <div className="fixed inset-0 z-300 bg-background/95 backdrop-blur-md flex flex-col items-center justify-start xl:justify-center p-2 md:p-4 overflow-y-auto">
      <div className="relative bg-card border-4 border-primary rounded-2xl p-4 md:p-6 shadow-2xl max-w-[1380px] w-full flex flex-col items-center">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full mb-4">
          <div className="flex flex-col">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-primary italic">
              Kozmik Koşu
            </h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.3em]">
              Uzay Yolcusu
            </p>
          </div>
          <div className="flex gap-3 items-center justify-between sm:justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-muted/40 text-muted-foreground transition-colors hover:text-primary"
              title={isMuted ? "Sesi aç" : "Sesi kapat"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            {comboDisplay >= 2 && (
              <div className="flex items-center gap-2 bg-amber-500/15 px-3 py-1.5 rounded-xl border border-amber-500/30 animate-pulse">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                  Combo
                </span>
                <span className="text-xs font-black text-amber-500 font-mono">
                  x{Math.min(1 + Math.floor((comboDisplay - 1) / 3), 4)}
                </span>
              </div>
            )}
            {magnetPowerDisplay > 0 && (
              <div className="flex items-center gap-2 bg-purple-500/20 px-3 py-1.5 rounded-xl border border-purple-500/30 animate-pulse">
                <Magnet size={16} className="text-purple-400" />
                <span className="text-xs font-black text-purple-400 font-mono">
                  {magnetPowerDisplay}s
                </span>
              </div>
            )}
            {molaPowerDisplay > 0 && (
              <div className="flex items-center gap-2 bg-primary/20 px-3 py-1.5 rounded-xl border border-primary/30 animate-pulse">
                <div className="text-primary text-[10px] font-black">EN</div>
                <span className="text-xs font-black text-primary font-mono">
                  {molaPowerDisplay}s
                </span>
              </div>
            )}
            <div className="flex flex-col items-end">
              <span className="text-3xl font-mono font-black text-foreground tabular-nums">
                {score.toString().padStart(5, "0")}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                En Yüksek: {highScore.toString().padStart(5, "0")}
              </span>
            </div>
          </div>
        </div>

        <div
          className="relative w-full aspect-[60/19] min-h-[280px] bg-secondary/20 rounded-xl border-2 border-border overflow-hidden cursor-pointer"
          onClick={jump}
        >
          <canvas
            ref={canvasRef}
            width={1200}
            height={380}
            className="w-full h-full"
          />
          {/* 1. ADIM: SİCİL NO SORGULAMA */}
          {gameState === "IDENTIFY" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-xs p-6 text-center">
              <UserIcon size={48} className="text-primary mb-4" />
              <h2 className="text-2xl font-black uppercase text-foreground mb-2">
                Kimsin?
              </h2>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-6 tracking-widest">
                Görev kaydı için yolcu kodunu gir
              </p>

              <div
                className="flex gap-2 w-full max-w-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleIdentify()}
                  placeholder="Yolcu Kodu / ID..."
                  className="flex-1 bg-background border-2 border-border px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIdentify();
                  }}
                  disabled={!sessionId || isIdentifying}
                  className="bg-primary text-primary-foreground px-4 rounded-xl disabled:opacity-50"
                >
                  {isIdentifying ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 2. ADIM: LAKAP SEÇİMİ (YENİ PROFİL) */}
          {gameState === "REGISTER" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-xs p-6 text-center animate-in fade-in zoom-in duration-300">
              <Trophy size={48} className="text-amber-500 mb-4" />
              <h2 className="text-2xl font-black uppercase text-foreground mb-2">
                Hoş geldin {operatorName}!
              </h2>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-6 tracking-widest">
                Galaksi listesinde görünecek çağrı adını seç
              </p>

              <div
                className="flex flex-col gap-3 w-full max-w-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Çağrı Adı / Pilot Tag..."
                  maxLength={15}
                  className="w-full bg-background border-2 border-border px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:border-primary text-center"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateProfile();
                  }}
                  disabled={!nickname || isSaving}
                  className="bg-primary text-primary-foreground font-black py-3 rounded-xl uppercase hover:scale-105 transition-all disabled:opacity-50"
                >
                  Yolcu Profilimi Oluştur
                </button>
              </div>
            </div>
          )}

          {/* 3. ADIM: HAZIRLIK EKRANI */}
          {gameState === "START" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-[2px] text-center">
              <div className="mb-6 scale-110">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-1">
                  Yolcu Hazır
                </p>
                <h2 className="text-3xl font-black uppercase text-foreground italic">
                  {nickname}
                </h2>
                {highScore > 0 && (
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    Kişisel Rekor: {highScore}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  beginCountdown();
                }}
                disabled={isStartingGame}
                className="bg-primary text-primary-foreground font-black px-12 py-4 rounded-xl uppercase hover:scale-105 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isStartingGame ? "Fırlatma hazırlanıyor..." : "Yolculuğa Başla"}
              </button>
              <div className="mt-6 flex flex-wrap justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <span>Zıpla: BOŞLUK / TIKLA</span>
                <span className="hidden sm:inline text-border">|</span>
                <span>Eğil: S / ↓</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  localStorage.removeItem("shiftRunner_sessionId");
                  setSessionId("");
                  setGameState("IDENTIFY");
                  gameStateRef.current = "IDENTIFY";
                }}
                className="mt-8 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors underline"
              >
                Bu ben değilim (Çıkış Yap)
              </button>
            </div>
          )}

          {gameState === "COUNTDOWN" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/45 backdrop-blur-[2px] text-center pointer-events-none">
              <div className="text-[10px] font-black uppercase tracking-[0.45em] text-primary mb-4">
                Fırlatmaya Hazırlan
              </div>
              <div className="min-w-40 rounded-2xl border-4 border-primary bg-background/80 px-10 py-6 shadow-2xl">
                <div className="font-mono text-7xl md:text-8xl font-black text-primary tabular-nums leading-none animate-in zoom-in duration-200">
                  {countdown}
                </div>
              </div>
            </div>
          )}

          {gameState === "PLAYING" && locationBanner && (
            <div className="absolute inset-x-0 top-8 flex justify-center pointer-events-none animate-in fade-in zoom-in-95 duration-300">
              <div className="border-2 border-primary bg-background/85 px-8 py-4 shadow-2xl backdrop-blur-sm">
                <div className="text-[10px] font-black uppercase tracking-[0.45em] text-primary mb-1">
                  Rota Değişimi
                </div>
                <div className="text-2xl md:text-4xl font-black uppercase italic tracking-tight text-foreground">
                  {locationBanner}
                </div>
              </div>
            </div>
          )}

          {gameState === "PLAYING" && showControlsHint && (
            <div className="absolute inset-x-0 bottom-8 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-wrap items-center justify-center gap-3 border-2 border-border bg-background/85 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-foreground shadow-2xl backdrop-blur-sm">
                <span className="text-primary">Zıpla</span>
                <span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-primary">
                  Space
                </span>
                <span className="text-muted-foreground">veya</span>
                <span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-primary">
                  Tıkla
                </span>
                <span className="mx-1 h-4 w-px bg-border" />
                <span className="text-primary">Eğil</span>
                <span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-primary">
                  S
                </span>
                <span className="text-muted-foreground">veya</span>
                <span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-primary">
                  ↓
                </span>
              </div>
            </div>
          )}

          {gameState === "PLAYING" && newRecordBanner && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in-95 duration-300">
              <div className="border-2 border-amber-400 bg-background/85 px-6 py-4 text-center shadow-xl shadow-amber-500/15 backdrop-blur-sm">
                <div className="text-[9px] font-black uppercase tracking-[0.35em] text-amber-500 mb-1">
                  Kişisel
                </div>
                <div className="text-2xl md:text-4xl font-black uppercase italic tracking-tight text-amber-500">
                  Yeni Rekor!
                </div>
                <div className="mt-1 font-mono text-sm font-black text-foreground">
                  {score.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {gameState === "GAMEOVER" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[6px] p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-4xl font-black uppercase text-destructive italic mb-2">
                Görev Tamamlandı!
              </h2>
              <div className="text-3xl font-mono font-bold text-white mb-5">
                Skor: {score.toLocaleString()}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full max-w-2xl mb-7">
                <div className="bg-background/15 border border-white/10 p-3">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
                    Süre
                  </div>
                  <div className="mt-1 font-mono text-lg font-black text-white">
                    {Math.floor(runStats.durationSeconds / 60)}:
                    {(runStats.durationSeconds % 60)
                      .toString()
                      .padStart(2, "0")}
                  </div>
                </div>
                <div className="bg-background/15 border border-white/10 p-3">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
                    Veri Çekirdeği
                  </div>
                  <div className="mt-1 font-mono text-lg font-black text-amber-300">
                    {runStats.ordersCollected}
                  </div>
                </div>
                <div className="bg-background/15 border border-white/10 p-3">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
                    En İyi Combo
                  </div>
                  <div className="mt-1 font-mono text-lg font-black text-amber-300">
                    x{Math.min(1 + Math.floor((runStats.bestCombo - 1) / 3), 4)}
                  </div>
                </div>
                <div className="bg-background/15 border border-white/10 p-3">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
                    Rota
                  </div>
                  <div className="mt-1 text-xs font-black uppercase text-white truncate">
                    {LOCATION_LABELS[runStats.finalLocation]}
                  </div>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  beginCountdown();
                }}
                disabled={isStartingGame}
                className="bg-primary text-primary-foreground font-black px-12 py-4 rounded-xl uppercase hover:scale-105 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isStartingGame ? "Hazırlanıyor..." : "Tekrar Dene"}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 w-full mt-4 border-t border-border pt-4">
          {/* Liderlik Tablosu */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                <h3 className="text-xs font-black uppercase tracking-widest">
                  En İyi 10 Yolcu
                </h3>
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase">
                Skor
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
              {leaderboard.length > 0 ? (
                leaderboard.slice(0, 10).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center gap-3 text-[11px] font-bold bg-background/60 p-2.5 rounded-lg border border-border/30 min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="grid place-items-center text-primary bg-primary/10 rounded-md w-6 h-6 shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{item.player_name}</span>
                    </div>
                    <span className="font-mono text-primary shrink-0">
                      {item.score.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="sm:col-span-2 xl:col-span-5 text-[10px] text-center py-4 text-muted-foreground uppercase italic">
                  Henüz skor yok. İlk rotayı sen aç!
                </div>
              )}
            </div>
          </div>

          {/* Bilgi ve Kapatma */}
          <div className="flex flex-col justify-between bg-muted/20 rounded-xl p-4 border border-border/50">
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-primary/5 p-3 rounded-xl border border-primary/10">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <UserIcon size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Aktif Yolcu
                  </p>
                  <p className="text-sm font-bold text-primary">
                    {nickname || operatorName || "Giriş Bekleniyor"}
                  </p>
                </div>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground font-medium uppercase italic">
                Uzay Yolcusu, galaktik rotalarda veri çekirdekleri toplayan
                refleks tabanlı bir keşif oyunudur. Skorlar veritabanına
                kaydedilir ve galaksi liderleri ilan edilir.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-6 w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-black uppercase tracking-[0.2em] text-xs py-3 rounded-xl transition-colors border border-border"
            >
              Kapat ve Geri Dön
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftRunner;
