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

const bikeSvg = (color) => `
  <svg viewBox="0 0 140 78" aria-hidden="true">
    <g fill="none" stroke="#111827" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="31" cy="55" r="16" fill="#f8fafc"/>
      <circle cx="108" cy="55" r="16" fill="#f8fafc"/>
      <path d="M31 55 L57 55 L77 31 L108 55 L70 55 L54 30"/>
      <path d="M54 30 L44 23"/>
      <path d="M77 31 L91 24"/>
      <path d="M88 21 L100 21"/>
    </g>
    <g>
      <circle cx="65" cy="15" r="10" fill="#ffd7a8" stroke="#111827" stroke-width="4"/>
      <path d="M61 26 L74 36 L87 31" fill="none" stroke="#111827" stroke-width="5" stroke-linecap="round"/>
      <path d="M62 26 L51 43" fill="none" stroke="#111827" stroke-width="5" stroke-linecap="round"/>
      <path d="M69 35 L58 55" fill="none" stroke="#111827" stroke-width="5" stroke-linecap="round"/>
      <path d="M74 36 L92 55" fill="none" stroke="#111827" stroke-width="5" stroke-linecap="round"/>
      <path d="M56 24 Q66 18 79 25 L73 38 Q62 36 54 30 Z" fill="${color}" stroke="#111827" stroke-width="4"/>
    </g>
  </svg>
`;

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

    const bike = document.createElement("div");
    bike.className = "bike";
    bike.innerHTML = player ? bikeSvg(player.color) : bikeSvg("#cbd5e1");

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
        <div class="winner-bike">${bikeSvg(winner?.color || "#e24a4a")}</div>
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
