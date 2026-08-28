const socket = io({ autoConnect: false });
const form = document.querySelector("#join-form");
const input = document.querySelector("#name-input");
const message = document.querySelector("#message");
const nameCard = document.querySelector("#name-card");
const controller = document.querySelector("#controller");
const riderName = document.querySelector("#rider-name");
const riderDot = document.querySelector("#rider-dot");
const phaseText = document.querySelector("#phase-text");
const left = document.querySelector("#left");
const right = document.querySelector("#right");

const storageKey = "qr-bike-rider";
let storedRider = null;
try {
  storedRider = JSON.parse(localStorage.getItem(storageKey) || "null");
} catch {
  localStorage.removeItem(storageKey);
}

let myId = storedRider?.id || null;
let myName = storedRider?.name || "";
let lastPressed = null;
let fullscreenRequested = false;

const makeClientId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const showController = (name) => {
  myName = name;
  riderName.textContent = myName;
  nameCard.classList.add("hidden");
  controller.classList.remove("hidden");
};

const requestFullscreenOnce = () => {
  if (fullscreenRequested) return;
  fullscreenRequested = true;
  const root = document.documentElement;
  if (document.fullscreenElement || !root.requestFullscreen) return;
  root.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  requestFullscreenOnce();
  const name = input.value.trim().replace(/\s+/g, "").slice(0, 4);
  const clientId = myId || makeClientId();
  socket.emit("join", { name, clientId }, (response) => {
    if (!response?.ok) {
      message.textContent = response?.message || "参加できませんでした";
      return;
    }

    myId = response.playerId;
    localStorage.setItem(storageKey, JSON.stringify({ id: myId, name }));
    showController(name);
  });
});

input.addEventListener("input", () => {
  input.value = input.value.trimStart().slice(0, 4);
});

const pedal = (side) => {
  if (lastPressed === side) return;
  lastPressed = side;
  left.classList.toggle("active", side === "left");
  right.classList.toggle("active", side === "right");
  socket.emit("pedal", side);
};

const bindPedal = (button, side) => {
  button.addEventListener(
    "pointerdown",
    (event) => {
      event.preventDefault();
      requestFullscreenOnce();
      button.setPointerCapture?.(event.pointerId);
      pedal(side);
    },
    { passive: false }
  );
};

bindPedal(left, "left");
bindPedal(right, "right");

socket.on("state", (state) => {
  const me = state.players.find((player) => player.id === myId);
  if (me) {
    riderDot.style.background = me.color;
    riderName.textContent = me.name;
  }

  if (!myId) return;

  if (state.phase === "staging") {
    phaseText.textContent = "L/Rを交互に押してスタートラインへ";
  } else if (state.phase === "countdown") {
    phaseText.textContent = `${state.countdown}`;
  } else if (state.phase === "racing") {
    phaseText.textContent = "全力で交互にタップ!";
  } else if (state.phase === "finished") {
    phaseText.textContent = state.winnerId === myId ? "優勝!" : "ゴール!";
  } else {
    phaseText.textContent = "参加待ち";
  }
});

socket.on("connect", () => {
  if (!myId) return;

  socket.emit("resume", myId, (response) => {
    if (!response?.ok) {
      localStorage.removeItem(storageKey);
      myId = null;
      nameCard.classList.remove("hidden");
      controller.classList.add("hidden");
      return;
    }

    myId = response.playerId;
    localStorage.setItem(storageKey, JSON.stringify({ id: myId, name: response.name }));
    showController(response.name);
  });
});

socket.on("reset-game", () => {
  localStorage.removeItem(storageKey);
  myId = null;
  myName = "";
  lastPressed = null;
  input.value = "";
  message.textContent = "4文字まで表示できます";
  nameCard.classList.remove("hidden");
  controller.classList.add("hidden");
  left.classList.remove("active");
  right.classList.remove("active");
});

socket.connect();
