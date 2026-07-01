import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  onValue,
  remove
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

/* =========================================================
   FIREBASE
========================================================= */

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

/*
 * Esta ruta contiene únicamente el partido activo
 * o el último partido mostrado públicamente.
 */
const matchRef = ref(database, "partido_actual");

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const TEAMS = [
  "Real San Pablo",
  "Real STN Cruz",
  "Chilpas FC",
  "Millan",
  "Cruz Azul",
  "Pharys",
  "Borussia",
  "León",
  "Inter STN Cruz",
  "Niupi",
  "FC R10",
  "Toluca FC"
];

const PASSWORD = "CHS";
const QUARTER_DURATION = 12 * 60;
const TOTAL_QUARTERS = 4;

const STORAGE_KEYS = {
  referee: "chs_arbitro",
  match: "chs_partido_actual"
};

/* =========================================================
   ESTADO GENERAL
========================================================= */

let match = null;
let timerInterval = null;
let pendingEvent = null;
let selectedShootoutWinner = null;
let toastTimeout = null;
let currentMode = null;

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

/* =========================================================
   INICIO
========================================================= */

function init() {
  populateMatchDays();
  populateTeams();
  bindEvents();
  loadLocalMatch();
  listenFirebaseMatch();
  showView("homeView");
}

/* =========================================================
   FIREBASE EN TIEMPO REAL
========================================================= */

function listenFirebaseMatch() {
  onValue(
    matchRef,
    (snapshot) => {
      const firebaseMatch = snapshot.val();

      /*
       * Si no existe partido actual, la vista pública
       * mostrará el mensaje de que no hay partido.
       */
      if (!firebaseMatch) {
        if (currentMode === "public") {
          match = null;

          localStorage.removeItem(
            STORAGE_KEYS.match
          );

          stopTimerLoop();
          renderPublic();
        }

        return;
      }

      match = normalizeMatch(firebaseMatch);

      /*
       * Guardamos también una copia local como respaldo.
       */
      localStorage.setItem(
        STORAGE_KEYS.match,
        JSON.stringify(match)
      );

      syncTimer();
      renderAll();

      if (match.timerRunning) {
        startTimerLoop();
      } else {
        stopTimerLoop();
      }

      /*
       * Actualiza la tarjeta de "Continuar partido"
       * si el árbitro está en la pantalla de configuración.
       */
      if (
        currentMode === "referee" &&
        $("setupView").classList.contains("active")
      ) {
        prepareSetup();
      }
    },
    (error) => {
      console.error(
        "Error al leer Firebase:",
        error
      );

      showToast(
        "No se pudo conectar con Firebase"
      );
    }
  );
}

/*
 * Garantiza que los eventos siempre sean un arreglo.
 */
function normalizeMatch(data) {
  return {
    ...data,

    matchDay: Number(
      data.matchDay || 0
    ),

    events: Array.isArray(data.events)
      ? data.events
      : data.events
        ? Object.values(data.events)
        : []
  };
}

/* =========================================================
   EVENTOS DE LA INTERFAZ
========================================================= */

