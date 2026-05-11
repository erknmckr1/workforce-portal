import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import apiClient from "../../lib/api";
import { Trophy, User as UserIcon, ChevronRight } from "lucide-react";

interface ShiftRunnerProps {
  onClose: () => void;
  operatorId?: string;
}

const ShiftRunner: React.FC<ShiftRunnerProps> = ({ onClose, operatorId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<
    "IDENTIFY" | "REGISTER" | "START" | "PLAYING" | "GAMEOVER"
  >("IDENTIFY");
  const gameStateRef = useRef<
    "IDENTIFY" | "REGISTER" | "START" | "PLAYING" | "GAMEOVER"
  >("IDENTIFY");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [operatorName, setOperatorName] = useState<string>("");
  const [nickname, setNickname] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [molaPowerDisplay, setMolaPowerDisplay] = useState(0);

  const GRAVITY = 0.6;
  const JUMP_FORCE = -12;
  const GROUND_Y = 250;
  const PLAYER_WIDTH = 40;
  const PLAYER_HEIGHT = 60;

  const playerRef = useRef({
    y: GROUND_Y - PLAYER_HEIGHT,
    dy: 0,
    isJumping: false,
    isDucking: false,
  });

  const obstaclesRef = useRef<any[]>([]);
  const itemsRef = useRef<any[]>([]);
  const particlesRef = useRef<any[]>([]); // Yeni: Toz ve parıltı efektleri
  const molaPowerRef = useRef(0);
  const magnetPowerRef = useRef(0);
  const [magnetPowerDisplay, setMagnetPowerDisplay] = useState(0);
  const frameRef = useRef<number>(0);
  const gameLoopRef = useRef<number>(0);
  const locationRef = useRef<string>("PRODUCTION");
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

  const startGame = () => {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameStateRef.current = "PLAYING";
    setGameState("PLAYING");
    setScore(0);
    setMolaPowerDisplay(0);
    setMagnetPowerDisplay(0);
    setHasSaved(false); // Kayıt durumunu her yeni oyunda sıfırla
    molaPowerRef.current = 0;
    magnetPowerRef.current = 0;
    obstaclesRef.current = [];
    itemsRef.current = [];
    particlesRef.current = [];
    trailRef.current = [];
    shakeRef.current = 0;
    playerRef.current = {
      y: GROUND_Y - PLAYER_HEIGHT,
      dy: 0,
      isJumping: false,
      isDucking: false,
    };
    frameRef.current = 0;
    locationRef.current = "PRODUCTION";
    setLocation("PRODUCTION");
    animate();
  };

  const jump = () => {
    if (
      gameStateRef.current === "PLAYING" &&
      !playerRef.current.isJumping &&
      !playerRef.current.isDucking
    ) {
      playerRef.current.dy = JUMP_FORCE;
      playerRef.current.isJumping = true;
      createParticles(70, GROUND_Y, "#ffffff", 10); // Kalkış tozu
    } else if (gameStateRef.current !== "PLAYING") {
      startGame();
    }
  };

  const [location, setLocation] = useState<
    "PRODUCTION" | "WAREHOUSE" | "OFFICE" | "SNOWY"
  >("PRODUCTION");

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
      const themes: ("PRODUCTION" | "WAREHOUSE" | "OFFICE" | "SNOWY")[] = [
        "PRODUCTION",
        "WAREHOUSE",
        "OFFICE",
        "SNOWY",
      ];
      const themeIndex = Math.floor((score % 3000) / 750); // Her tema 750 puan
      const currentLocation = themes[themeIndex];

      if (currentLocation !== locationRef.current) {
        locationRef.current = currentLocation;
        setLocation(currentLocation);
        const labels: Record<string, string> = {
          PRODUCTION: "ÜRETİM BANDI",
          WAREHOUSE: "SEVKİYAT DEPOSU",
          OFFICE: "YÖNETİM OFİSİ",
          SNOWY: "KARLI DIŞ MEKAN",
        };
        toast.info(`VARDİYA DEĞİŞİMİ: ${labels[currentLocation]}`, {
          duration: 2000,
        });
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
    if (locationRef.current === "PRODUCTION") {
      // Fabrika Silüeti
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      for (let i = 0; i < 5; i++) {
        const x = ((scrollOffset * 0.1 + i * 250) % (canvas.width + 250)) - 250;
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

    // --- 3. OYUNCU FİZİKLERİ VE ÇİZİM ---
    const player = playerRef.current;
    player.dy += GRAVITY;
    player.y += player.dy;

    const currentH = player.isDucking ? PLAYER_HEIGHT / 2 : PLAYER_HEIGHT;
    if (player.y > GROUND_Y - currentH) {
      if (player.isJumping) createParticles(70, GROUND_Y, "#ffffff", 5);
      player.y = GROUND_Y - currentH;
      player.dy = 0;
      player.isJumping = false;
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
      ctx.arc(PLAYER_WIDTH/2, currentH/2, 60, 0, Math.PI * 2);
      ctx.stroke();
      // İç halka
      ctx.beginPath();
      ctx.arc(PLAYER_WIDTH/2, currentH/2, 50 + Math.sin(frameRef.current * 0.2) * 5, 0, Math.PI * 2);
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

    // --- 5. ENGELLER (LOCATION BASED) ---
    if (frameRef.current % 120 === 0) {
      const rand = Math.random();
      let type: "BIN" | "CONE" | "PIPE" | "FORKLIFT" | "CHAIR" = "BIN";

      if (location === "PRODUCTION") {
        if (rand > 0.7) type = "PIPE";
        else if (rand > 0.35) type = "CONE";
        else type = "BIN";
      } else if (location === "WAREHOUSE") {
        type = rand > 0.5 ? "FORKLIFT" : "BIN";
      } else {
        type = rand > 0.5 ? "CHAIR" : "PIPE";
      }

      obstaclesRef.current.push({
        x: canvas.width,
        width: type === "FORKLIFT" ? 80 : type === "CHAIR" ? 40 : 50,
        height: type === "FORKLIFT" ? 60 : type === "CHAIR" ? 50 : 50,
        y: type === "PIPE" ? GROUND_Y - 90 : GROUND_Y,
        type: type,
      });
    }

    obstaclesRef.current.forEach((obs, index) => {
      // HIZ HESAPLAMASI: 3.5'ten başlar ve daha yavaş artar
      const currentSpeed = 3.5 + frameRef.current / 3000;
      obs.x -= currentSpeed;

      const pTop = player.y;
      const pBottom = player.y + currentH;
      const oTop =
        obs.type === "PIPE" ? obs.y - obs.height : GROUND_Y - obs.height;
      const oBottom = obs.type === "PIPE" ? obs.y : GROUND_Y;

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
        createParticles(70, player.y + 30, "#ef4444", 30);
        shakeRef.current = 15; // Çarpınca sarsıl
        cancelAnimationFrame(gameLoopRef.current);
        return;
      }

      // --- ENGEL ÇİZİMLERİ (PREMIUM SPRITES) ---
      ctx.save();
      ctx.translate(obs.x, oTop);

      if (obs.type === "FORKLIFT") {
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
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.roundRect(5, 0, 8, 30, 2);
        ctx.fill(); // Sırtlık
        ctx.fillRect(5, 25, 35, 8); // Oturak
        ctx.fillStyle = "#374151";
        ctx.fillRect(18, 33, 6, 12); // Amortisör
        ctx.fillStyle = "#000";
        ctx.fillRect(10, 45, 22, 5); // Ayaklar
        ctx.beginPath();
        ctx.arc(10, 52, 4, 0, Math.PI * 2);
        ctx.fill(); // Teker 1
        ctx.beginPath();
        ctx.arc(32, 52, 4, 0, Math.PI * 2);
        ctx.fill(); // Teker 2
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
        setScore((s) => s + 10);
      }
    });

    // --- 6. ÖĞELER (DETAYLI) ---
    if (frameRef.current % 220 === 0) {
      const rand = Math.random();
      let type: "COFFEE" | "ORDER" | "MAGNET" = "ORDER";
      if (rand > 0.95) type = "MAGNET";
      else if (rand > 0.85) type = "COFFEE";
      
      itemsRef.current.push({
        x: canvas.width,
        y: GROUND_Y - 100 - Math.random() * 80,
        width: 35,
        height: 35,
        type,
      });
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
        if (item.type === "ORDER") {
          setScore((s) => s + 50);
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
        // Altın Sipariş Evrağı
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
      } else if (item.type === "COFFEE") {
        // Kahve Bardağı (Starbucks stili)
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(20, 0);
        ctx.lineTo(18, 30);
        ctx.lineTo(7, 30);
        ctx.fill();
        ctx.fillStyle = "#166534";
        ctx.fillRect(6, 10, 13, 10); // Yeşil logo bandı
        ctx.fillStyle = "#451a03";
        ctx.fillRect(4, -2, 17, 4); // Kapak
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
      ctx.restore();
      if (item.x + item.width < 0) itemsRef.current.splice(index, 1);
    });

    // --- 7. ZEMİN ---
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const lineX = ((scrollOffset * 1.5 + i * 80) % (canvas.width + 80)) - 80;
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
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
        err.response?.data?.message || "Sicil No sorgulanırken hata oluştu.",
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
    const finalId = operatorId || sessionId;

    setIsSaving(true);
    try {
      const res = await apiClient.post("/game/score", {
        score,
        operator_id: finalId,
        locationReached: locationRef.current,
      });
      if (res.data?.success) {
        setHasSaved(true);
        setHighScore(score); // Rekoru hemen güncelle
        fetchLeaderboard(); // Listeyi tazele
        toast.success("YENİ REKOR! Skorun otomatik kaydedildi.");
      }
    } catch (err) {
      toast.error("Skor kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  // Oyun bittiğinde eğer yeni rekor ise otomatik kaydet
  useEffect(() => {
    if (gameState === "GAMEOVER") {
      const finalId = operatorId || sessionId;
      if (finalId && score > highScore && score > 0) {
        saveScoreToDB();
      }
    }
    if (gameState === "START") {
      setHasSaved(false);
    }
  }, [gameState, score, highScore, operatorId, sessionId]);

  return (
    <div className="fixed inset-0 z-300 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
      <div className="relative bg-card border-4 border-primary rounded-3xl p-8 shadow-2xl max-w-4xl w-full flex flex-col items-center">
        <div className="flex justify-between w-full mb-8">
          <div className="flex flex-col">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-primary italic">
              Runner
            </h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.3em]">
              Koşucu
            </p>
          </div>
          <div className="flex gap-4 items-center">
            {magnetPowerDisplay > 0 && (
              <div className="flex items-center gap-2 bg-purple-500/20 px-3 py-1.5 rounded-xl border border-purple-500/30 animate-pulse">
                <div className="text-purple-400">🧲</div>
                <span className="text-xs font-black text-purple-400 font-mono">
                  {magnetPowerDisplay}s
                </span>
              </div>
            )}
            {molaPowerDisplay > 0 && (
              <div className="flex items-center gap-2 bg-primary/20 px-3 py-1.5 rounded-xl border border-primary/30 animate-pulse">
                <div className="text-primary">☕</div>
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
          className="relative w-full aspect-21/9 bg-secondary/20 rounded-xl border-2 border-border overflow-hidden cursor-pointer"
          onClick={jump}
        >
          <canvas
            ref={canvasRef}
            width={800}
            height={300}
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
                Skorunu kaydetmek için Sicil No gir
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
                  placeholder="Sicil No / ID..."
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
                Liderlik tablosunda görünecek lakabını seç
              </p>

              <div
                className="flex flex-col gap-3 w-full max-w-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Gamer Tag / Lakap..."
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
                  Profilimi Oluştur
                </button>
              </div>
            </div>
          )}

          {/* 3. ADIM: HAZIRLIK EKRANI */}
          {gameState === "START" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-[2px] text-center">
              <div className="mb-6 scale-110">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-1">
                  Kullanıcı Hazır
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
                  startGame();
                }}
                className="bg-primary text-primary-foreground font-black px-12 py-4 rounded-xl uppercase hover:scale-105 transition-all shadow-xl shadow-primary/20"
              >
                Vardiyaya Başla
              </button>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-6 animate-pulse">
                Zıplamak için BOŞLUK veya TIKLA
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  localStorage.removeItem("shiftRunner_sessionId");
                  setSessionId("");
                  setGameState("IDENTIFY");
                }}
                className="mt-8 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors underline"
              >
                Bu ben değilim (Çıkış Yap)
              </button>
            </div>
          )}

          {gameState === "GAMEOVER" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[6px] p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-4xl font-black uppercase text-destructive italic mb-2">
                Vardiya Bitti!
              </h2>
              <div className="text-3xl font-mono font-bold text-white mb-8">
                Skor: {score}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startGame();
                }}
                className="bg-primary text-primary-foreground font-black px-12 py-4 rounded-xl uppercase hover:scale-105 transition-all shadow-xl shadow-primary/20"
              >
                Tekrar Dene
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mt-8 border-t border-border pt-8">
          {/* Liderlik Tablosu */}
          <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={18} className="text-amber-500" />
              <h3 className="text-xs font-black uppercase tracking-widest">
                En İyi 10 Vardiya
              </h3>
            </div>
            <div className="space-y-2">
              {leaderboard.length > 0 ? (
                leaderboard.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-[11px] font-bold bg-background/50 p-2 rounded-lg border border-border/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-primary w-4">{idx + 1}.</span>
                      <span className="truncate max-w-[120px]">
                        {item.player_name}
                      </span>
                    </div>
                    <span className="font-mono text-primary">
                      {item.score.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-center py-4 text-muted-foreground uppercase italic">
                  Henüz skor yok. İlk sen ol!
                </div>
              )}
            </div>
          </div>

          {/* Bilgi ve Kapatma */}
          <div className="flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-primary/5 p-3 rounded-xl border border-primary/10">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <UserIcon size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Aktif Oyuncu
                  </p>
                  <p className="text-sm font-bold text-primary">
                    {nickname || operatorName || "Giriş Bekleniyor"}
                  </p>
                </div>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground font-medium uppercase italic">
                Bu oyun Midas Intranet personeli için özel olarak
                geliştirilmiştir. Skorlar veritabanına kaydedilir ve aylık
                şampiyonlar ilan edilir.
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
