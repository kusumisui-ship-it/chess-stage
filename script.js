const appShell = document.getElementById("appShell");

const homeScreen = document.getElementById("homeScreen");
const gameScreen = document.getElementById("gameScreen");

const matchPanel = document.getElementById("matchPanel");
const boxPanel = document.getElementById("boxPanel");
const matchButton = document.getElementById("matchButton");
const boxButton = document.getElementById("boxButton");
const brandButton = document.getElementById("brandButton");
const localMatchButton = document.getElementById("localMatchButton");

const navButtons = document.querySelectorAll(".nav-button");
const subActions = document.querySelectorAll(".sub-action");

const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");

const chessBoardEl = document.getElementById("chessBoard");
const gameStatusEl = document.getElementById("gameStatus");
const whiteTurnMark = document.getElementById("whiteTurnMark");
const blackTurnMark = document.getElementById("blackTurnMark");

const leaveGameButton = document.getElementById("leaveGameButton");
const flipBoardButton = document.getElementById("flipBoardButton");
const assistButton = document.getElementById("assistButton");
const assistState = document.getElementById("assistState");
const resignButton = document.getElementById("resignButton");

const promotionOverlay = document.getElementById("promotionOverlay");
const promotionChoices = document.getElementById("promotionChoices");

const resultOverlay = document.getElementById("resultOverlay");
const resultTitle = document.getElementById("resultTitle");
const resultDescription = document.getElementById("resultDescription");
const rematchButton = document.getElementById("rematchButton");
const resultHomeButton = document.getElementById("resultHomeButton");

let toastTimer = null;

function showToast(message) {
  clearTimeout(toastTimer);
  toastText.textContent = message;
  toast.classList.add("visible");
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1400);
}

/* HOME UI */

function closePanel(panel, button) {
  panel.classList.remove("open");
  button.setAttribute("aria-expanded", "false");
}

function openPanel(panel, button) {
  panel.classList.add("open");
  button.setAttribute("aria-expanded", "true");
}

function resetPanelVisibility() {
  matchPanel.classList.remove("panel-hidden");
  boxPanel.classList.remove("panel-hidden");
}

function setMenuActiveState() {
  const open =
    matchPanel.classList.contains("open") ||
    boxPanel.classList.contains("open");

  appShell.classList.toggle("menu-active", open);
}

function closeAllPanels() {
  closePanel(matchPanel, matchButton);
  closePanel(boxPanel, boxButton);
  resetPanelVisibility();
  setMenuActiveState();
}

function togglePanel(targetPanel, targetButton, otherPanel) {
  const isOpen = targetPanel.classList.contains("open");
  closeAllPanels();

  if (!isOpen) {
    openPanel(targetPanel, targetButton);
    otherPanel.classList.add("panel-hidden");
  }

  setMenuActiveState();
}

matchButton.addEventListener("click", () => {
  togglePanel(matchPanel, matchButton, boxPanel);
});

boxButton.addEventListener("click", () => {
  togglePanel(boxPanel, boxButton, matchPanel);
});

brandButton.addEventListener("click", closeAllPanels);

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    navButtons.forEach((nav) => nav.classList.remove("active"));
    button.classList.add("active");

    const target = button.dataset.nav;

    if (target === "home") {
      closeAllPanels();
      return;
    }

    if (target === "box") {
      closeAllPanels();
      openPanel(boxPanel, boxButton);
      matchPanel.classList.add("panel-hidden");
      setMenuActiveState();
      showToast("BOX — Task 6");
      return;
    }

    if (target === "shop") {
      closeAllPanels();
      showToast("SHOP — Task 7");
      return;
    }

    if (target === "menu") {
      closeAllPanels();
      showToast("MENU");
    }
  });
});