function bindEvents() {
  $("openRefereeBtn").addEventListener(
    "click",
    openReferee
  );

  $("openPublicBtn").addEventListener(
    "click",
    openPublic
  );

  document
    .querySelectorAll(".back-home")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          stopTimerLoop();
          currentMode = null;
          showView("homeView");
        }
      );
    });

  $("loginBtn").addEventListener(
    "click",
    login
  );

  $("passwordInput").addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        login();
      }
    }
  );

  $("logoutBtn").addEventListener(
    "click",
    logout
  );

  $("startMatchBtn").addEventListener(
    "click",
    startNewMatch
  );

  $("resumeBtn").addEventListener(
    "click",
    resumeMatch
  );

  $("discardBtn").addEventListener(
    "click",
    discardMatch
  );

  $("timerBtn").addEventListener(
    "click",
    toggleTimer
  );

  $("resetTimerBtn").addEventListener(
    "click",
    resetTimer
  );

  $("nextQuarterBtn").addEventListener(
    "click",
    nextQuarter
  );

  $("finishBtn").addEventListener(
    "click",
    openFinishModal
  );

  $("undoBtn").addEventListener(
    "click",
    undoLastEvent
  );

  $("exitRefereeBtn").addEventListener(
    "click",
    () => {
      showView("homeView");
    }
  );

  document
    .querySelectorAll("[data-action]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openEventModal(
            button.dataset.action,
            button.dataset.team
          );
        }
      );
    });

  $("cancelEventBtn").addEventListener(
    "click",
    closeEventModal
  );

  $("confirmEventBtn").addEventListener(
    "click",
    confirmEvent
  );

  $("playerInput").addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        confirmEvent();
      }
    }
  );

  $("cancelFinishBtn").addEventListener(
    "click",
    closeFinishModal
  );

  $("confirmFinishBtn").addEventListener(
    "click",
    confirmFinish
  );

  $("cardOverlay").addEventListener(
    "click",
    () => {
      $("cardOverlay").classList.add(
        "hidden"
      );
    }
  );

  /*
   * Cuando el usuario vuelve a la app,
   * recalculamos el cronómetro.
   */
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden && match) {
        syncTimer();
        renderAll();

        if (match.timerRunning) {
          startTimerLoop();
        }
      }
    }
  );
}

/* =========================================================
   JORNADAS Y EQUIPOS
========================================================= */

function populateMatchDays() {
  const options = [
    '<option value="">Selecciona la jornada</option>'
  ];

  for (let day = 1; day <= 25; day++) {
    options.push(
      `<option value="${day}">Jornada ${day}</option>`
    );
  }

  $("matchDay").innerHTML =
    options.join("");
}

function populateTeams() {
  const options = [
    '<option value="">Selecciona un equipo</option>',

    ...TEAMS.map(
      (team) =>
        `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`
    )
  ].join("");

  $("homeTeam").innerHTML = options;
  $("awayTeam").innerHTML = options;
}

/* =========================================================
   VISTAS
========================================================= */

function showView(id) {
  document
    .querySelectorAll(".view")
    .forEach((view) => {
      view.classList.remove("active");
    });

  $(id).classList.add("active");

  window.scrollTo({
    top: 0,
    behavior: "instant"
  });
}

/* =========================================================
   ACCESO DEL ÁRBITRO
========================================================= */

function openReferee() {
  currentMode = "referee";

  const authenticated =
    localStorage.getItem(
      STORAGE_KEYS.referee
    ) === "true";

  if (authenticated) {
    prepareSetup();
    showView("setupView");
    return;
  }

  $("passwordInput").value = "";

  $("loginError").classList.add(
    "hidden"
  );

  showView("loginView");

  setTimeout(() => {
    $("passwordInput").focus();
  }, 100);
}

function login() {
  const value =
    $("passwordInput").value.trim();

  if (value !== PASSWORD) {
    $("loginError").classList.remove(
      "hidden"
    );

    $("passwordInput").select();
    return;
  }

  localStorage.setItem(
    STORAGE_KEYS.referee,
    "true"
  );

  $("loginError").classList.add(
    "hidden"
  );

  prepareSetup();
  showView("setupView");
}

function logout() {
  localStorage.removeItem(
    STORAGE_KEYS.referee
  );

  currentMode = null;

  showView("homeView");

  showToast(
    "Sesión de árbitro cerrada"
  );
}

/* =========================================================
   CONFIGURACIÓN DEL PARTIDO
========================================================= */

function prepareSetup() {
  if (!match) {
    loadLocalMatch();
  }

  if (match && !match.finalized) {
    const jornada = match.matchDay
      ? `Jornada ${match.matchDay}`
      : "Jornada sin registrar";

    $("resumeText").textContent =
      `${jornada} · ` +
      `${match.home.name} ` +
      `${match.home.score} - ` +
      `${match.away.score} ` +
      `${match.away.name} · ` +
      `Cuarto ${match.quarter}`;

    $("resumeBox").classList.remove(
      "hidden"
    );
  } else {
    $("resumeBox").classList.add(
      "hidden"
    );
  }
}

