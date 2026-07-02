import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getDatabase,
  ref,
  onValue
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3fxYEc9rf9VkF6VKTb8Y-3vK-mikCOmk",
  authDomain: "chilpa-sport.firebaseapp.com",
  databaseURL: "https://chilpa-sport-default-rtdb.firebaseio.com",
  projectId: "chilpa-sport",
  storageBucket: "chilpa-sport.firebasestorage.app",
  messagingSenderId: "231727363072",
  appId: "1:231727363072:web:de5068fbb908e1258b14e5",
  measurementId: "G-XGZ5XD7XR5"
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);
const matchRef = ref(database, "partido_actual");

let match = null;
let timerInterval = null;

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

function init() {
  applyUrlOptions();
  listenMatch();
}

function applyUrlOptions() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("compact") === "1") {
    document.body.classList.add("compact");
  }

  if (params.get("low") === "1") {
    document.body.classList.add("low");
  }
}

function listenMatch() {
  onValue(matchRef, (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      match = null;
      stopTimer();
      $("overlay").classList.add("hidden");
      return;
    }

    match = normalizeMatch(data);

    syncTimer();
    renderOverlay();

    if (match.timerRunning) {
      startTimer();
    } else {
      stopTimer();
    }
  });
}

function normalizeMatch(data) {
  return {
    ...data,

    matchDay: Number(data.matchDay || 0),
    quarter: Number(data.quarter || 1),
    secondsRemaining: Number(data.secondsRemaining || 0),

    home: {
      name: data.home?.name || "LOCAL",
      score: Number(data.home?.score || 0),
      fouls: Number(data.home?.fouls || 0)
    },

    away: {
      name: data.away?.name || "VISITANTE",
      score: Number(data.away?.score || 0),
      fouls: Number(data.away?.fouls || 0)
    }
  };
}

function startTimer() {
  stopTimer();

  timerInterval = setInterval(() => {
    if (!match || !match.timerRunning) return;

    syncTimer();
    renderTimerOnly();

    if (match.secondsRemaining <= 0) {
      stopTimer();
    }
  }, 250);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function syncTimer() {
  if (!match?.timerRunning || !match.timerEndAt) {
    return;
  }

  match.secondsRemaining = Math.max(
    0,
    Math.ceil((match.timerEndAt - Date.now()) / 1000)
  );
}

function renderOverlay() {
  if (!match) return;

  $("overlay").classList.remove("hidden");

  $("matchDay").textContent =
    match.matchDay
      ? `Jornada ${match.matchDay}`
      : "Chilpa Sport";

  $("homeName").textContent = match.home.name;
  $("awayName").textContent = match.away.name;

  $("homeScore").textContent = match.home.score;
  $("awayScore").textContent = match.away.score;

  $("homeFouls").textContent = `Faltas ${match.home.fouls}`;
  $("awayFouls").textContent = `Faltas ${match.away.fouls}`;

  $("quarter").textContent = `Q${match.quarter || 1}`;
  $("timer").textContent = formatTime(match.secondsRemaining);

  if (match.finalized) {
    const winner =
      match.winner && match[match.winner]
        ? match[match.winner].name
        : "Partido finalizado";

    $("finalBadge").textContent =
      match.resultType === "shootout"
        ? `${winner} ganó por shootout`
        : `${winner} ganó`;

    $("finalBadge").classList.remove("hidden");
  } else {
    $("finalBadge").classList.add("hidden");
  }
}

function renderTimerOnly() {
  if (!match) return;

  $("timer").textContent =
    formatTime(match.secondsRemaining);
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;

  return (
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}`
  );
}