subActions.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    const box = button.dataset.box;

    if (mode === "free" || mode === "rank") {
      showToast("ONLINE — Task 4");
      return;
    }

    if (mode === "spectate") {
      showToast("WATCH — Task 8");
      return;
    }

    if (box) {
      showToast("BOX — Task 6");
    }
  });
});

/* CHESS ENGINE */

const PIECE_SYMBOLS = {
  wK: "♔",
  wQ: "♕",
  wR: "♖",
  wB: "♗",
  wN: "♘",
  wP: "♙",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟"
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

let game = null;
let selectedSquare = null;
let legalTargets = [];
let boardFlipped = false;
let assistEnabled = true;
let pendingPromotion = null;

function createGameFromFen(fen) {
  const [placement, turn, castling, ep, halfmove, fullmove] = fen.split(" ");
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  placement.split("/").forEach((rank, r) => {
    let file = 0;

    for (const char of rank) {
      if (/\d/.test(char)) {
        file += Number(char);
      } else {
        const color = char === char.toUpperCase() ? "w" : "b";
        const type = char.toUpperCase();
        board[r][file] = { color, type };
        file += 1;
      }
    }
  });

  return {
    board,
    turn,
    castling: castling === "-" ? "" : castling,
    enPassant: ep,
    halfmove: Number(halfmove),
    fullmove: Number(fullmove),
    history: [],
    over: false
  };
}

function cloneGame(source) {
  return {
    board: source.board.map((row) =>
      row.map((piece) => (piece ? { ...piece } : null))
    ),
    turn: source.turn,
    castling: source.castling,
    enPassant: source.enPassant,
    halfmove: source.halfmove,
    fullmove: source.fullmove,
    history: [...source.history],
    over: source.over
  };
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function squareName(r, c) {
  return "abcdefgh"[c] + (8 - r);
}

function squareCoords(name) {
  return {
    r: 8 - Number(name[1]),
    c: "abcdefgh".indexOf(name[0])
  };
}

function opposite(color) {
  return color === "w" ? "b" : "w";
}

function pieceCode(piece) {
  return piece ? piece.color + piece.type : "";
}

function findKing(board, color) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = board[r][c];
      if (piece && piece.color === color && piece.type === "K") {
        return { r, c };
      }
    }
  }

  return null;
}

function isSquareAttacked(board, r, c, byColor) {
  const pawnDir = byColor === "w" ? -1 : 1;
  const pawnRows = [r - pawnDir];

  for (const pr of pawnRows) {
    for (const dc of [-1, 1]) {
      const pc = c + dc;
      if (inBounds(pr, pc)) {
        const piece = board[pr][pc];
        if (piece && piece.color === byColor && piece.type === "P") {
          return true;
        }
      }
    }
  }

  const knightMoves = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];

  for (const [dr, dc] of knightMoves) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) continue;

    const piece = board[nr][nc];
    if (piece && piece.color === byColor && piece.type === "N") {
      return true;
    }
  }

  const kingMoves = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];

  for (const [dr, dc] of kingMoves) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) continue;

    const piece = board[nr][nc];
    if (piece && piece.color === byColor && piece.type === "K") {
      return true;
    }
  }

  const lines = [
    { dirs: [[-1, 0], [1, 0], [0, -1], [0, 1]], types: ["R", "Q"] },
    { dirs: [[-1, -1], [-1, 1], [1, -1], [1, 1]], types: ["B", "Q"] }
  ];

  for (const group of lines) {
    for (const [dr, dc] of group.dirs) {
      let nr = r + dr;
      let nc = c + dc;

      while (inBounds(nr, nc)) {
        const piece = board[nr][nc];

        if (piece) {
          if (piece.color === byColor && group.types.includes(piece.type)) {
            return true;
          }
          break;
        }

        nr += dr;
        nc += dc;
      }
    }
  }

  return false;
}

function isInCheck(position, color) {
  const king = findKing(position.board, color);
  if (!king) return false;
  return isSquareAttacked(position.board, king.r, king.c, opposite(color));
}

