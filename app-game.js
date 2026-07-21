"use strict";

function resolveColor(value) {
  if (value === "random") return Math.random() < .5 ? "w" : "b";
  return value === "black" ? "b" : "w";
}

function createSession(config, options = {}) {
  const playerColor = resolveColor(config.color);
  const clockMinutes = Number(config.clock) || 0;
  const game = E.createGameFromFen(options.fen || E.START_FEN);
  const localBottomColor = config.mode === "local" ? playerColor : playerColor;
  return {
    id: randomId("match"),
    config: { ...config, color: config.color, playerColor },
    game,
    startedAt: Date.now(),
    boardFlipped: localBottomColor === "b",
    clocks: clockMinutes ? { w: clockMinutes * 60_000, b: clockMinutes * 60_000 } : null,
    lessonId: options.lessonId || null,
    recorded: false,
    result: null
  };
}

function startConfiguredGame() {
  settings.defaultMode = setup.mode;
  settings.defaultDifficulty = setup.difficulty;
  settings.defaultColor = setup.color;
  settings.defaultClock = Number(setup.clock);
  safeWrite(STORAGE.settings, settings);
  startSession(createSession(setup));
}

function startSession(nextSession) {
  session = normalizeSession(nextSession);
  savedSession = session;
  selectedSquare = null;
  legalTargets = [];
  pendingPromotions = [];
  cpuThinking = false;
  hideResult();
  hidePromotion();
  closeModal();
  mainScreen.classList.remove("active");
  gameScreen.classList.add("active");
  saveSession();
  renderGame();
  startClockLoop();
  const initialStatus = E.status(session.game);
  if (initialStatus.over && !session.lessonId) finalizeGame(initialStatus);
  else scheduleCpuIfNeeded();
}

function resumeGame() {
  if (!savedSession || savedSession.game.over) {
    showToast("再開できる対局がありません");
    return;
  }
  startSession(savedSession);
}

function saveSession() {
  if (!session || session.game.over || session.lessonId) return;
  savedSession = session;
  safeWrite(STORAGE.session, session);
}

function clearSavedSession() {
  savedSession = null;
  safeRemove(STORAGE.session);
}

function startLesson(lessonId) {
  const lesson = LESSONS.find((item) => item.id === lessonId);
  if (!lesson) return;
  const lessonSession = createSession({ mode: "lesson", difficulty: "easy", color: "white", clock: 0 }, { fen: lesson.fen, lessonId });
  lessonSession.boardFlipped = false;
  startSession(lessonSession);
}

function openFenModal() {
  openModal(`
    <div class="modal-head"><h2>FEN START</h2><button class="close-button" type="button" data-close-modal>×</button></div>
    <div class="modal-section"><h3>FEN</h3><textarea id="fenInput" class="pgn-box" spellcheck="false" placeholder="${E.START_FEN}">${E.START_FEN}</textarea></div>
    <div class="modal-section"><h3>MODE</h3><div class="choice-row" style="--columns:2"><button class="choice-button active" type="button" data-fen-mode="cpu">CPU</button><button class="choice-button" type="button" data-fen-mode="local">LOCAL</button></div></div>
    <button class="primary-button full" type="button" data-action="start-fen">START POSITION</button>`);
}

function startFenGame() {
  const input = document.getElementById("fenInput");
  const activeMode = modalRoot.querySelector("[data-fen-mode].active")?.dataset.fenMode || "cpu";
  try {
    const fen = input.value.trim();
    const custom = createSession({ ...setup, mode: activeMode, color: activeMode === "cpu" ? setup.color : "white" }, { fen });
    closeModal();
    startSession(custom);
  } catch (error) {
    showToast("FENを読み込めませんでした");
  }
}

