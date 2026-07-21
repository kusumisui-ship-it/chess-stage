"use strict";

const E = window.ChessStageEngine;
if (!E) throw new Error("ChessStageEngine was not loaded");

const PIECE_SYMBOLS = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟"
};
const CAPTURE_ORDER = { Q: 0, R: 1, B: 2, N: 3, P: 4 };
const STORAGE = {
  settings: "chess-stage.settings.v2",
  records: "chess-stage.records.v2",
  session: "chess-stage.session.v2",
  lessons: "chess-stage.lessons.v2"
};

const DEFAULT_SETTINGS = {
  showLegal: true,
  showCoordinates: true,
  showLastMove: true,
  autoFlipLocal: false,
  confirmResign: true,
  defaultMode: "cpu",
  defaultDifficulty: "normal",
  defaultColor: "white",
  defaultClock: 0
};

const LESSONS = [
  {
    id: "escape-check",
    number: "01",
    title: "チェックから逃げる",
    summary: "王手を放置できないことを盤面で確認する。",
    objective: "白王でe2の黒ルークを取って、チェックを解除しよう。",
    fen: "4k3/8/8/8/8/8/4r3/4K3 w - - 0 1",
    expected: ["e1e2"]
  },
  {
    id: "castle",
    number: "02",
    title: "キャスリング",
    summary: "王とルークを一度に動かす特殊手。",
    objective: "白のキングサイドへキャスリングしよう。",
    fen: "4k3/8/8/8/8/8/8/4K2R w K - 0 1",
    expected: ["e1g1"]
  },
  {
    id: "en-passant",
    number: "03",
    title: "アンパッサン",
    summary: "直前に2マス進んだポーンを横取りする。",
    objective: "e5の白ポーンでアンパッサンを行おう。",
    fen: "7k/8/8/3pP3/8/8/8/K7 w - d6 0 1",
    expected: ["e5d6"]
  },
  {
    id: "promotion",
    number: "04",
    title: "プロモーション",
    summary: "最終段へ到達したポーンを好きな駒へ昇格。",
    objective: "a7のポーンをa8へ進め、クイーンへ昇格しよう。",
    fen: "7k/P7/8/8/8/8/8/K7 w - - 0 1",
    expected: ["a7a8q"]
  },
  {
    id: "mate-one",
    number: "05",
    title: "1手詰め",
    summary: "チェックではなく、逃げ道まで消して勝つ。",
    objective: "白クイーンをg7へ動かしてチェックメイトしよう。",
    fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
    expected: ["f7g7"]
  }
];

const mainScreen = document.getElementById("mainScreen");
const gameScreen = document.getElementById("gameScreen");
const viewRoot = document.getElementById("viewRoot");
const brandButton = document.getElementById("brandButton");
const navButtons = [...document.querySelectorAll(".nav-button")];
const chessBoard = document.getElementById("chessBoard");
const gameStatus = document.getElementById("gameStatus");
const gameModeLabel = document.getElementById("gameModeLabel");
const thinkingBadge = document.getElementById("thinkingBadge");
const topPlayerAvatar = document.getElementById("topPlayerAvatar");
const bottomPlayerAvatar = document.getElementById("bottomPlayerAvatar");
const topPlayerName = document.getElementById("topPlayerName");
const bottomPlayerName = document.getElementById("bottomPlayerName");
const topCaptured = document.getElementById("topCaptured");
const bottomCaptured = document.getElementById("bottomCaptured");
const topClock = document.getElementById("topClock");
const bottomClock = document.getElementById("bottomClock");
const moveList = document.getElementById("moveList");
const undoButton = document.getElementById("undoButton");
const assistButton = document.getElementById("assistButton");
const flipBoardButton = document.getElementById("flipBoardButton");
const claimDrawButton = document.getElementById("claimDrawButton");
const gameMenuButton = document.getElementById("gameMenuButton");
const leaveGameButton = document.getElementById("leaveGameButton");
const copyPgnInlineButton = document.getElementById("copyPgnInlineButton");
const modalRoot = document.getElementById("modalRoot");
const promotionOverlay = document.getElementById("promotionOverlay");
const promotionChoices = document.getElementById("promotionChoices");
const resultOverlay = document.getElementById("resultOverlay");
const resultLabel = document.getElementById("resultLabel");
const resultTitle = document.getElementById("resultTitle");
const resultDescription = document.getElementById("resultDescription");
const resultSummary = document.getElementById("resultSummary");
const rematchButton = document.getElementById("rematchButton");
const resultRecordsButton = document.getElementById("resultRecordsButton");
const resultHomeButton = document.getElementById("resultHomeButton");
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");

let settings = { ...DEFAULT_SETTINGS, ...safeRead(STORAGE.settings, {}) };
let records = safeRead(STORAGE.records, []);
let completedLessons = safeRead(STORAGE.lessons, []);
let savedSession = normalizeSession(safeRead(STORAGE.session, null));
let currentView = "home";
let setup = {
  mode: settings.defaultMode,
  difficulty: settings.defaultDifficulty,
  color: settings.defaultColor,
  clock: Number(settings.defaultClock) || 0
};
let session = null;
let selectedSquare = null;
let legalTargets = [];
let pendingPromotions = [];
let cpuTimer = null;
let cpuThinking = false;
let clockTimer = null;
let clockLastTick = 0;
let lastClockSave = 0;
let toastTimer = null;

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn("Storage read failed", key, error);
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("Storage write failed", key, error);
    return false;
  }
}

function safeRemove(key) {
  try { localStorage.removeItem(key); } catch (error) { console.warn(error); }
}

function normalizeSession(value) {
  if (!value || !value.game || !value.config) return null;
  value.game.history = Array.isArray(value.game.history) ? value.game.history : [];
  value.game.positionKeys = Array.isArray(value.game.positionKeys) && value.game.positionKeys.length
    ? value.game.positionKeys
    : [E.repetitionKey(value.game)];
  value.game.over = Boolean(value.game.over);
  value.boardFlipped = Boolean(value.boardFlipped);
  value.clocks = value.clocks || null;
  return value;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  clearTimeout(toastTimer);
  toastText.textContent = message;
  toast.classList.add("visible");
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1700);
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

function formatDuration(milliseconds) {
  const total = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatClock(milliseconds) {
  if (milliseconds == null) return "--:--";
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function randomId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function stats() {
  const cpu = records.filter((record) => record.mode === "cpu");
  const wins = cpu.filter((record) => record.relativeResult === "win").length;
  const losses = cpu.filter((record) => record.relativeResult === "loss").length;
  const draws = cpu.filter((record) => record.relativeResult === "draw").length;
  return { games: records.length, wins, losses, draws };
}

function setView(view) {
  currentView = view;
  mainScreen.classList.add("active");
  gameScreen.classList.remove("active");
  stopClockLoop();
  cancelCpu();
  closeModal();
  hideResult();
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  renderView();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderView() {
  if (currentView === "records") viewRoot.innerHTML = renderRecords();
  else if (currentView === "learn") viewRoot.innerHTML = renderLearn();
  else if (currentView === "settings") viewRoot.innerHTML = renderSettings();
  else viewRoot.innerHTML = renderHome();
}
