"use strict";

function legalMoves(position, color = position.turn) {
  return generatePseudoMoves(position, color).filter((move) => {
    const next = applyMove(position, move, { record: false });
    return !isInCheck(next, color);
  });
}

function legalMovesFrom(position, square) {
  return legalMoves(position).filter((move) => move.from === square);
}

function moveKey(move) {
  return `${move.from}${move.to}${move.promotion ? move.promotion.toLowerCase() : ""}`;
}

function matchMove(position, input) {
  const normalized = String(input || "").trim().toLowerCase();
  return legalMoves(position).find((move) => moveKey(move).toLowerCase() === normalized) || null;
}

function hasLegalEnPassant(position) {
  if (!position.enPassant || position.enPassant === "-") return false;
  return legalMoves(position).some((move) => move.enPassant);
}

function repetitionKey(position) {
  const ep = hasLegalEnPassant(position) ? position.enPassant : "-";
  return `${boardPlacement(position.board)} ${position.turn} ${position.castling || "-"} ${ep}`;
}

function repetitionCount(position) {
  const key = repetitionKey(position);
  return position.positionKeys.filter((item) => item === key).length;
}

function isInsufficientMaterial(position) {
  const pieces = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = position.board[r][c];
      if (piece && piece.type !== "K") pieces.push({ ...piece, r, c });
    }
  }
  if (!pieces.length) return true;
  if (pieces.some((piece) => ["P", "R", "Q"].includes(piece.type))) return false;
  if (pieces.length === 1 && ["B", "N"].includes(pieces[0].type)) return true;
  if (pieces.every((piece) => piece.type === "B")) {
    const squareColors = new Set(pieces.map((piece) => (piece.r + piece.c) % 2));
    if (squareColors.size === 1) return true;
  }
  return false;
}

function hasBasicMatingMaterial(position, color) {
  const pieces = [];
  for (const row of position.board) {
    for (const piece of row) {
      if (piece && piece.color === color && piece.type !== "K") pieces.push(piece.type);
    }
  }
  if (pieces.some((type) => ["P", "R", "Q"].includes(type))) return true;
  const bishops = pieces.filter((type) => type === "B").length;
  const knights = pieces.filter((type) => type === "N").length;
  return bishops + knights >= 2;
}

function status(position) {
  const moves = legalMoves(position);
  const check = isInCheck(position, position.turn);
  if (!moves.length) {
    if (check) {
      return { over: true, reason: "CHECKMATE", winner: opposite(position.turn), check: true, canClaimDraw: false, claimReasons: [] };
    }
    return { over: true, reason: "STALEMATE", winner: null, check: false, canClaimDraw: false, claimReasons: [] };
  }
  if (isInsufficientMaterial(position)) {
    return { over: true, reason: "DEAD POSITION", winner: null, check, canClaimDraw: false, claimReasons: [] };
  }
  const repeats = repetitionCount(position);
  if (repeats >= 5) {
    return { over: true, reason: "FIVEFOLD REPETITION", winner: null, check, canClaimDraw: false, claimReasons: [] };
  }
  if (position.halfmove >= 150) {
    return { over: true, reason: "75-MOVE RULE", winner: null, check, canClaimDraw: false, claimReasons: [] };
  }
  const claimReasons = [];
  if (repeats >= 3) claimReasons.push("THREEFOLD REPETITION");
  if (position.halfmove >= 100) claimReasons.push("50-MOVE RULE");
  return {
    over: false,
    reason: "",
    winner: null,
    check,
    canClaimDraw: claimReasons.length > 0,
    claimReasons
  };
}

function moveToSan(position, move) {
  const from = squareCoords(move.from);
  const to = squareCoords(move.to);
  const piece = position.board[from.r][from.c];
  if (!piece) return moveKey(move);

  let san = "";
  if (move.castle === "K") san = "O-O";
  else if (move.castle === "Q") san = "O-O-O";
  else {
    const target = position.board[to.r][to.c];
    const capture = Boolean(target || move.enPassant);
    if (piece.type !== "P") {
      san += piece.type;
      const alternatives = legalMoves(position).filter((candidate) => {
        if (candidate.from === move.from || candidate.to !== move.to) return false;
        const coords = squareCoords(candidate.from);
        const other = position.board[coords.r][coords.c];
        return other && other.color === piece.color && other.type === piece.type;
      });
      if (alternatives.length) {
        const sameFile = alternatives.some((candidate) => candidate.from[0] === move.from[0]);
        const sameRank = alternatives.some((candidate) => candidate.from[1] === move.from[1]);
        if (!sameFile) san += move.from[0];
        else if (!sameRank) san += move.from[1];
        else san += move.from;
      }
    } else if (capture) {
      san += move.from[0];
    }
    if (capture) san += "x";
    san += move.to;
    if (move.promotion) san += `=${move.promotion}`;
  }

  const next = applyMove(position, move, { record: false });
  const nextStatus = status(next);
  if (nextStatus.over && nextStatus.reason === "CHECKMATE") san += "#";
  else if (isInCheck(next, next.turn)) san += "+";
  return san;
}

function makeRecordedMove(position, move) {
  const san = moveToSan(position, move);
  return applyMove(position, move, { record: true, san });
}

function undo(position, plies = 1) {
  const history = position.history || [];
  if (!history.length) return clonePosition(position);
  const targetIndex = Math.max(0, history.length - Math.max(1, plies));
  const fen = history[targetIndex]?.fenBefore || START_FEN;
  const restored = createGameFromFen(fen);
  restored.history = history.slice(0, targetIndex).map((item) => ({ ...item }));
  restored.positionKeys = [];
  const initialFen = restored.history[0]?.fenBefore || fen;
  let replay = createGameFromFen(initialFen);
  const kept = restored.history;
  replay.history = [];
  replay.positionKeys = [repetitionKey(replay)];
  kept.forEach((entry) => {
    const move = matchMove(replay, `${entry.from}${entry.to}${entry.promotion ? entry.promotion.toLowerCase() : ""}`);
    if (move) replay = applyMove(replay, move, { record: true, san: entry.san });
  });
  replay.over = false;
  replay.result = null;
  return replay;
}

function capturedPieces(position) {
  const capturedByWhite = [];
  const capturedByBlack = [];
  position.history.forEach((entry) => {
    if (!entry.captured) return;
    if (entry.piece[0] === "w") capturedByWhite.push(entry.captured);
    else capturedByBlack.push(entry.captured);
  });
  return { capturedByWhite, capturedByBlack };
}

function resultToken(result) {
  if (!result) return "*";
  if (result.winner === "w") return "1-0";
  if (result.winner === "b") return "0-1";
  return "1/2-1/2";
}

function toPgn(position, metadata = {}) {
  const result = metadata.result || position.result;
  const headers = {
    Event: metadata.event || "CHESS STAGE Offline Match",
    Site: metadata.site || "CHESS STAGE",
    Date: metadata.date || new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    Round: metadata.round || "-",
    White: metadata.white || "White",
    Black: metadata.black || "Black",
    Result: resultToken(result),
    ...metadata.headers
  };
  const headerText = Object.entries(headers)
    .map(([key, value]) => `[${key} "${String(value).replace(/"/g, "'")}"]`)
    .join("\n");
  const moves = [];
  position.history.forEach((entry, index) => {
    if (index % 2 === 0) moves.push(`${Math.floor(index / 2) + 1}. ${entry.san || entry.from + entry.to}`);
    else moves[moves.length - 1] += ` ${entry.san || entry.from + entry.to}`;
  });
  const body = `${moves.join(" ")} ${resultToken(result)}`.trim();
  return `${headerText}\n\n${body}`;
}