function createTeam(name) {
  return {
    name,
    score: 0,
    fouls: 0,
    yellow: 0,
    red: 0
  };
}

async function startNewMatch() {
  const matchDay =
    $("matchDay").value;

  const home =
    $("homeTeam").value;

  const away =
    $("awayTeam").value;

  if (!matchDay) {
    $("setupError").textContent =
      "Selecciona la jornada del partido.";

    $("setupError").classList.remove(
      "hidden"
    );

    return;
  }

  if (!home || !away) {
    $("setupError").textContent =
      "Selecciona los dos equipos.";

    $("setupError").classList.remove(
      "hidden"
    );

    return;
  }

  if (home === away) {
    $("setupError").textContent =
      "Los equipos deben ser diferentes.";

    $("setupError").classList.remove(
      "hidden"
    );

    return;
  }

  $("setupError").classList.add(
    "hidden"
  );

  match = {
    id: Date.now(),

    matchDay: Number(matchDay),

    home: createTeam(home),
    away: createTeam(away),

    quarter: 1,

    secondsRemaining:
      QUARTER_DURATION,

    timerRunning: false,
    timerEndAt: null,

    events: [],

    finalized: false,

    resultType: null,
    winner: null,

    pointsHome: null,
    pointsAway: null,

    createdAt:
      new Date().toISOString(),

    updatedAt:
      Date.now()
  };

  await saveMatch();

  enterRefereeView();
}

function resumeMatch() {
  if (!match) {
    loadLocalMatch();
  }

  if (!match) {
    showToast(
      "No hay partido guardado"
    );

    return;
  }

  enterRefereeView();
}

/*
 * Borra únicamente partido_actual.
 * No borra los partidos guardados en historial_partidos.
 */
async function discardMatch() {
  const accepted = confirm(
    "¿Deseas borrar el partido actual para todos?"
  );

  if (!accepted) {
    return;
  }

  stopTimerLoop();

  try {
    await remove(matchRef);

    localStorage.removeItem(
      STORAGE_KEYS.match
    );

    match = null;

    $("resumeBox").classList.add(
      "hidden"
    );

    renderPublic();

    showToast(
      "Partido actual eliminado"
    );
  } catch (error) {
    console.error(
      "Error al borrar el partido:",
      error
    );

    showToast(
      "No se pudo borrar el partido"
    );
  }
}

/* =========================================================
   VISTA DEL ÁRBITRO Y VISTA PÚBLICA
========================================================= */

function enterRefereeView() {
  currentMode = "referee";

  syncTimer();
  renderAll();

  showView("refereeView");

  if (match?.timerRunning) {
    startTimerLoop();
  }
}

function openPublic() {
  currentMode = "public";

  syncTimer();
  renderPublic();

  showView("publicView");

  if (match?.timerRunning) {
    startTimerLoop();
  }
}

/* =========================================================
   CRONÓMETRO
========================================================= */

