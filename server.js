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
const io = new Server(server, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 120000,
    skipMiddlewares: true
  }
});

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const MAX_PLAYERS = 5;
const START_STEP = 12;
const RACE_STEP = 4.5;

const riders = [
  { color: "#e24a4a", key: "red" },
  { color: "#2f80ed", key: "blue" },
  { color: "#20a67a", key: "green" },
  { color: "#f2b705", key: "yellow" },
  { color: "#111827", key: "black" }
];

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

const sendPage = (res, fileName) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", fileName));
};

app.get("/", (_req, res) => {
  sendPage(res, "index.html");
});

app.get(["/join", "/join/"], (_req, res) => {
  sendPage(res, "join.html");
});

app.use(
  express.static(path.join(__dirname, "public"), {
    extensions: ["html"],
    maxAge: 0,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-cache");
    }
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
    colorKey: player.colorKey,
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

const cleanPlayerId = (value) =>
  String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 48);

const ridersAtStart = () =>
  game.players.length > 0 && game.players.every((player) => player.ready && player.approach >= 100);

const beginCountdown = (force = false) => {
  if (game.phase !== "staging" || game.players.length === 0) return;
  if (!force && game.players.length < MAX_PLAYERS) return;
  if (!force && !ridersAtStart()) return;

  game.phase = "countdown";
  game.countdown = 5;
  game.players.forEach((player) => {
    player.approach = 100;
    player.distance = 0;
    player.lastButton = null;
  });
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
      game.players.forEach((player) => {
        player.lastButton = null;
      });
    }
    emitState();
  }, 1000);
};

const resetGame = () => {
  if (game.countdownTimer) clearInterval(game.countdownTimer);
  game = freshGame();
  io.emit("reset-game");
  emitState();
};

io.on("connection", (socket) => {
  socket.emit("state", publicState());

  socket.on("resume", (clientId, reply) => {
    const playerId = cleanPlayerId(clientId);
    const player = game.players.find((item) => item.id === playerId);
    if (!player) {
      reply?.({ ok: false });
      return;
    }

    socket.data.playerId = player.id;
    player.socketId = socket.id;
    player.connected = true;
    reply?.({ ok: true, playerId: player.id, name: player.name, lane: player.lane });
    emitState();
  });

  socket.on("join", (payload, reply) => {
    const cleanName = String(payload?.name ?? payload ?? "")
      .trim()
      .replace(/\s+/g, "")
      .slice(0, 4);
    const requestedId = cleanPlayerId(payload?.clientId);

    if (!cleanName) {
      reply?.({ ok: false, message: "名前を入力してください" });
      return;
    }

    if (!["lobby", "staging"].includes(game.phase)) {
      reply?.({ ok: false, message: "レース中です。次の回をお待ちください" });
      return;
    }

    const existingPlayer = game.players.find((player) => player.id === requestedId);
    if (existingPlayer) {
      socket.data.playerId = existingPlayer.id;
      existingPlayer.name = cleanName;
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      reply?.({ ok: true, playerId: existingPlayer.id, lane: existingPlayer.lane });
      emitState();
      return;
    }

    const reusablePlayer = game.players.find((player) => !player.connected);
    if (game.players.length >= MAX_PLAYERS && !reusablePlayer) {
      reply?.({ ok: false, message: "参加枠がいっぱいです" });
      return;
    }

    const lane = reusablePlayer?.lane ?? game.players.length;
    const player = reusablePlayer ?? {
      id: requestedId || socket.id,
      lane,
      color: riders[lane].color,
      colorKey: riders[lane].key,
      ready: true,
      approach: 0,
      distance: 0,
      lastButton: null
    };

    Object.assign(player, {
      id: requestedId || player.id,
      name: cleanName,
      lane,
      color: riders[lane].color,
      colorKey: riders[lane].key,
      ready: true,
      approach: reusablePlayer ? 0 : player.approach,
      distance: reusablePlayer ? 0 : player.distance,
      lastButton: null,
      socketId: socket.id,
      connected: true
    });

    socket.data.playerId = player.id;
    if (!reusablePlayer) game.players.push(player);
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

  socket.on("start-countdown", () => beginCountdown(true));

  socket.on("disconnect", () => {
    const player = getPlayer(socket);
    if (player && player.socketId === socket.id) {
      player.connected = false;
      emitState();
    }
  });
});

app.use((_req, res) => {
  if (_req.accepts("html")) {
    sendPage(res, "index.html");
    return;
  }

  res.status(404).send("Not found");
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

server.listen(PORT, HOST, () => {
  console.log(`Bike race running on http://${HOST}:${PORT}`);
});
