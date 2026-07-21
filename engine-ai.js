"use strict";

const PST = {
  P: [
    [0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],
    [0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]
  ],
  N: [
    [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],
    [-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]
  ],
  B: [
    [-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],
    [-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]
  ],
  R: [
    [0,0,0,5,5,0,0,0],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[5,10,10,10,10,10,10,5],[0,0,0,0,0,0,0,0]
  ],
  Q: [
    [-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],
    [0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]
  ],
  K: [
    [20,30,10,0,0,10,30,20],[20,20,0,0,0,0,20,20],[-10,-20,-20,-20,-20,-20,-20,-10],[-20,-30,-30,-40,-40,-30,-30,-20],
    [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30]
  ]
};

function evaluate(position, perspective = "w") {
  const currentStatus = status(position);
  if (currentStatus.over) {
    if (!currentStatus.winner) return 0;
    return currentStatus.winner === perspective ? 1000000 : -1000000;
  }
  let score = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = position.board[r][c];
      if (!piece) continue;
      const base = PIECE_VALUES[piece.type] || 0;
      const table = PST[piece.type];
      const pstR = piece.color === "w" ? r : 7 - r;
      const positional = table ? table[pstR][c] : 0;
      const value = base + positional;
      score += piece.color === perspective ? value : -value;
    }
  }
  const mobility = legalMoves(position).length;
  score += position.turn === perspective ? mobility * 2 : -mobility * 2;
  return score;
}

function moveOrderingScore(position, move) {
  const from = squareCoords(move.from);
  const to = squareCoords(move.to);
  const attacker = position.board[from.r][from.c];
  let victim = position.board[to.r][to.c];
  if (move.enPassant) victim = { type: "P" };
  let score = 0;
  if (victim) score += (PIECE_VALUES[victim.type] || 0) * 10 - (PIECE_VALUES[attacker.type] || 0);
  if (move.promotion) score += (PIECE_VALUES[move.promotion] || 0) + 800;
  if (move.castle) score += 80;
  const next = applyMove(position, move, { record: false });
  if (isInCheck(next, next.turn)) score += 60;
  return score;
}

function orderedMoves(position) {
  return legalMoves(position).sort((a, b) => moveOrderingScore(position, b) - moveOrderingScore(position, a));
}

function minimax(position, depth, alpha, beta, maximizingColor, deadline, nodes) {
  nodes.count += 1;
  if (Date.now() >= deadline) {
    nodes.timedOut = true;
    return evaluate(position, maximizingColor);
  }
  const currentStatus = status(position);
  if (depth <= 0 || currentStatus.over) return evaluate(position, maximizingColor);
  const moves = orderedMoves(position);
  const maximize = position.turn === maximizingColor;
  if (maximize) {
    let best = -Infinity;
    for (const move of moves) {
      const value = minimax(applyMove(position, move, { record: false }), depth - 1, alpha, beta, maximizingColor, deadline, nodes);
      best = Math.max(best, value);
      alpha = Math.max(alpha, value);
      if (beta <= alpha || nodes.timedOut) break;
    }
    return best;
  }
  let best = Infinity;
  for (const move of moves) {
    const value = minimax(applyMove(position, move, { record: false }), depth - 1, alpha, beta, maximizingColor, deadline, nodes);
    best = Math.min(best, value);
    beta = Math.min(beta, value);
    if (beta <= alpha || nodes.timedOut) break;
  }
  return best;
}

function chooseCpuMove(position, difficulty = "normal") {
  const moves = orderedMoves(position);
  if (!moves.length) return null;
  const color = position.turn;

  if (difficulty === "easy") {
    const weighted = [];
    moves.forEach((move) => {
      const weight = Math.max(1, Math.min(8, 1 + Math.floor(moveOrderingScore(position, move) / 250)));
      for (let i = 0; i < weight; i += 1) weighted.push(move);
    });
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  if (difficulty === "normal") {
    const scored = moves.map((move) => ({
      move,
      score: evaluate(applyMove(position, move, { record: false }), color) + Math.random() * 35
    })).sort((a, b) => b.score - a.score);
    const pool = scored.slice(0, Math.min(3, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].move;
  }

  const deadline = Date.now() + 800;
  const depth = moves.length <= 16 || position.fullmove >= 14 ? 3 : 2;
  let bestMove = moves[0];
  let bestScore = -Infinity;
  const nodes = { count: 0, timedOut: false };
  for (const move of moves) {
    const next = applyMove(position, move, { record: false });
    const score = minimax(next, depth - 1, -Infinity, Infinity, color, deadline, nodes);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (nodes.timedOut) break;
  }
  return bestMove;
}

function perft(position, depth) {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const move of legalMoves(position)) {
    nodes += perft(applyMove(position, move, { record: false }), depth - 1);
  }
  return nodes;
}

globalThis.ChessStageEngine = {
  START_FEN,
  PIECE_VALUES,
  createGameFromFen,
  clonePosition,
  toFen,
  repetitionKey,
  repetitionCount,
  squareName,
  squareCoords,
  pieceCode,
  opposite,
  findKing,
  isSquareAttacked,
  isInCheck,
  generatePseudoMoves,
  legalMoves,
  legalMovesFrom,
  applyMove,
  makeRecordedMove,
  matchMove,
  moveKey,
  moveToSan,
  status,
  isInsufficientMaterial,
  hasBasicMatingMaterial,
  undo,
  capturedPieces,
  toPgn,
  evaluate,
  chooseCpuMove,
  perft
};
