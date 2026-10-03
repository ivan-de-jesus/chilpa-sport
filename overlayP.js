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

  databaseURL:
  "https://chilpa-sport-default-rtdb.firebaseio.com",

  projectId: "chilpa-sport",

  storageBucket:
  "chilpa-sport.firebasestorage.app",

  messagingSenderId:
  "231727363072",

  appId:
  "1:231727363072:web:de5068fbb908e1258b14e5",

  measurementId:
  "G-XGZ5XD7XR5"

};


const firebaseApp =
initializeApp(firebaseConfig);

const database =
getDatabase(firebaseApp);

const matchRef =
ref(database, "partido_actual");


let match = null;

let previousMatch = null;

let timerInterval = null;

let firstLoad = true;

let goalTimeout = null;


const $ =
(id) => document.getElementById(id);


document.addEventListener(
"DOMContentLoaded",
init
);


function init() {

  listenMatch();

}


function listenMatch() {

  onValue(matchRef, snapshot => {

    const data = snapshot.val();


    if (!data) {

      match = null;

      stopTimer();

      $("overlay")
      .classList
      .add("hidden");

      return;

    }


    const newMatch =
    normalizeMatch(data);


    /*
    Detectar gol antes
    de remplazar el partido anterior
    */

    if (!firstLoad && previousMatch) {

      detectGoal(
        previousMatch,
        newMatch
      );

    }


    match = newMatch;

    previousMatch =
    JSON.parse(
      JSON.stringify(newMatch)
    );


    firstLoad = false;


    syncTimer();

    renderOverlay();


    if (match.timerRunning) {

      startTimer();

    }
    else {

      stopTimer();

    }


  });

}


function normalizeMatch(data) {

  return {

    ...data,

    matchDay:
    Number(
      data.matchDay || 0
    ),

    quarter:
    Number(
      data.quarter || 1
    ),

    secondsRemaining:
    Number(
      data.secondsRemaining || 0
    ),

    home: {

      name:
      data.home?.name ||
      "LOCAL",

      score:
      Number(
        data.home?.score || 0
      ),

      fouls:
      Number(
        data.home?.fouls || 0
      )

    },

    away: {

      name:
      data.away?.name ||
      "VISITANTE",

      score:
      Number(
        data.away?.score || 0
      ),

      fouls:
      Number(
        data.away?.fouls || 0
      )

    }

  };

}


function detectGoal(
  oldMatch,
  newMatch
) {

  if (
    newMatch.home.score >
    oldMatch.home.score
  ) {

    showGoal(
      newMatch.home.name
    );

  }


  if (
    newMatch.away.score >
    oldMatch.away.score
  ) {

    showGoal(
      newMatch.away.name
    );

  }

}


function showGoal(teamName) {

  clearTimeout(goalTimeout);


  const screen =
  $("goalCelebration");

  const ball =
  $("goalBall");


  $("goalTeam")
  .textContent =
  teamName.toUpperCase();


  screen
  .classList
  .remove("hidden");


  /*
  Reiniciar animación
  */

  ball
  .classList
  .remove("shoot");


  void ball.offsetWidth;


  ball
  .classList
  .add("shoot");


  goalTimeout =
  setTimeout(() => {

    screen
    .classList
    .add("hidden");

  }, 5000);

}


function startTimer() {

  stopTimer();


  timerInterval =
  setInterval(() => {

    if (
      !match ||
      !match.timerRunning
    ) return;


    syncTimer();

    renderTimerOnly();


    if (
      match.secondsRemaining <= 0
    ) {

      stopTimer();

    }


  }, 250);

}


function stopTimer() {

  if (timerInterval) {

    clearInterval(
      timerInterval
    );

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
      )

      / 1000

    )

  );

}


function renderOverlay() {

  if (!match)
    return;


  $("overlay")
  .classList
  .remove("hidden");


  $("matchDay")
  .textContent =

  match.matchDay

  ? `JORNADA ${match.matchDay}`

  : "CHILPA SPORT";


  $("homeName")
  .textContent =
  match.home.name;


  $("awayName")
  .textContent =
  match.away.name;


  $("homeScore")
  .textContent =
  match.home.score;


  $("awayScore")
  .textContent =
  match.away.score;


  $("homeFouls")
  .textContent =
  `Faltas ${match.home.fouls}`;


  $("awayFouls")
  .textContent =
  `Faltas ${match.away.fouls}`;


  $("quarter")
  .textContent =
  `Q${match.quarter}`;


  $("timer")
  .textContent =
  formatTime(
    match.secondsRemaining
  );


  /*
  PARTIDO FINALIZADO
  */

  if (match.finalized) {

    showFinalResult();

  }
  else {

    $("finalScreen")
    .classList
    .add("hidden");

  }

}


function showFinalResult() {

  $("finalResult")
  .textContent =

  `${match.home.score} - ${match.away.score}`;


  let message =
  "PARTIDO FINALIZADO";


  if (
    match.winner &&
    match[match.winner]
  ) {

    message =

    `${match[match.winner].name} GANÓ`;

  }


  $("finalWinner")
  .textContent =
  message;


  $("finalScreen")
  .classList
  .remove("hidden");

}


function renderTimerOnly() {

  if (!match)
    return;


  $("timer")
  .textContent =

  formatTime(
    match.secondsRemaining
  );

}


function formatTime(
  totalSeconds
) {

  const safe =
  Math.max(

    0,

    Number(
      totalSeconds
    ) || 0

  );


  const minutes =
  Math.floor(
    safe / 60
  );


  const seconds =
  safe % 60;


  return (

    `${String(minutes)
    .padStart(2, "0")}:`

    +

    `${String(seconds)
    .padStart(2, "0")}`

  );

}