const socket = io();
const track = document.querySelector("#track");
const overlay = document.querySelector("#overlay");
const statusText = document.querySelector("#status");
const qr = document.querySelector("#qr");
const joinUrlText = document.querySelector("#join-url");
const resetButton = document.querySelector("#reset-button");
const startButton = document.querySelector("#start-button");

const joinUrl = `${window.location.origin}/join`;
qr.src = `/qr.svg?url=${encodeURIComponent(joinUrl)}`;
joinUrlText.textContent = joinUrl;

const laneNames = ["1枠", "2枠", "3枠", "4枠", "5枠"];
const WAIT_X = -9;
const START_X = 8.4;
const GOAL_X = 90.3;
const laneColorKeys = ["red", "blue", "green", "yellow", "black"];
const bikeImage = (colorKey) => `/assets/bike-rider-${colorKey || "red"}.png`;
const adminPinKey = "qr-bike-admin-pin";
let adminPinRequired = true;

const getAdminPin = () => {
  const savedPin = sessionStorage.getItem(adminPinKey);
  if (savedPin) return savedPin;

  const enteredPin = window.prompt("管理PINを入力してください") || "";
  if (enteredPin) sessionStorage.setItem(adminPinKey, enteredPin);
  return enteredPin;
};

const emitAdmin = (eventName) => {
  const pin = adminPinRequired ? getAdminPin() : "";
  if (adminPinRequired && !pin) return;

  socket.emit(eventName, { pin }, (response) => {
    if (response?.ok) return;
    sessionStorage.removeItem(adminPinKey);
    window.alert(response?.message || "管理操作に失敗しました");
  });
};

const createConfetti = () => {
  const confetti = document.createElement("div");
  confetti.className = "confetti";
  for (let index = 0; index < 80; index += 1) {
    const piece = document.createElement("i");
    piece.style.setProperty("--i", index);
    confetti.append(piece);
  }
  return confetti;
};

const renderWinner = (winner) => {
  overlay.textContent = "";

  const winnerCard = document.createElement("div");
  winnerCard.className = "winner-card";

  const winnerBike = document.createElement("div");
  winnerBike.className = "winner-bike";

  const bike = document.createElement("img");
  bike.src = bikeImage(winner?.colorKey);
  bike.alt = "";
  winnerBike.append(bike);

  const winnerName = document.createElement("strong");
  winnerName.textContent = winner?.name || "WINNER";

  const winnerText = document.createElement("span");
  winnerText.textContent = "優勝!";

  winnerCard.append(winnerBike, winnerName, winnerText);
  overlay.append(winnerCard, createConfetti());
};

const render = (state) => {
  adminPinRequired = state.adminPinRequired !== false;
  track.replaceChildren();

  for (let lane = 0; lane < state.maxPlayers; lane += 1) {
    const player = state.players.find((item) => item.lane === lane);
    const laneColorKey = player?.colorKey || laneColorKeys[lane];
    const laneEl = document.createElement("div");
    laneEl.className = "lane";

    const laneMark = document.createElement("div");
    laneMark.className = "lane-mark";
    laneMark.textContent = laneNames[lane];
    laneEl.append(laneMark);

    const rider = document.createElement("div");
    rider.className = player ? "rider" : "rider rider-empty";

    const progress = player
      ? state.phase === "staging"
        ? player.approach / 100
        : player.distance / 100
      : 0;
    const percent =
      state.phase === "staging" || state.phase === "lobby"
        ? WAIT_X + (START_X - WAIT_X) * progress
        : START_X + (GOAL_X - START_X) * progress;
    rider.style.left = `${Math.max(WAIT_X, Math.min(GOAL_X, percent))}%`;

    const name = document.createElement("div");
    name.className = "rider-name";
    name.textContent = player?.name || "募集中";
    if (player) name.style.borderColor = player.color;

    const bike = document.createElement("div");
    bike.className = "bike";
    const bikeImg = document.createElement("img");
    bikeImg.src = bikeImage(laneColorKey);
    bikeImg.alt = "";
    bikeImg.draggable = false;
    bike.append(bikeImg);

    rider.append(name, bike);
    laneEl.append(rider);
    track.append(laneEl);
  }

  const filled = state.players.length;
  const atStart = state.players.filter((player) => player.approach >= 100).length;

  if (state.phase === "lobby") {
    statusText.textContent = "QRコードを読み込んで参加してください";
    overlay.textContent = "";
    overlay.className = "overlay";
    startButton.disabled = true;
  } else if (state.phase === "staging") {
    statusText.textContent = `${filled}/5 名参加中。カウント開始で少人数レースも開始できます`;
    overlay.textContent = filled < 5 ? `${filled} 名で待機中` : `スタートラインへ ${atStart}/5`;
    overlay.className = "overlay hint";
    startButton.disabled = filled === 0;
  } else if (state.phase === "countdown") {
    statusText.textContent = "まもなくスタート";
    overlay.textContent = state.countdown;
    overlay.className = "overlay countdown";
    startButton.disabled = true;
  } else if (state.phase === "racing") {
    statusText.textContent = "レース中";
    overlay.textContent = "";
    overlay.className = "overlay";
    startButton.disabled = true;
  } else if (state.phase === "finished") {
    const winner = state.players.find((player) => player.id === state.winnerId);
    statusText.textContent = `${winner?.name || ""} さんの勝利`;
    overlay.className = "overlay finished";
    renderWinner(winner);
    startButton.disabled = true;
  }
};

socket.on("state", render);
resetButton.addEventListener("click", () => emitAdmin("reset"));
startButton.addEventListener("click", () => emitAdmin("start-countdown"));
