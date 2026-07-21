const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

for (const file of ["engine-core.js", "engine-rules.js", "engine-ai.js"]) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  vm.runInThisContext(source, { filename: file });
}

const E = globalThis.ChessStageEngine;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectPerft(name, fen, expected) {
  const game = E.createGameFromFen(fen);
  expected.forEach((nodes, index) => {
    const actual = E.perft(game, index + 1);
    assert(actual === nodes, `${name} depth ${index + 1}: expected ${nodes}, got ${actual}`);
  });
}

expectPerft("start", E.START_FEN, [20, 400, 8902]);
expectPerft(
  "kiwipete",
  "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
  [48, 2039, 97862]
);
expectPerft(
  "en-passant endgame",
  "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
  [14, 191]
);

let game = E.createGameFromFen();
for (const moveText of ["e2e4", "e7e5", "g1f3"]) {
  const move = E.matchMove(game, moveText);
  assert(move, `missing legal move ${moveText}`);
  game = E.makeRecordedMove(game, move);
}
assert(game.history.map((move) => move.san).join(" ") === "e4 e5 Nf3", "SAN recording failed");
assert(E.undo(game, 2).history.length === 1, "undo failed");

const castle = E.createGameFromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
assert(E.legalMoves(castle).filter((move) => move.castle).length === 2, "castling generation failed");

const enPassant = E.createGameFromFen("8/8/8/3pP3/8/8/8/K6k w - d6 0 1");
assert(E.matchMove(enPassant, "e5d6")?.enPassant, "en-passant generation failed");

const promotion = E.createGameFromFen("7k/P7/8/8/8/8/8/K7 w - - 0 1");
assert(E.legalMoves(promotion).filter((move) => move.from === "a7" && move.to === "a8").length === 4, "promotion generation failed");

let mate = E.createGameFromFen("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
const mateMove = E.matchMove(mate, "f7g7");
assert(E.moveToSan(mate, mateMove) === "Qg7#", "checkmate SAN failed");
mate = E.makeRecordedMove(mate, mateMove);
assert(E.status(mate).reason === "CHECKMATE", "checkmate detection failed");

console.log("CHESS STAGE engine tests passed");