function renderGame() {
  if (!session) return;
  const game = session.game;
  const currentStatus = E.status(game);
  const flipped = session.boardFlipped;
  const topColor = flipped ? "w" : "b";
  const bottomColor = flipped ? "b" : "w";
  const playerDataTop = playerData(topColor);
  const playerDataBottom = playerData(bottomColor);
  const captures = E.capturedPieces(game);

  gameModeLabel.textContent = session.lessonId ? "LESSON" : session.config.mode === "local" ? "LOCAL MATCH" : `CPU ${difficultyLabel(session.config.difficulty)}`;
  topPlayerAvatar.textContent = topColor === "w" ? "♔" : "♚";
  bottomPlayerAvatar.textContent = bottomColor === "w" ? "♔" : "♚";
  topPlayerName.textContent = playerDataTop;
  bottomPlayerName.textContent = playerDataBottom;
  topCaptured.textContent = captureSymbols(topColor === "w" ? captures.capturedByWhite : captures.capturedByBlack);
  bottomCaptured.textContent = captureSymbols(bottomColor === "w" ? captures.capturedByWhite : captures.capturedByBlack);
  updateClockElements(topColor, bottomColor);

  chessBoard.innerHTML = "";
  const order = [];
  for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) order.push({ r, c });
  if (flipped) order.reverse();
  const last = game.history[game.history.length - 1];
  const checkedKing = currentStatus.check ? E.findKing(game.board, game.turn) : null;

  order.forEach(({ r, c }) => {
    const squareName = E.squareName(r, c);
    const square = document.createElement("button");
    square.type = "button";
    square.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
    square.dataset.square = squareName;
    square.setAttribute("role", "gridcell");
    square.setAttribute("aria-label", squareName);
    if (selectedSquare === squareName) square.classList.add("selected");
    if (settings.showLastMove && last && (last.from === squareName || last.to === squareName)) square.classList.add("last");
    const target = legalTargets.find((move) => move.to === squareName);
    if (settings.showLegal && target) {
      const coords = E.squareCoords(target.to);
      square.classList.add(game.board[coords.r][coords.c] || target.enPassant ? "capture" : "legal");
    }
    if (checkedKing && checkedKing.r === r && checkedKing.c === c) square.classList.add("check");
    const piece = game.board[r][c];
    if (piece) {
      const pieceEl = document.createElement("span");
      pieceEl.className = `piece ${piece.color === "w" ? "white" : "black"}`;
      pieceEl.textContent = PIECE_SYMBOLS[E.pieceCode(piece)];
      square.appendChild(pieceEl);
    }
    if (settings.showCoordinates) {
      const showFile = (!flipped && r === 7) || (flipped && r === 0);
      const showRank = (!flipped && c === 0) || (flipped && c === 7);
      if (showFile) {
        const file = document.createElement("span");
        file.className = "coordinate file";
        file.textContent = squareName[0].toUpperCase();
        square.appendChild(file);
      }
      if (showRank) {
        const rank = document.createElement("span");
        rank.className = "coordinate rank";
        rank.textContent = squareName[1];
        square.appendChild(rank);
      }
    }
    chessBoard.appendChild(square);
  });

  const lesson = LESSONS.find((item) => item.id === session.lessonId);
  if (lesson) {
    gameStatus.textContent = lesson.objective;
    gameStatus.classList.remove("check");
  } else if (cpuThinking) {
    gameStatus.textContent = "CPU THINKING";
    gameStatus.classList.remove("check");
  } else {
    const turn = game.turn === "w" ? "WHITE TO MOVE" : "BLACK TO MOVE";
    gameStatus.textContent = currentStatus.check ? `${turn} — CHECK` : turn;
    gameStatus.classList.toggle("check", currentStatus.check);
  }
  thinkingBadge.classList.toggle("visible", cpuThinking);
  thinkingBadge.setAttribute("aria-hidden", cpuThinking ? "false" : "true");
  assistButton.classList.toggle("active", settings.showLegal);
  undoButton.disabled = !game.history.length || cpuThinking || Boolean(session.lessonId);
  claimDrawButton.hidden = !currentStatus.canClaimDraw || Boolean(session.lessonId);
  renderMoveList();
}

function playerData(color) {
  if (session.lessonId) return color === "w" ? "YOU" : "LESSON POSITION";
  if (session.config.mode === "local") return color === "w" ? "WHITE — PLAYER 1" : "BLACK — PLAYER 2";
  if (color === session.config.playerColor) return color === "w" ? "WHITE — YOU" : "BLACK — YOU";
  return `${color === "w" ? "WHITE" : "BLACK"} — CPU ${difficultyLabel(session.config.difficulty)}`;
}

function captureSymbols(codes) {
  return [...codes]
    .sort((a, b) => (CAPTURE_ORDER[a[1]] ?? 9) - (CAPTURE_ORDER[b[1]] ?? 9))
    .map((code) => PIECE_SYMBOLS[code])
    .join("");
}

function renderMoveList() {
  const history = session.game.history;
  if (!history.length) {
    moveList.innerHTML = '<p class="empty-copy">対局を開始すると棋譜が表示されます。</p>';
    return;
  }
  let markup = "";
  for (let index = 0; index < history.length; index += 2) {
    const moveNumber = Math.floor(index / 2) + 1;
    markup += `<span class="move-number">${moveNumber}.</span>`;
    markup += `<span class="move-san ${index === history.length - 1 ? "latest" : ""}">${escapeHTML(history[index]?.san || "")}</span>`;
    markup += `<span class="move-san ${index + 1 === history.length - 1 ? "latest" : ""}">${escapeHTML(history[index + 1]?.san || "")}</span>`;
  }
  moveList.innerHTML = markup;
  requestAnimationFrame(() => { moveList.scrollTop = moveList.scrollHeight; });
}

