"use strict";

const FILES = "abcdefgh";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function opposite(color) {
  return color === "w" ? "b" : "w";
}

function squareName(r, c) {
  return FILES[c] + (8 - r);
}

function squareCoords(name) {
  if (!name || name.length < 2) return { r: -1, c: -1 };
  return { r: 8 - Number(name[1]), c: FILES.indexOf(name[0]) };
}

function pieceCode(piece) {
  return piece ? piece.color + piece.type : "";
}

function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function clonePosition(source, includeHistory = true) {
  return {
    board: cloneBoard(source.board),
    turn: source.turn,
    castling: source.castling,
    enPassant: source.enPassant,
    halfmove: source.halfmove,
    fullmove: source.fullmove,
    history: includeHistory ? source.history.map((item) => ({ ...item })) : [],
    positionKeys: includeHistory ? [...source.positionKeys] : [],
    over: Boolean(source.over),
    result: source.result ? { ...source.result } : null
  };
}

function createGameFromFen(fen = START_FEN) {
  const parts = String(fen).trim().split(/\s+/);
  if (parts.length < 4) throw new Error("Invalid FEN");
  const [placement, turn, castling, ep, halfmove = "0", fullmove = "1"] = parts;
  const ranks = placement.split("/");
  if (ranks.length !== 8) throw new Error("Invalid FEN placement");

  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  ranks.forEach((rank, r) => {
    let file = 0;
    for (const char of rank) {
      if (/\d/.test(char)) {
        file += Number(char);
      } else {
        if (file > 7 || !/[prnbqkPRNBQK]/.test(char)) throw new Error("Invalid FEN piece");
        board[r][file] = {
          color: char === char.toUpperCase() ? "w" : "b",
          type: char.toUpperCase()
        };
        file += 1;
      }
    }
    if (file !== 8) throw new Error("Invalid FEN rank");
  });

  const game = {
    board,
    turn: turn === "b" ? "b" : "w",
    castling: castling === "-" ? "" : castling,
    enPassant: ep || "-",
    halfmove: Number(halfmove) || 0,
    fullmove: Math.max(1, Number(fullmove) || 1),
    history: [],
    positionKeys: [],
    over: false,
    result: null
  };
  game.positionKeys.push(repetitionKey(game));
  return game;
}

function boardPlacement(board) {
  return board.map((row) => {
    let output = "";
    let empty = 0;
    row.forEach((piece) => {
      if (!piece) {
        empty += 1;
        return;
      }
      if (empty) {
        output += empty;
        empty = 0;
      }
      const symbol = piece.color === "w" ? piece.type : piece.type.toLowerCase();
      output += symbol;
    });
    if (empty) output += empty;
    return output;
  }).join("/");
}

function toFen(position) {
  return [
    boardPlacement(position.board),
    position.turn,
    position.castling || "-",
    position.enPassant || "-",
    position.halfmove,
    position.fullmove
  ].join(" ");
}

function findKing(board, color) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = board[r][c];
      if (piece && piece.color === color && piece.type === "K") return { r, c };
    }
  }
  return null;
}

