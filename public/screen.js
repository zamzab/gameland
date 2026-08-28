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

const laneNames = ["A", "B", "C", "D", "E"];
const WAIT_X = -9;
const START_X = 8.4;
const GOAL_X = 90.3;
const bikeImage = (player) => `/assets/bike-rider-${player?.colorKey || "red"}.png`;

const render = (state) => {
  track.innerHTML = "";

  for (let lane = 0; lane < state.maxPlayers; lane += 1) {
    const player = state.players.find((item) => item.lane === lane);
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
    bikeImg.src = player ? bikeImage(player) : "/assets/bike-rider-red.png";
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
    overlay.innerHTML = `
      <div class="winner-card">
        <div class="winner-bike"><img src="${bikeImage(winner)}" alt="" /></div>
        <strong>${winner?.name || "WINNER"}</strong>
        <span>優勝!</span>
      </div>
      <div class="confetti">${Array.from({ length: 80 }, (_, index) => `<i style="--i:${index}"></i>`).join("")}</div>
    `;
    overlay.className = "overlay finished";
    startButton.disabled = true;
  }
};

socket.on("state", render);
resetButton.addEventListener("click", () => socket.emit("reset"));
startButton.addEventListener("click", () => socket.emit("start-countdown"));