function updateClockElements(topColor, bottomColor) {
  const topMs = session.clocks ? session.clocks[topColor] : null;
  const bottomMs = session.clocks ? session.clocks[bottomColor] : null;
  topClock.textContent = formatClock(topMs);
  bottomClock.textContent = formatClock(bottomMs);
  topClock.classList.toggle("active", session.game.turn === topColor && !session.game.over);
  bottomClock.classList.toggle("active", session.game.turn === bottomColor && !session.game.over);
  topClock.classList.toggle("low", topMs != null && topMs <= 30_000);
  bottomClock.classList.toggle("low", bottomMs != null && bottomMs <= 30_000);
}

function isHumanTurn() {
  if (!session || session.game.over || cpuThinking) return false;
  if (session.lessonId || session.config.mode === "local") return true;
  return session.game.turn === session.config.playerColor;
}

function handleSquareTap(square) {
  if (!isHumanTurn() || pendingPromotions.length) return;
  const game = session.game;
  const { r, c } = E.squareCoords(square);
  const piece = game.board[r][c];
  const matchingTargets = legalTargets.filter((move) => move.to === square);

  if (selectedSquare && matchingTargets.length) {
    if (matchingTargets.some((move) => move.promotion)) {
      pendingPromotions = matchingTargets;
      showPromotion();
    } else {
      commitMove(matchingTargets[0], "human");
    }
    return;
  }

  if (piece && piece.color === game.turn) {
    selectedSquare = square;
    legalTargets = E.legalMovesFrom(game, square);
  } else {
    selectedSquare = null;
    legalTargets = [];
  }
  renderGame();
}

function showPromotion() {
  promotionChoices.innerHTML = "";
  const color = session.game.turn;
  ["Q", "R", "B", "N"].forEach((type) => {
    const move = pendingPromotions.find((candidate) => candidate.promotion === type);
    if (!move) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "promotion-choice";
    button.dataset.promotion = type;
    button.textContent = PIECE_SYMBOLS[color + type];
    promotionChoices.appendChild(button);
  });
  promotionOverlay.classList.add("visible");
  promotionOverlay.setAttribute("aria-hidden", "false");
}

function hidePromotion() {
  promotionOverlay.classList.remove("visible");
  promotionOverlay.setAttribute("aria-hidden", "true");
  pendingPromotions = [];
}

function lessonAccepts(move) {
  const lesson = LESSONS.find((item) => item.id === session.lessonId);
  if (!lesson) return true;
  return lesson.expected.includes(E.moveKey(move).toLowerCase());
}

function commitMove(move, source) {
  if (!session || session.game.over) return;
  if (session.lessonId && source === "human" && !lessonAccepts(move)) {
    selectedSquare = null;
    legalTargets = [];
    hidePromotion();
    renderGame();
    showToast("その手では課題を達成できません");
    return;
  }

  tickClock();
  session.game = E.makeRecordedMove(session.game, move);
  selectedSquare = null;
  legalTargets = [];
  hidePromotion();

  if (session.lessonId) {
    const lesson = LESSONS.find((item) => item.id === session.lessonId);
    if (!completedLessons.includes(session.lessonId)) {
      completedLessons.push(session.lessonId);
      safeWrite(STORAGE.lessons, completedLessons);
    }
    finalizeGame({ over: true, reason: "LESSON CLEAR", winner: move.from ? E.opposite(session.game.turn) : null }, { record: false, lessonTitle: lesson?.title });
    return;
  }

  const currentStatus = E.status(session.game);
  if (currentStatus.over) {
    finalizeGame(currentStatus);
    return;
  }

  if (session.config.mode === "local" && settings.autoFlipLocal) session.boardFlipped = session.game.turn === "b";
  saveSession();
  renderGame();
  scheduleCpuIfNeeded();
}