function pushMove(moves, fromR, fromC, toR, toC, extra = {}) {
  moves.push({
    from: squareName(fromR, fromC),
    to: squareName(toR, toC),
    ...extra
  });
}

function generatePseudoMoves(position, color) {
  const moves = [];
  const board = position.board;

  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;

      if (piece.type === "P") {
        const dir = color === "w" ? -1 : 1;
        const startRank = color === "w" ? 6 : 1;
        const promotionRank = color === "w" ? 0 : 7;

        const oneR = r + dir;
        if (inBounds(oneR, c) && !board[oneR][c]) {
          if (oneR === promotionRank) {
            for (const promo of ["Q", "R", "B", "N"]) {
              pushMove(moves, r, c, oneR, c, { promotion: promo });
            }
          } else {
            pushMove(moves, r, c, oneR, c);
          }

          const twoR = r + dir * 2;
          if (r === startRank && !board[twoR][c]) {
            pushMove(moves, r, c, twoR, c);
          }
        }

        for (const dc of [-1, 1]) {
          const tr = r + dir;
          const tc = c + dc;
          if (!inBounds(tr, tc)) continue;

          const target = board[tr][tc];
          const targetSquare = squareName(tr, tc);

          if (target && target.color !== color) {
            if (tr === promotionRank) {
              for (const promo of ["Q", "R", "B", "N"]) {
                pushMove(moves, r, c, tr, tc, { promotion: promo });
              }
            } else {
              pushMove(moves, r, c, tr, tc);
            }
          }

          if (position.enPassant === targetSquare) {
            pushMove(moves, r, c, tr, tc, { enPassant: true });
          }
        }
      }

      if (piece.type === "N") {
        const deltas = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1]
        ];

        for (const [dr, dc] of deltas) {
          const tr = r + dr;
          const tc = c + dc;
          if (!inBounds(tr, tc)) continue;

          const target = board[tr][tc];
          if (!target || target.color !== color) {
            pushMove(moves, r, c, tr, tc);
          }
        }
      }

      if (["B", "R", "Q"].includes(piece.type)) {
        const dirs = [];

        if (piece.type === "B" || piece.type === "Q") {
          dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        }

        if (piece.type === "R" || piece.type === "Q") {
          dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        }

        for (const [dr, dc] of dirs) {
          let tr = r + dr;
          let tc = c + dc;

          while (inBounds(tr, tc)) {
            const target = board[tr][tc];

            if (!target) {
              pushMove(moves, r, c, tr, tc);
            } else {
              if (target.color !== color) {
                pushMove(moves, r, c, tr, tc);
              }
              break;
            }

            tr += dr;
            tc += dc;
          }
        }
      }

      if (piece.type === "K") {
        const deltas = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1], [0, 1],
          [1, -1], [1, 0], [1, 1]
        ];

        for (const [dr, dc] of deltas) {
          const tr = r + dr;
          const tc = c + dc;
          if (!inBounds(tr, tc)) continue;

          const target = board[tr][tc];
          if (!target || target.color !== color) {
            pushMove(moves, r, c, tr, tc);
          }
        }

        if (!isInCheck(position, color)) {
          if (
            color === "w" &&
            r === 7 &&
            c === 4
          ) {
            if (
              position.castling.includes("K") &&
              !board[7][5] &&
              !board[7][6] &&
              !isSquareAttacked(board, 7, 5, "b") &&
              !isSquareAttacked(board, 7, 6, "b")
            ) {
              pushMove(moves, r, c, 7, 6, { castle: "K" });
            }

            if (
              position.castling.includes("Q") &&
              !board[7][1] &&
              !board[7][2] &&
              !board[7][3] &&
              !isSquareAttacked(board, 7, 3, "b") &&
              !isSquareAttacked(board, 7, 2, "b")
            ) {
              pushMove(moves, r, c, 7, 2, { castle: "Q" });
            }
          }

          if (
            color === "b" &&
            r === 0 &&
            c === 4
          ) {
            if (
              position.castling.includes("k") &&
              !board[0][5] &&
              !board[0][6] &&
              !isSquareAttacked(board, 0, 5, "w") &&
              !isSquareAttacked(board, 0, 6, "w")
            ) {
              pushMove(moves, r, c, 0, 6, { castle: "k" });
            }

            if (
              position.castling.includes("q") &&
              !board[0][1] &&
              !board[0][2] &&
              !board[0][3] &&
              !isSquareAttacked(board, 0, 3, "w") &&
              !isSquareAttacked(board, 0, 2, "w")
            ) {
              pushMove(moves, r, c, 0, 2, { castle: "q" });
            }
          }
        }
      }
    }
  }

  return moves;
}

