const socket = io();
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

let myId = null;
let myName = "";
let lastPressed = null;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = input.value.trim().replace(/\s+/g, "").slice(0, 4);
  socket.emit("join", name, (response) => {
    if (!response?.ok) {
      message.textContent = response?.message || "参加できませんでした";
      return;
    }

    myId = response.playerId;
    myName = name;
    riderName.textContent = myName;
    nameCard.classList.add("hidden");
    controller.classList.remove("hidden");
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

left.addEventListener("click", () => pedal("left"));
right.addEventListener("click", () => pedal("right"));

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
