"use strict";

function currentPgn() {
  if (!session) return "";
  const result = session.result || (session.game.over ? session.game.result : null);
  return E.toPgn(session.game, {
    result,
    white: session.config.mode === "cpu" && session.config.playerColor === "w" ? "You" : session.config.mode === "cpu" ? `CPU ${difficultyLabel(session.config.difficulty)}` : "Player 1",
    black: session.config.mode === "cpu" && session.config.playerColor === "b" ? "You" : session.config.mode === "cpu" ? `CPU ${difficultyLabel(session.config.difficulty)}` : "Player 2"
  });
}

function startClockLoop() {
  stopClockLoop();
  if (!session?.clocks || session.game.over) return;
  clockLastTick = Date.now();
  lastClockSave = clockLastTick;
  clockTimer = setInterval(tickClock, 250);
}

function stopClockLoop() {
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = null;
}

function tickClock() {
  if (!session?.clocks || session.game.over) return;
  const now = Date.now();
  if (!clockLastTick) clockLastTick = now;
  const delta = Math.max(0, now - clockLastTick);
  clockLastTick = now;
  const turn = session.game.turn;
  session.clocks[turn] = Math.max(0, session.clocks[turn] - delta);
  const topColor = session.boardFlipped ? "w" : "b";
  const bottomColor = session.boardFlipped ? "b" : "w";
  updateClockElements(topColor, bottomColor);
  if (session.clocks[turn] <= 0) {
    const opponent = E.opposite(turn);
    const opponentCanMate = E.hasBasicMatingMaterial(session.game, opponent);
    finalizeGame({ over: true, reason: opponentCanMate ? "TIMEOUT" : "TIMEOUT DRAW", winner: opponentCanMate ? opponent : null });
    return;
  }
  if (now - lastClockSave > 5000) {
    lastClockSave = now;
    saveSession();
  }
}

function deleteRecord(id) {
  if (!window.confirm("この棋譜を削除しますか？")) return;
  records = records.filter((record) => record.id !== id);
  safeWrite(STORAGE.records, records);
  closeModal();
  renderView();
  showToast("棋譜を削除しました");
}

function clearRecords() {
  if (!window.confirm("保存した棋譜をすべて削除しますか？")) return;
  records = [];
  safeWrite(STORAGE.records, records);
  renderView();
  showToast("棋譜を削除しました");
}

function resetAllData() {
  if (!window.confirm("CHESS STAGEのローカルデータをすべて初期化しますか？")) return;
  settings = { ...DEFAULT_SETTINGS };
  records = [];
  completedLessons = [];
  savedSession = null;
  session = null;
  Object.values(STORAGE).forEach(safeRemove);
  setup = { mode: "cpu", difficulty: "normal", color: "white", clock: 0 };
  renderView();
  showToast("ローカルデータを初期化しました");
}

viewRoot.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.viewLink) return setView(target.dataset.viewLink);
  if (target.dataset.setupGroup) {
    const key = target.dataset.setupGroup;
    setup[key] = key === "clock" ? Number(target.dataset.setupValue) : target.dataset.setupValue;
    return renderView();
  }
  if (target.dataset.lessonId) return startLesson(target.dataset.lessonId);
  if (target.dataset.recordId) return openRecord(target.dataset.recordId);
  if (target.dataset.settingToggle) {
    const key = target.dataset.settingToggle;
    settings[key] = !settings[key];
    safeWrite(STORAGE.settings, settings);
    return renderView();
  }
  const action = target.dataset.action;
  if (action === "start") return startConfiguredGame();
  if (action === "open-setup") return openMatchSetupModal();
  if (action === "resume") return resumeGame();
  if (action === "fen") return openFenModal();
  if (action === "clear-records") return clearRecords();
  if (action === "delete-session") {
    if (savedSession && window.confirm("保存中の対局を削除しますか？")) {
      clearSavedSession();
      renderView();
      showToast("保存中の対局を削除しました");
    } else if (!savedSession) showToast("保存中の対局はありません");
    return;
  }
  if (action === "reset-all") return resetAllData();
});

modalRoot.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal-backdrop")) return closeModal();
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-close-modal")) return closeModal();
  if (target.dataset.setupGroup) {
    const key = target.dataset.setupGroup;
    setup[key] = key === "clock" ? Number(target.dataset.setupValue) : target.dataset.setupValue;
    return openMatchSetupModal();
  }
  if (target.dataset.fenMode) {
    modalRoot.querySelectorAll("[data-fen-mode]").forEach((button) => button.classList.toggle("active", button === target));
    return;
  }
  if (target.dataset.copyRecord) {
    const record = records.find((item) => item.id === target.dataset.copyRecord);
    if (record) copyText(record.pgn, "PGNをコピーしました");
    return;
  }
  if (target.dataset.deleteRecord) return deleteRecord(target.dataset.deleteRecord);
  const action = target.dataset.action;
  if (action === "start") return startConfiguredGame();
  if (action === "start-fen") return startFenGame();
  if (action === "copy-pgn") return copyText(currentPgn(), "PGNをコピーしました");
  if (action === "copy-fen") return copyText(E.toFen(session.game), "FENをコピーしました");
  if (action === "claim-draw") { closeModal(); return claimDraw(); }
  if (action === "restart") return restartGame();
  if (action === "resign") { closeModal(); return resign(); }
  if (action === "leave-game") { closeModal(); return leaveGame(); }
});

chessBoard.addEventListener("click", (event) => {
  const square = event.target.closest("[data-square]");
  if (square) handleSquareTap(square.dataset.square);
});

promotionChoices.addEventListener("click", (event) => {
  const button = event.target.closest("[data-promotion]");
  if (!button) return;
  const move = pendingPromotions.find((candidate) => candidate.promotion === button.dataset.promotion);
  if (move) commitMove(move, "human");
});

navButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
brandButton.addEventListener("click", () => setView("home"));
leaveGameButton.addEventListener("click", leaveGame);
gameMenuButton.addEventListener("click", openGameMenu);
undoButton.addEventListener("click", undoMove);
assistButton.addEventListener("click", () => {
  settings.showLegal = !settings.showLegal;
  safeWrite(STORAGE.settings, settings);
  renderGame();
});
flipBoardButton.addEventListener("click", () => {
  if (!session) return;
  session.boardFlipped = !session.boardFlipped;
  renderGame();
});
claimDrawButton.addEventListener("click", claimDraw);
copyPgnInlineButton.addEventListener("click", () => copyText(currentPgn(), "PGNをコピーしました"));
rematchButton.addEventListener("click", rematch);
resultRecordsButton.addEventListener("click", () => setView("records"));
resultHomeButton.addEventListener("click", () => setView(session?.lessonId ? "learn" : "home"));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (modalRoot.innerHTML) closeModal();
    else if (promotionOverlay.classList.contains("visible")) hidePromotion();
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && gameScreen.classList.contains("active")) {
    clockLastTick = Date.now();
    renderGame();
  }
});
window.addEventListener("beforeunload", () => {
  tickClock();
  saveSession();
});

renderView();
console.log("CHESS STAGE offline build ready", { records: records.length, lessons: completedLessons.length });