function toggleTimer() {
  if (!match || match.finalized) {
    return;
  }

  if (match.timerRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

async function startTimer() {
  if (match.secondsRemaining <= 0) {
    showToast(
      "El cuarto terminó. Pasa al siguiente."
    );

    return;
  }

  match.timerRunning = true;

  match.timerEndAt =
    Date.now() +
    match.secondsRemaining * 1000;

  await saveMatch();

  startTimerLoop();
  renderAll();
}

async function pauseTimer() {
  syncTimer();

  match.timerRunning = false;
  match.timerEndAt = null;

  stopTimerLoop();

  await saveMatch();

  renderAll();
}

async function resetTimer() {
  if (!match || match.finalized) {
    return;
  }

  const accepted = confirm(
    `¿Reiniciar el cuarto ${match.quarter} a 12:00?`
  );

  if (!accepted) {
    return;
  }

  match.timerRunning = false;
  match.timerEndAt = null;

  match.secondsRemaining =
    QUARTER_DURATION;

  stopTimerLoop();

  await saveMatch();

  renderAll();
}

async function nextQuarter() {
  if (!match || match.finalized) {
    return;
  }

  if (
    match.quarter >=
    TOTAL_QUARTERS
  ) {
    openFinishModal();
    return;
  }

  const accepted = confirm(
    `¿Finalizar el cuarto ${match.quarter} ` +
    `y pasar al cuarto ${match.quarter + 1}?`
  );

  if (!accepted) {
    return;
  }

  match.timerRunning = false;
  match.timerEndAt = null;

  match.quarter += 1;

  match.secondsRemaining =
    QUARTER_DURATION;

  stopTimerLoop();

  await saveMatch();

  renderAll();

  showToast(
    `Cuarto ${match.quarter} listo`
  );
}

function startTimerLoop() {
  stopTimerLoop();

  timerInterval = setInterval(
    () => {
      if (!match?.timerRunning) {
        return;
      }

      syncTimer();
      renderTimerOnly();

      if (
        match.secondsRemaining <= 0
      ) {
        finishQuarterAutomatically();
      }
    },
    250
  );
}

function stopTimerLoop() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function syncTimer() {
  if (
    !match?.timerRunning ||
    !match.timerEndAt
  ) {
    return;
  }

  match.secondsRemaining =
    Math.max(
      0,
      Math.ceil(
        (
          match.timerEndAt -
          Date.now()
        ) / 1000
      )
    );
}

async function finishQuarterAutomatically() {
  if (
    !match ||
    !match.timerRunning
  ) {
    return;
  }

  match.secondsRemaining = 0;
  match.timerRunning = false;
  match.timerEndAt = null;

  stopTimerLoop();

  await saveMatch();

  renderAll();

  if (
    "vibrate" in navigator
  ) {
    navigator.vibrate(
      [300, 150, 300]
    );
  }

  if (
    match.quarter ===
    TOTAL_QUARTERS
  ) {
    showToast(
      "Terminó el cuarto 4"
    );
  } else {
    showToast(
      `Terminó el cuarto ${match.quarter}`
    );
  }
}

/* =========================================================
   GOLES, FALTAS Y TARJETAS
========================================================= */

function openEventModal(
  action,
  teamKey
) {
  if (!match || match.finalized) {
    return;
  }

  const team =
    match[teamKey];

  pendingEvent = {
    action,
    teamKey
  };

  const labels = {
    goal: "Registrar gol",
    foul: "Registrar falta",
    yellow: "Tarjeta amarilla",
    red: "Tarjeta roja"
  };

  $("eventTitle").textContent =
    labels[action];

  $("eventSubtitle").textContent =
    team.name;

  $("playerInput").value = "";

  $("eventModal").classList.remove(
    "hidden"
  );

  setTimeout(() => {
    $("playerInput").focus();
  }, 100);
}

function closeEventModal() {
  pendingEvent = null;

  $("eventModal").classList.add(
    "hidden"
  );
}

async function confirmEvent() {
  if (
    !pendingEvent ||
    !match
  ) {
    return;
  }

  const player =
    $("playerInput").value.trim();

  if (!player) {
    $("playerInput").focus();
    return;
  }

  syncTimer();

  const event = {
    id: Date.now(),

    type:
      pendingEvent.action,

    teamKey:
      pendingEvent.teamKey,

    teamName:
      match[
        pendingEvent.teamKey
      ].name,

    player,

    quarter:
      match.quarter,

    time:
      formatTime(
        match.secondsRemaining
      ),

    createdAt:
      new Date().toISOString()
  };

  applyEvent(event, 1);

  match.events.push(event);

  closeEventModal();

  renderAll();

  await saveMatch();

  if (
    event.type === "yellow" ||
    event.type === "red"
  ) {
    showCardOverlay(event);
  } else {
    showToast(
      eventMessage(event)
    );
  }
}

function applyEvent(
  event,
  direction
) {
  const team =
    match[event.teamKey];

  if (event.type === "goal") {
    team.score += direction;
  }

  if (event.type === "foul") {
    team.fouls += direction;
  }

  if (event.type === "yellow") {
    team.yellow += direction;
  }

  if (event.type === "red") {
    team.red += direction;
  }
}

async function undoLastEvent() {
  if (
    !match ||
    match.events.length === 0 ||
    match.finalized
  ) {
    showToast(
      "No hay eventos para deshacer"
    );

    return;
  }

  const event =
    match.events.pop();

  applyEvent(event, -1);

  match.home.score =
    Math.max(
      0,
      match.home.score
    );

  match.away.score =
    Math.max(
      0,
      match.away.score
    );

  match.home.fouls =
    Math.max(
      0,
      match.home.fouls
    );

  match.away.fouls =
    Math.max(
      0,
      match.away.fouls
    );

  match.home.yellow =
    Math.max(
      0,
      match.home.yellow
    );

  match.away.yellow =
    Math.max(
      0,
      match.away.yellow
    );

  match.home.red =
    Math.max(
      0,
      match.home.red
    );

  match.away.red =
    Math.max(
      0,
      match.away.red
    );

  renderAll();

  await saveMatch();

  showToast(
    "Último evento deshecho"
  );
}

function showCardOverlay(event) {
  const overlay =
    $("cardOverlay");

  const isYellow =
    event.type === "yellow";

  overlay.className =
    `card-overlay ${
      isYellow
        ? "yellow"
        : "red"
    }`;

  $("overlayTitle").textContent =
    isYellow
      ? "TARJETA AMARILLA"
      : "TARJETA ROJA";

  $("overlayTeam").textContent =
    event.teamName;

  $("overlayPlayer").textContent =
    `Jugador ${event.player}`;
}

/* =========================================================
   FINALIZAR PARTIDO Y SHOOTOUT
========================================================= */

function openFinishModal() {
  if (!match || match.finalized) {
    return;
  }

  pauseTimerSilently();

  selectedShootoutWinner = null;

  const tied =
    match.home.score ===
    match.away.score;

  if (tied) {
    $("finishContent").innerHTML = `
      <p>
        El partido terminó empatado:
      </p>

      <h3>
        ${escapeHtml(match.home.name)}
        ${match.home.score}
        -
        ${match.away.score}
        ${escapeHtml(match.away.name)}
      </h3>

      <p>
        Selecciona al ganador del
        <strong>shootout</strong>.
      </p>

      <div class="shootout-options">
        <button
          class="btn btn-secondary shootout-choice"
          data-winner="home"
        >
          ${escapeHtml(match.home.name)}
        </button>

        <button
          class="btn btn-secondary shootout-choice"
          data-winner="away"
        >
          ${escapeHtml(match.away.name)}
        </button>
      </div>

      <p class="muted">
        Ganador: 2 puntos ·
        Perdedor: 1 punto
      </p>
    `;

    document
      .querySelectorAll(
        ".shootout-choice"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            selectedShootoutWinner =
              button.dataset.winner;

            document
              .querySelectorAll(
                ".shootout-choice"
              )
              .forEach((item) => {
                item.classList.toggle(
                  "selected",
                  item === button
                );
              });
          }
        );
      });
  } else {
    const winnerKey =
      match.home.score >
      match.away.score
        ? "home"
        : "away";

    $("finishContent").innerHTML = `
      <p>
        Resultado final:
      </p>

      <h3>
        ${escapeHtml(match.home.name)}
        ${match.home.score}
        -
        ${match.away.score}
        ${escapeHtml(match.away.name)}
      </h3>

      <p>
        <strong>
          ${escapeHtml(
            match[winnerKey].name
          )}
        </strong>

        gana en tiempo regular.
      </p>

      <p class="muted">
        Ganador: 3 puntos ·
        Perdedor: 0 puntos
      </p>
    `;
  }

  $("finishModal").classList.remove(
    "hidden"
  );
}