function scheduleCpuIfNeeded() {
  cancelCpu();
  if (!session || session.game.over || session.config.mode !== "cpu" || session.game.turn === session.config.playerColor) return;
  cpuThinking = true;
  renderGame();
  cpuTimer = setTimeout(() => {
    cpuTimer = null;
    if (!session || session.game.over || session.config.mode !== "cpu" || session.game.turn === session.config.playerColor) {
      cpuThinking = false;
      renderGame();
      return;
    }
    try {
      const move = E.chooseCpuMove(session.game, session.config.difficulty);
      cpuThinking = false;
      if (!move) {
        const currentStatus = E.status(session.game);
        if (currentStatus.over) finalizeGame(currentStatus);
        return;
      }
      commitMove(move, "cpu");
    } catch (error) {
      cpuThinking = false;
      console.error("CPU move failed", error);
      renderGame();
      showToast("CPUの思考処理でエラーが発生しました");
    }
  }, 420);
}

function cancelCpu() {
  if (cpuTimer) clearTimeout(cpuTimer);
  cpuTimer = null;
  cpuThinking = false;
}

function undoMove() {
  if (!session || !session.game.history.length || session.lessonId) return;
  cancelCpu();
  const isCpu = session.config.mode === "cpu";
  let plies = 1;
  if (isCpu) {
    if (session.game.turn === session.config.playerColor && session.game.history.length >= 2) plies = 2;
    else plies = 1;
  }
  session.game = E.undo(session.game, plies);
  session.result = null;
  selectedSquare = null;
  legalTargets = [];
  if (session.config.mode === "cpu") session.boardFlipped = session.config.playerColor === "b";
  saveSession();
  renderGame();
  scheduleCpuIfNeeded();
  showToast("手を戻しました");
}

function claimDraw() {
  if (!session) return;
  const currentStatus = E.status(session.game);
  if (!currentStatus.canClaimDraw) {
    showToast("現在は引き分けを請求できません");
    return;
  }
  finalizeGame({ over: true, reason: currentStatus.claimReasons[0], winner: null });
}

function resign() {
  if (!session || session.game.over || session.lessonId) return;
  if (settings.confirmResign && !window.confirm("この対局を投了しますか？")) return;
  const winner = E.opposite(session.game.turn);
  finalizeGame({ over: true, reason: "RESIGN", winner });
}

function finalizeGame(result, options = {}) {
  if (!session || session.game.over) return;
  cancelCpu();
  stopClockLoop();
  session.game.over = true;
  session.game.result = { ...result };
  session.result = { ...result };
  clearSavedSession();
  renderGame();
  if (options.record !== false) recordFinishedGame();
  showResult(options.lessonTitle);
}

function recordFinishedGame() {
  if (!session || session.recorded) return;
  session.recorded = true;
  const result = session.result;
  let relativeResult = "draw";
  if (session.config.mode === "cpu" && result.winner) relativeResult = result.winner === session.config.playerColor ? "win" : "loss";
  else if (session.config.mode === "local" && result.winner) relativeResult = result.winner === "w" ? "white" : "black";
  const title = session.config.mode === "cpu"
    ? `YOU vs CPU ${difficultyLabel(session.config.difficulty)}`
    : "WHITE vs BLACK — LOCAL";
  const record = {
    id: randomId("record"),
    title,
    mode: session.config.mode,
    difficulty: session.config.difficulty,
    playerColor: session.config.playerColor,
    result,
    relativeResult,
    reason: result.reason,
    moveCount: session.game.history.length,
    duration: Date.now() - session.startedAt,
    finishedAt: Date.now(),
    finalFen: E.toFen(session.game),
    pgn: E.toPgn(session.game, {
      result,
      white: session.config.mode === "cpu" && session.config.playerColor === "w" ? "You" : session.config.mode === "cpu" ? `CPU ${difficultyLabel(session.config.difficulty)}` : "Player 1",
      black: session.config.mode === "cpu" && session.config.playerColor === "b" ? "You" : session.config.mode === "cpu" ? `CPU ${difficultyLabel(session.config.difficulty)}` : "Player 2"
    })
  };
  records = [record, ...records].slice(0, 100);
  safeWrite(STORAGE.records, records);
}

function showResult(lessonTitle = "") {
  if (!session?.result) return;
  const result = session.result;
  const isLesson = result.reason === "LESSON CLEAR";
  resultLabel.textContent = isLesson ? "TRAINING" : "GAME END";
  resultTitle.textContent = isLesson ? "CLEAR" : reasonLabel(result.reason).toUpperCase();
  if (isLesson) {
    resultDescription.textContent = lessonTitle || "LESSON COMPLETE";
  } else if (!result.winner) {
    resultDescription.textContent = "DRAW";
  } else if (session.config.mode === "cpu") {
    resultDescription.textContent = result.winner === session.config.playerColor ? "YOU WIN" : "YOU LOSE";
  } else {
    resultDescription.textContent = result.winner === "w" ? "WHITE WINS" : "BLACK WINS";
  }
  resultSummary.innerHTML = `
    <div><span>MOVES</span><strong>${session.game.history.length}</strong></div>
    <div><span>TIME</span><strong>${formatDuration(Date.now() - session.startedAt)}</strong></div>`;
  rematchButton.textContent = isLesson ? "RETRY LESSON" : "REMATCH";
  resultRecordsButton.style.display = isLesson ? "none" : "block";
  resultOverlay.classList.add("visible");
  resultOverlay.setAttribute("aria-hidden", "false");
}

