import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const MAX_PLAYERS = 5;
const START_STEP = 8;
const RACE_STEP = 3.2;

const colors = ["#e24a4a", "#2f80ed", "#20a67a", "#f2b705", "#8a5cf6"];

const freshGame = () => ({
  phase: "lobby",
  countdown: null,
  winnerId: null,
  players: [],
  countdownTimer: null
});

let game = freshGame();

app.disable("x-powered-by");

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, phase: game.phase, players: game.players.length });
});

app.use(
  express.static(path.join(__dirname, "public"), {
    extensions: ["html"],
    maxAge: "5m"
  })
);

app.get("/qr.svg", async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url : "";
  if (!url) {
    res.status(400).send("missing url");
    return;
  }

  res.type("image/svg+xml");
  res.send(
    await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      width: 320,
      color: { dark: "#111827", light: "#ffffff" }
    })
  );
});

app.get(["/join", "/join/"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "join.html"));
});

app.get("/api/state", (_req, res) => {
  res.json(publicState());
});

const publicState = () => ({
  phase: game.phase,
  countdown: game.countdown,
  winnerId: game.winnerId,
  maxPlayers: MAX_PLAYERS,
  players: game.players.map((player) => ({
    id: player.id,
    name: player.name,
    lane: player.lane,
    color: player.color,
    ready: player.ready,
    approach: player.approach,
    distance: player.distance,
    connected: player.connected
  }))
});

const emitState = () => {
  io.emit("state", publicState());
};

const getPlayer = (socket) => game.players.find((player) => player.id === socket.data.playerId);

const allRidersAtStart = () =>
  game.players.length === MAX_PLAYERS &&
  game.players.every((player) => player.ready && player.approach >= 100);

const beginCountdown = () => {
  if (game.phase !== "staging" || !allRidersAtStart()) return;

  game.phase = "countdown";
  game.countdown = 5;
  emitState();

  game.countdownTimer = setInterval(() => {
    if (game.countdown > 1) {
      game.countdown -= 1;
    } else if (game.countdown === 1) {
      game.countdown = "スタート！";
    } else {
      clearInterval(game.countdownTimer);
      game.countdownTimer = null;
      game.phase = "racing";
      game.countdown = null;
    }
    emitState();
  }, 1000);
};

const resetGame = () => {
  if (game.countdownTimer) clearInterval(game.countdownTimer);
  game = freshGame();
  emitState();
};

io.on("connection", (socket) => {
  socket.emit("state", publicState());

  socket.on("join", (name, reply) => {
    const cleanName = String(name || "")
      .trim()
      .replace(/\s+/g, "")
      .slice(0, 4);

    if (!cleanName) {
      reply?.({ ok: false, message: "名前を入力してください" });
      return;
    }

    if (!["lobby", "staging"].includes(game.phase)) {
      reply?.({ ok: false, message: "レース中です。次の回をお待ちください" });
      return;
    }

    if (game.players.length >= MAX_PLAYERS) {
      reply?.({ ok: false, message: "参加枠がいっぱいです" });
      return;
    }

    const player = {
      id: socket.id,
      name: cleanName,
      lane: game.players.length,
      color: colors[game.players.length],
      ready: true,
      approach: 0,
      distance: 0,
      lastButton: null,
      connected: true
    };

    socket.data.playerId = player.id;
    game.players.push(player);
    if (game.phase === "lobby") game.phase = "staging";

    reply?.({ ok: true, playerId: player.id, lane: player.lane });
    emitState();
  });

  socket.on("pedal", (button) => {
    const player = getPlayer(socket);
    if (!player || !["left", "right"].includes(button)) return;
    if (player.lastButton === button) return;

    player.lastButton = button;

    if (game.phase === "staging") {
      player.approach = Math.min(100, player.approach + START_STEP);
      emitState();
      beginCountdown();
      return;
    }

    if (game.phase === "racing") {
      player.distance = Math.min(100, player.distance + RACE_STEP);
      if (player.distance >= 100 && !game.winnerId) {
        game.winnerId = player.id;
        game.phase = "finished";
      }
      emitState();
    }
  });

  socket.on("reset", () => resetGame());

  socket.on("disconnect", () => {
    const player = getPlayer(socket);
    if (player) {
      player.connected = false;
      emitState();
    }
  });
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

server.listen(PORT, HOST, () => {
  console.log(`Bike race running on http://${HOST}:${PORT}`);
});