function closeFinishModal() {
  $("finishModal").classList.add(
    "hidden"
  );
}

async function pauseTimerSilently() {
  if (!match) {
    return;
  }

  syncTimer();

  match.timerRunning = false;
  match.timerEndAt = null;

  stopTimerLoop();

  renderAll();

  await saveMatch();
}

/*
 * Al confirmar el resultado:
 *
 * 1. Se actualiza partido_actual.
 * 2. Se guarda una copia permanente en historial_partidos.
 */
async function confirmFinish() {
  if (!match) {
    return;
  }

  const tied =
    match.home.score ===
    match.away.score;

  if (tied) {
    if (!selectedShootoutWinner) {
      showToast(
        "Selecciona al ganador del shootout"
      );

      return;
    }

    match.resultType =
      "shootout";

    match.winner =
      selectedShootoutWinner;

    match.pointsHome =
      selectedShootoutWinner ===
      "home"
        ? 2
        : 1;

    match.pointsAway =
      selectedShootoutWinner ===
      "away"
        ? 2
        : 1;
  } else {
    const winner =
      match.home.score >
      match.away.score
        ? "home"
        : "away";

    match.resultType =
      "regular";

    match.winner =
      winner;

    match.pointsHome =
      winner === "home"
        ? 3
        : 0;

    match.pointsAway =
      winner === "away"
        ? 3
        : 0;
  }

  match.finalized = true;
  match.timerRunning = false;
  match.timerEndAt = null;

  match.finishedAt =
    new Date().toISOString();

  match.updatedAt =
    Date.now();

  closeFinishModal();

  renderAll();

  try {
    /*
     * Guardamos el resultado en la ruta pública.
     */
    await set(
      matchRef,
      match
    );

    /*
     * Guardamos una copia permanente.
     * Cada partido utiliza su propio ID.
     */
    const historyMatchRef = ref(
      database,
      `historial_partidos/${match.id}`
    );

    await set(
      historyMatchRef,
      match
    );

    /*
     * Copia local de respaldo.
     */
    localStorage.setItem(
      STORAGE_KEYS.match,
      JSON.stringify(match)
    );

    showToast(
      "Resultado guardado en el historial"
    );
  } catch (error) {
    console.error(
      "Error al guardar el historial:",
      error
    );

    showToast(
      "No se pudo guardar el historial"
    );
  }
}