function applyMove(position, move) {
  const next = cloneGame(position);
  const from = squareCoords(move.from);
  const to = squareCoords(move.to);
  const piece = next.board[from.r][from.c];
  const captured = next.board[to.r][to.c];

  next.board[from.r][from.c] = null;

  if (move.enPassant) {
    const captureR = piece.color === "w" ? to.r + 1 : to.r - 1;
    next.board[captureR][to.c] = null;
  }

  next.board[to.r][to.c] = {
    color: piece.color,
    type: move.promotion || piece.type
  };

  if (move.castle) {
    if (move.castle === "K") {
      next.board[7][5] = next.board[7][7];
      next.board[7][7] = null;
    }

    if (move.castle === "Q") {
      next.board[7][3] = next.board[7][0];
      next.board[7][0] = null;
    }

    if (move.castle === "k") {
      next.board[0][5] = next.board[0][7];
      next.board[0][7] = null;
    }

    if (move.castle === "q") {
      next.board[0][3] = next.board[0][0];
      next.board[0][0] = null;
    }
  }

  if (piece.type === "K") {
    next.castling = next.castling
      .replace(piece.color === "w" ? /K|Q/g : /k|q/g, "");
  }

  if (piece.type === "R") {
    if (move.from === "a1") next.castling = next.castling.replace("Q", "");
    if (move.from === "h1") next.castling = next.castling.replace("K", "");
    if (move.from === "a8") next.castling = next.castling.replace("q", "");
    if (move.from === "h8") next.castling = next.castling.replace("k", "");
  }

  if (captured && captured.type === "R") {
    if (move.to === "a1") next.castling = next.castling.replace("Q", "");
    if (move.to === "h1") next.castling = next.castling.replace("K", "");
    if (move.to === "a8") next.castling = next.castling.replace("q", "");
    if (move.to === "h8") next.castling = next.castling.replace("k", "");
  }

  if (piece.type === "P" && Math.abs(to.r - from.r) === 2) {
    const epR = (from.r + to.r) / 2;
    next.enPassant = squareName(epR, from.c);
  } else {
    next.enPassant = "-";
  }

  next.turn = opposite(position.turn);

  if (piece.color === "b") {
    next.fullmove += 1;
  }

  if (piece.type === "P" || captured || move.enPassant) {
    next.halfmove = 0;
  } else {
    next.halfmove += 1;
  }

  next.history.push({
    ...move,
    piece: pieceCode(piece),
    capture: Boolean(captured || move.enPassant)
  });

  return next;
}

function legalMoves(position, color = position.turn) {
  return generatePseudoMoves(position, color).filter((move) => {
    const next = applyMove(position, move);
    return !isInCheck(next, color);
  });
}

function gameEndState(position) {
  const moves = legalMoves(position, position.turn);
  const inCheck = isInCheck(position, position.turn);

  if (moves.length === 0 && inCheck) {
    return {
      over: true,
      reason: "CHECKMATE",
      winner: opposite(position.turn)
    };
  }

  if (moves.length === 0 && !inCheck) {
    return {
      over: true,
      reason: "STALEMATE",
      winner: null
    };
  }

  return {
    over: false
  };
}