function hideResult() {
  resultOverlay.classList.remove("visible");
  resultOverlay.setAttribute("aria-hidden", "true");
}

function rematch() {
  if (!session) return;
  const old = session;
  hideResult();
  if (old.lessonId) startLesson(old.lessonId);
  else startSession(createSession(old.config));
}

function openGameMenu() {
  if (!session) return;
  const currentStatus = E.status(session.game);
  openModal(`
    <div class="modal-head"><h2>Game Menu</h2><button class="close-button" type="button" data-close-modal>×</button></div>
    <div class="detail-grid">
      <div class="detail-item"><span>MODE</span><strong>${session.lessonId ? "LESSON" : session.config.mode.toUpperCase()}</strong></div>
      <div class="detail-item"><span>FEN MOVE</span><strong>${session.game.fullmove}</strong></div>
    </div>
    <div class="modal-section"><div class="menu-list">
      <button class="menu-button" type="button" data-close-modal><span>対局へ戻る</span><small>RESUME</small></button>
      <button class="menu-button" type="button" data-action="copy-pgn"><span>PGNをコピー</span><small>COPY</small></button>
      <button class="menu-button" type="button" data-action="copy-fen"><span>現在のFENをコピー</span><small>FEN</small></button>
      ${currentStatus.canClaimDraw && !session.lessonId ? '<button class="menu-button" type="button" data-action="claim-draw"><span>引き分けを請求</span><small>CLAIM</small></button>' : ""}
      <button class="menu-button" type="button" data-action="restart"><span>${session.lessonId ? "レッスンをやり直す" : "最初からやり直す"}</span><small>RESTART</small></button>
      ${session.lessonId ? "" : '<button class="menu-button danger" type="button" data-action="resign"><span>投了する</span><small>RESIGN</small></button>'}
      <button class="menu-button" type="button" data-action="leave-game"><span>ホームへ戻る</span><small>AUTO SAVE</small></button>
    </div></div>`);
}

function restartGame() {
  if (!session) return;
  if (!window.confirm(session.lessonId ? "レッスンを最初からやり直しますか？" : "この対局を最初からやり直しますか？")) return;
  closeModal();
  if (session.lessonId) startLesson(session.lessonId);
  else startSession(createSession(session.config));
}

function leaveGame() {
  if (!session) return setView("home");
  tickClock();
  cancelCpu();
  stopClockLoop();
  if (!session.game.over && !session.lessonId) saveSession();
  setView(session.lessonId ? "learn" : "home");
}

function openRecord(recordId) {
  const record = records.find((item) => item.id === recordId);
  if (!record) return;
  openModal(`
    <div class="modal-head"><h2>Game Record</h2><button class="close-button" type="button" data-close-modal>×</button></div>
    <div class="detail-grid">
      <div class="detail-item"><span>RESULT</span><strong>${record.relativeResult.toUpperCase()}</strong></div>
      <div class="detail-item"><span>MOVES</span><strong>${record.moveCount}</strong></div>
      <div class="detail-item"><span>END</span><strong>${escapeHTML(reasonLabel(record.reason))}</strong></div>
      <div class="detail-item"><span>TIME</span><strong>${formatDuration(record.duration)}</strong></div>
    </div>
    <div class="modal-section"><h3>PGN</h3><textarea class="pgn-box" readonly>${escapeHTML(record.pgn)}</textarea></div>
    <button class="primary-button full" type="button" data-copy-record="${escapeHTML(record.id)}">COPY PGN</button>
    <button class="danger-button full" style="margin-top:8px" type="button" data-delete-record="${escapeHTML(record.id)}">DELETE RECORD</button>`);
}

function openModal(content) {
  modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal-panel" role="dialog" aria-modal="true">${content}</div></div>`;
}

function closeModal() {
  modalRoot.innerHTML = "";
}

async function copyText(text, successMessage = "コピーしました") {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    showToast(successMessage);
  } catch (error) {
    showToast("コピーできませんでした");
  }
}