/* =========================================================
   RENDERIZADO
========================================================= */

function renderAll() {
  renderReferee();
  renderPublic();
}

function renderTimerOnly() {
  if (!match) {
    return;
  }

  const time =
    formatTime(
      match.secondsRemaining
    );

  if ($("refTimer")) {
    $("refTimer").textContent =
      time;
  }

  if ($("pubTimer")) {
    $("pubTimer").textContent =
      time;
  }
}

function renderReferee() {
  if (!match) {
    return;
  }

  if ($("refMatchDay")) {
    $("refMatchDay").textContent =
      match.matchDay
        ? `Jornada ${match.matchDay}`
        : "Jornada sin registrar";
  }

  $("refQuarter").textContent =
    match.quarter;

  $("refTimer").textContent =
    formatTime(
      match.secondsRemaining
    );

  $("refHomeName").textContent =
    match.home.name;

  $("refAwayName").textContent =
    match.away.name;

  $("refHomeScore").textContent =
    match.home.score;

  $("refAwayScore").textContent =
    match.away.score;

  $("refHomeFouls").textContent =
    match.home.fouls;

  $("refAwayFouls").textContent =
    match.away.fouls;

  $("refHomeYellow").textContent =
    match.home.yellow;

  $("refAwayYellow").textContent =
    match.away.yellow;

  $("refHomeRed").textContent =
    match.home.red;

  $("refAwayRed").textContent =
    match.away.red;

  if (match.timerRunning) {
    $("timerBtn").textContent =
      "Pausar";
  } else if (
    match.secondsRemaining ===
    QUARTER_DURATION
  ) {
    $("timerBtn").textContent =
      "Iniciar";
  } else {
    $("timerBtn").textContent =
      "Reanudar";
  }

  $("nextQuarterBtn").textContent =
    match.quarter >=
    TOTAL_QUARTERS
      ? "Cerrar partido"
      : "Siguiente cuarto";

  renderEvents(
    $("refEvents"),
    true
  );
}