function isSquareAttacked(board, r, c, byColor) {
  const pawnSourceR = r + (byColor === "w" ? 1 : -1);
  for (const dc of [-1, 1]) {
    const pc = c + dc;
    if (!inBounds(pawnSourceR, pc)) continue;
    const piece = board[pawnSourceR][pc];
    if (piece && piece.color === byColor && piece.type === "P") return true;
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
    if (piece && piece.color === byColor && piece.type === "N") return true;
  }

  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const piece = board[nr][nc];
      if (piece && piece.color === byColor && piece.type === "K") return true;
    }
  }

  const lineGroups = [
    { dirs: [[-1, 0], [1, 0], [0, -1], [0, 1]], types: ["R", "Q"] },
    { dirs: [[-1, -1], [-1, 1], [1, -1], [1, 1]], types: ["B", "Q"] }
  ];
  for (const group of lineGroups) {
    for (const [dr, dc] of group.dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const piece = board[nr][nc];
        if (piece) {
          if (piece.color === byColor && group.types.includes(piece.type)) return true;
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
  if (!king) return true;
  return isSquareAttacked(position.board, king.r, king.c, opposite(color));
}

function pushMove(moves, fromR, fromC, toR, toC, extra = {}) {
  moves.push({ from: squareName(fromR, fromC), to: squareName(toR, toC), ...extra });
}

function generatePseudoMoves(position, color = position.turn) {
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
            ["Q", "R", "B", "N"].forEach((promotion) => {
              pushMove(moves, r, c, oneR, c, { promotion });
            });
          } else {
            pushMove(moves, r, c, oneR, c);
            const twoR = r + dir * 2;
            if (r === startRank && inBounds(twoR, c) && !board[twoR][c]) {
              pushMove(moves, r, c, twoR, c, { doublePawn: true });
            }
          }
        }

        for (const dc of [-1, 1]) {
          const tr = r + dir;
          const tc = c + dc;
          if (!inBounds(tr, tc)) continue;
          const target = board[tr][tc];
          const targetSquare = squareName(tr, tc);
          if (target && target.color !== color && target.type !== "K") {
            if (tr === promotionRank) {
              ["Q", "R", "B", "N"].forEach((promotion) => {
                pushMove(moves, r, c, tr, tc, { promotion, capture: true });
              });
            } else {
              pushMove(moves, r, c, tr, tc, { capture: true });
            }
          }
          if (position.enPassant === targetSquare) {
            const adjacent = board[r][tc];
            if (adjacent && adjacent.color !== color && adjacent.type === "P") {
              pushMove(moves, r, c, tr, tc, { enPassant: true, capture: true });
            }
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
          if (!target || (target.color !== color && target.type !== "K")) {
            pushMove(moves, r, c, tr, tc, { capture: Boolean(target) });
          }
        }
      }

      if (["B", "R", "Q"].includes(piece.type)) {
        const dirs = [];
        if (piece.type === "B" || piece.type === "Q") dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        if (piece.type === "R" || piece.type === "Q") dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        for (const [dr, dc] of dirs) {
          let tr = r + dr;
          let tc = c + dc;
          while (inBounds(tr, tc)) {
            const target = board[tr][tc];
            if (!target) {
              pushMove(moves, r, c, tr, tc);
            } else {
              if (target.color !== color && target.type !== "K") {
                pushMove(moves, r, c, tr, tc, { capture: true });
              }
              break;
            }
            tr += dr;
            tc += dc;
          }
        }
      }

      if (piece.type === "K") {
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (!dr && !dc) continue;
            const tr = r + dr;
            const tc = c + dc;
            if (!inBounds(tr, tc)) continue;
            const target = board[tr][tc];
            if (!target || (target.color !== color && target.type !== "K")) {
              pushMove(moves, r, c, tr, tc, { capture: Boolean(target) });
            }
          }
        }

        if (!isInCheck(position, color)) {
          const homeR = color === "w" ? 7 : 0;
          const kingSideRight = color === "w" ? "K" : "k";
          const queenSideRight = color === "w" ? "Q" : "q";
          const enemy = opposite(color);
          if (r === homeR && c === 4) {
            const kingRook = board[homeR][7];
            if (
              position.castling.includes(kingSideRight) &&
              kingRook && kingRook.color === color && kingRook.type === "R" &&
              !board[homeR][5] && !board[homeR][6] &&
              !isSquareAttacked(board, homeR, 5, enemy) &&
              !isSquareAttacked(board, homeR, 6, enemy)
            ) {
              pushMove(moves, r, c, homeR, 6, { castle: "K" });
            }
            const queenRook = board[homeR][0];
            if (
              position.castling.includes(queenSideRight) &&
              queenRook && queenRook.color === color && queenRook.type === "R" &&
              !board[homeR][1] && !board[homeR][2] && !board[homeR][3] &&
              !isSquareAttacked(board, homeR, 3, enemy) &&
              !isSquareAttacked(board, homeR, 2, enemy)
            ) {
              pushMove(moves, r, c, homeR, 2, { castle: "Q" });
            }
          }
        }
      }
    }
  }
  return moves;
}

function applyMove(position, move, options = {}) {
  const next = clonePosition(position, options.record !== false);
  const from = squareCoords(move.from);
  const to = squareCoords(move.to);
  const piece = next.board[from.r]?.[from.c];
  if (!piece) throw new Error(`No piece on ${move.from}`);

  let captured = next.board[to.r][to.c];
  next.board[from.r][from.c] = null;

  if (move.enPassant) {
    const captureR = piece.color === "w" ? to.r + 1 : to.r - 1;
    captured = next.board[captureR][to.c];
    next.board[captureR][to.c] = null;
  }

  next.board[to.r][to.c] = {
    color: piece.color,
    type: move.promotion || piece.type
  };

  if (move.castle) {
    const homeR = piece.color === "w" ? 7 : 0;
    if (move.castle === "K") {
      next.board[homeR][5] = next.board[homeR][7];
      next.board[homeR][7] = null;
    } else {
      next.board[homeR][3] = next.board[homeR][0];
      next.board[homeR][0] = null;
    }
  }

  if (piece.type === "K") {
    next.castling = next.castling.replace(piece.color === "w" ? /[KQ]/g : /[kq]/g, "");
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
    next.enPassant = squareName((from.r + to.r) / 2, from.c);
  } else {
    next.enPassant = "-";
  }

  next.halfmove = piece.type === "P" || captured ? 0 : next.halfmove + 1;
  if (piece.color === "b") next.fullmove += 1;
  next.turn = opposite(position.turn);
  next.over = false;
  next.result = null;

  if (options.record) {
    const entry = {
      from: move.from,
      to: move.to,
      piece: pieceCode(piece),
      captured: pieceCode(captured),
      promotion: move.promotion || "",
      castle: move.castle || "",
      enPassant: Boolean(move.enPassant),
      san: options.san || "",
      fenBefore: toFen(position),
      fenAfter: ""
    };
    entry.fenAfter = toFen(next);
    next.history.push(entry);
    next.positionKeys.push(repetitionKey(next));
  }
  return next;
}