/* RENDER */

function renderBoard() {
  chessBoardEl.innerHTML = "";

  const order = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      order.push({ r, c });
    }
  }

  if (boardFlipped) {
    order.reverse();
  }

  const kingInCheck = isInCheck(game, game.turn)
    ? findKing(game.board, game.turn)
    : null;

  order.forEach(({ r, c }) => {
    const square = document.createElement("button");
    square.type = "button";
    square.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
    square.dataset.square = squareName(r, c);

    if (selectedSquare === squareName(r, c)) {
      square.classList.add("selected");
    }

    const target = legalTargets.find((move) => move.to === squareName(r, c));
    if (assistEnabled && target) {
      const to = squareCoords(target.to);
      const piece = game.board[to.r][to.c];
      square.classList.add(piece || target.enPassant ? "capture" : "legal");
    }

    if (kingInCheck && kingInCheck.r === r && kingInCheck.c === c) {
      square.classList.add("check");
    }

    const piece = game.board[r][c];
    if (piece) {
      const pieceEl = document.createElement("span");
      pieceEl.className = `piece ${piece.color === "w" ? "white" : "black"}`;
      pieceEl.textContent = PIECE_SYMBOLS[pieceCode(piece)];
      square.appendChild(pieceEl);
    }

    if ((!boardFlipped && r === 7) || (boardFlipped && r === 0)) {
      const file = document.createElement("span");
      file.className = "coordinate file";
      file.textContent = squareName(r, c)[0].toUpperCase();
      square.appendChild(file);
    }

    if ((!boardFlipped && c === 0) || (boardFlipped && c === 7)) {
      const rank = document.createElement("span");
      rank.className = "coordinate rank";
      rank.textContent = squareName(r, c)[1];
      square.appendChild(rank);
    }

    square.addEventListener("click", () => handleSquareTap(squareName(r, c)));
    chessBoardEl.appendChild(square);
  });

  renderStatus();
}

function renderStatus() {
  const end = gameEndState(game);

  if (end.over) {
    gameStatusEl.textContent = end.reason;
    gameStatusEl.classList.remove("check");
  } else {
    const turnText = game.turn === "w" ? "WHITE TO MOVE" : "BLACK TO MOVE";
    const check = isInCheck(game, game.turn);
    gameStatusEl.textContent = check ? `${turnText} — CHECK` : turnText;
    gameStatusEl.classList.toggle("check", check);
  }

  whiteTurnMark.classList.toggle("active", game.turn === "w");
  blackTurnMark.classList.toggle("active", game.turn === "b");

  whiteTurnMark.textContent = game.turn === "w" ? "MOVE" : "WAIT";
  blackTurnMark.textContent = game.turn === "b" ? "MOVE" : "WAIT";
}

/* INPUT */

function handleSquareTap(square) {
  if (game.over || pendingPromotion) return;

  const { r, c } = squareCoords(square);
  const piece = game.board[r][c];

  const chosen = legalTargets.find((move) => move.to === square);

  if (selectedSquare && chosen) {
    if (chosen.promotion) {
      pendingPromotion = chosen;
      showPromotion(chosen);
      return;
    }

    commitMove(chosen);
    return;
  }

  if (piece && piece.color === game.turn) {
    selectedSquare = square;
    legalTargets = legalMoves(game).filter((move) => move.from === square);
    renderBoard();
    return;
  }

  selectedSquare = null;
  legalTargets = [];
  renderBoard();
}