function renderPublic() {
  if (!match) {
    $("publicEmpty").classList.remove(
      "hidden"
    );

    $("publicContent").classList.add(
      "hidden"
    );

    return;
  }

  $("publicEmpty").classList.add(
    "hidden"
  );

  $("publicContent").classList.remove(
    "hidden"
  );

  if ($("pubMatchDay")) {
    $("pubMatchDay").textContent =
      match.matchDay
        ? `Jornada ${match.matchDay}`
        : "Jornada sin registrar";
  }

  $("pubQuarter").textContent =
    match.quarter;

  $("pubTimer").textContent =
    formatTime(
      match.secondsRemaining
    );

  $("pubHomeName").textContent =
    match.home.name;

  $("pubAwayName").textContent =
    match.away.name;

  $("pubHomeScore").textContent =
    match.home.score;

  $("pubAwayScore").textContent =
    match.away.score;

  $("pubHomeFouls").textContent =
    match.home.fouls;

  $("pubAwayFouls").textContent =
    match.away.fouls;

  if (match.finalized) {
    const winner =
      match[match.winner].name;

    let text = "";

    if (
      match.resultType ===
      "shootout"
    ) {
      text =
        `${winner} ganó por shootout · ` +
        `${match.pointsHome}-` +
        `${match.pointsAway} puntos`;
    } else {
      text =
        `${winner} ganó en tiempo regular · ` +
        `${match.pointsHome}-` +
        `${match.pointsAway} puntos`;
    }

    $("resultBadge").textContent =
      text;

    $("resultBadge").classList.remove(
      "hidden"
    );
  } else {
    $("resultBadge").classList.add(
      "hidden"
    );
  }

  renderEvents(
    $("pubEvents"),
    false
  );
}

function renderEvents(
  container,
  limitEvents
) {
  if (
    !match ||
    match.events.length === 0
  ) {
    container.innerHTML =
      '<div class="empty-events">' +
      "Aún no hay eventos." +
      "</div>";

    return;
  }

  const events =
    [...match.events].reverse();

  const visible =
    limitEvents
      ? events.slice(0, 10)
      : events.slice(0, 20);

  container.innerHTML =
    visible
      .map(
        (event) => `
          <div class="event-item">
            <span class="event-time">
              Q${event.quarter}
              ${event.time}
            </span>

            <p>
              ${escapeHtml(
                eventMessage(event)
              )}
            </p>
          </div>
        `
      )
      .join("");
}

function eventMessage(event) {
  const labels = {
    goal: "⚽ Gol",
    foul: "Falta",
    yellow:
      "🟨 Tarjeta amarilla",
    red:
      "🟥 Tarjeta roja"
  };

  return (
    `${labels[event.type]} · ` +
    `${event.teamName} · ` +
    `Jugador ${event.player}`
  );
}

/* =========================================================
   GUARDAR Y CARGAR
========================================================= */

/*
 * Esta función guarda únicamente el estado actual.
 * El historial se guarda al finalizar el partido.
 */
async function saveMatch() {
  if (!match) {
    return;
  }

  match.updatedAt =
    Date.now();

  localStorage.setItem(
    STORAGE_KEYS.match,
    JSON.stringify(match)
  );

  try {
    await set(
      matchRef,
      match
    );
  } catch (error) {
    console.error(
      "Error al guardar en Firebase:",
      error
    );

    showToast(
      "No se pudo sincronizar con internet"
    );
  }
}

function loadLocalMatch() {
  const raw =
    localStorage.getItem(
      STORAGE_KEYS.match
    );

  if (!raw) {
    return;
  }

  try {
    match = normalizeMatch(
      JSON.parse(raw)
    );
  } catch (error) {
    console.error(
      "Error al cargar el partido local:",
      error
    );

    match = null;

    localStorage.removeItem(
      STORAGE_KEYS.match
    );
  }
}

/* =========================================================
   UTILIDADES
========================================================= */

function formatTime(
  totalSeconds
) {
  const safe =
    Math.max(
      0,
      Number(totalSeconds) || 0
    );

  const minutes =
    Math.floor(safe / 60);

  const seconds =
    safe % 60;

  return (
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}`
  );
}

function showToast(message) {
  clearTimeout(
    toastTimeout
  );

  $("toast").textContent =
    message;

  $("toast").classList.remove(
    "hidden"
  );

  toastTimeout = setTimeout(
    () => {
      $("toast").classList.add(
        "hidden"
      );
    },
    2600
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}