function commitMove(move) {
  game = applyMove(game, move);
  selectedSquare = null;
  legalTargets = [];
  pendingPromotion = null;
  hidePromotion();
  renderBoard();

  const end = gameEndState(game);

  if (end.over) {
    game.over = true;
    setTimeout(() => showResult(end), 250);
    return;
  }

  if (game.turn === "b") {
    setTimeout(cpuMove, 500);
  }
}
function cpuMove() {
  if (!game || game.over || game.turn !== "b") return;

  const moves = legalMoves(game);
  if (!moves.length) return;

  const values = {
    P: 1,
    N: 3,
    B: 3,
    R: 5,
    Q: 9,
    K: 100
  };

  const captures = moves.filter((move) => {
    const to = squareCoords(move.to);
    const target = game.board[to.r][to.c];
    return target && target.color === "w";
  });

  const pool = captures.length ? captures : moves;

  pool.sort((a, b) => {
    const aTo = squareCoords(a.to);
    const bTo = squareCoords(b.to);
    const aTarget = game.board[aTo.r][aTo.c];
    const bTarget = game.board[bTo.r][bTo.c];

    return (values[bTarget?.type] || 0) - (values[aTarget?.type] || 0);
  });

  const bestValue = (() => {
    const to = squareCoords(pool[0].to);
    const target = game.board[to.r][to.c];
    return values[target?.type] || 0;
  })();

  const bestMoves = pool.filter((move) => {
    const to = squareCoords(move.to);
    const target = game.board[to.r][to.c];
    return (values[target?.type] || 0) === bestValue;
  });

  const move = bestMoves[Math.floor(Math.random() * bestMoves.length)];

  if (move.promotion) {
    move.promotion = "Q";
  }

  commitMove(move);
}

function showPromotion(move) {
  promotionChoices.innerHTML = "";
  promotionOverlay.classList.add("visible");
  promotionOverlay.setAttribute("aria-hidden", "false");

  const color = game.turn;
  const choices = ["Q", "R", "B", "N"];

  choices.forEach((type) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "promotion-choice";
    button.textContent = PIECE_SYMBOLS[color + type];

    button.addEventListener("click", () => {
      commitMove({
        ...move,
        promotion: type
      });
    });

    promotionChoices.appendChild(button);
  });
}

function hidePromotion() {
  promotionOverlay.classList.remove("visible");
  promotionOverlay.setAttribute("aria-hidden", "true");
}

function showResult(end) {
  resultOverlay.classList.add("visible");
  resultOverlay.setAttribute("aria-hidden", "false");

  resultTitle.textContent = end.reason;

  if (end.winner === "w") {
    resultDescription.textContent = "WHITE WINS";
  } else if (end.winner === "b") {
    resultDescription.textContent = "BLACK WINS";
  } else {
    resultDescription.textContent = "DRAW";
  }
}

function hideResult() {
  resultOverlay.classList.remove("visible");
  resultOverlay.setAttribute("aria-hidden", "true");
}

function startLocalGame() {
  game = createGameFromFen(START_FEN);
  selectedSquare = null;
  legalTargets = [];
  pendingPromotion = null;
  hideResult();
  hidePromotion();

  homeScreen.classList.remove("active");
  gameScreen.classList.add("active");

  renderBoard();
}

function goHome() {
  gameScreen.classList.remove("active");
  homeScreen.classList.add("active");
  hideResult();
  hidePromotion();
}

/* GAME BUTTONS */

localMatchButton.addEventListener("click", startLocalGame);

leaveGameButton.addEventListener("click", goHome);

flipBoardButton.addEventListener("click", () => {
  boardFlipped = !boardFlipped;
  renderBoard();
});

assistButton.addEventListener("click", () => {
  assistEnabled = !assistEnabled;
  assistButton.classList.toggle("active", assistEnabled);
  assistState.textContent = assistEnabled ? "ON" : "OFF";
  renderBoard();
});

resignButton.addEventListener("click", () => {
  if (!game || game.over) return;

  game.over = true;
  showResult({
    over: true,
    reason: "RESIGN",
    winner: opposite(game.turn)
  });
});

rematchButton.addEventListener("click", startLocalGame);
resultHomeButton.addEventListener("click", goHome);