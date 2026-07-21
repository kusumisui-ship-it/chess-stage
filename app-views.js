"use strict";

function renderHome() {
  const summary = stats();
  const continueMarkup = savedSession && !savedSession.game.over ? `
    <section class="section">
      <div class="continue-card">
        <div>
          <span class="eyebrow">SAVED MATCH</span>
          <strong>対局を再開</strong>
          <p>${savedSession.config.mode === "cpu" ? `CPU ${difficultyLabel(savedSession.config.difficulty)}` : "同じ端末で2人対局"} ・ ${savedSession.game.history.length}手進行</p>
        </div>
        <button class="primary-button" type="button" data-action="resume">CONTINUE</button>
      </div>
    </section>` : "";

  return `
    <div class="page">
      <section class="hero">
        <span class="eyebrow">READY</span>
        <h1 class="hero-title">YOUR <span>MOVE.</span></h1>
        <p class="hero-copy">チェスのルールは変えない。まずはオフラインで、対局・学習・棋譜保存まで一通り触れるテストビルド。</p>
        <div class="hero-actions">
          <button class="primary-button" type="button" data-action="scroll-builder">START MATCH</button>
          <button class="secondary-button" type="button" data-view-link="learn">LEARN</button>
        </div>
      </section>

      ${continueMarkup}

      <section id="matchBuilder" class="section">
        <div class="section-head"><h2>Match Setup</h2><span>ONLINE機能なし</span></div>
        <div class="builder">
          ${builderRow("MODE", "対局形式", [
            choice("mode", "cpu", "CPU", "1人用", setup.mode === "cpu"),
            choice("mode", "local", "LOCAL", "同じ端末", setup.mode === "local")
          ], 2)}
          ${setup.mode === "cpu" ? builderRow("LEVEL", "CPU強さ", [
            choice("difficulty", "easy", "EASY", "軽い", setup.difficulty === "easy"),
            choice("difficulty", "normal", "NORMAL", "標準", setup.difficulty === "normal"),
            choice("difficulty", "hard", "HARD", "読み重視", setup.difficulty === "hard")
          ], 3) : ""}
          ${builderRow("SIDE", setup.mode === "cpu" ? "あなたの色" : "下側に置く色", [
            choice("color", "white", "WHITE", "先手", setup.color === "white"),
            choice("color", "black", "BLACK", "後手", setup.color === "black"),
            ...(setup.mode === "cpu" ? [choice("color", "random", "RANDOM", "自動", setup.color === "random")] : [])
          ], setup.mode === "cpu" ? 3 : 2)}
          ${builderRow("CLOCK", "持ち時間", [
            choice("clock", "0", "NONE", "無制限", Number(setup.clock) === 0),
            choice("clock", "5", "5 MIN", "早指し", Number(setup.clock) === 5),
            choice("clock", "10", "10 MIN", "標準", Number(setup.clock) === 10),
            choice("clock", "15", "15 MIN", "長め", Number(setup.clock) === 15)
          ], 4)}
          <button class="primary-button builder-start" type="button" data-action="start">START OFFLINE MATCH</button>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Quick Access</h2></div>
        <div class="quick-grid">
          ${quickCard("♙", "LESSONS", "特殊ルールと1手詰め", "learn")}
          ${quickCard("☷", "RECORDS", "端末内の棋譜を見る", "records")}
          ${quickCard("♜", "FEN START", "任意局面から試す", "fen")}
          ${quickCard("⚙", "SETTINGS", "表示と操作を調整", "settings")}
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Local Stats</h2></div>
        <div class="stat-grid">
          <div class="stat-card"><strong>${summary.games}</strong><span>GAMES</span></div>
          <div class="stat-card"><strong>${summary.wins}</strong><span>CPU WINS</span></div>
          <div class="stat-card"><strong>${completedLessons.length}/${LESSONS.length}</strong><span>LESSONS</span></div>
        </div>
      </section>
    </div>`;
}

function builderRow(title, subtitle, choices, columns) {
  return `<div class="builder-row"><div class="builder-label"><strong>${title}</strong><small>${subtitle}</small></div><div class="choice-row" style="--columns:${columns}">${choices.join("")}</div></div>`;
}

function choice(group, value, label, subtitle, active) {
  return `<button class="choice-button ${active ? "active" : ""}" type="button" data-setup-group="${group}" data-setup-value="${value}"><b>${label}</b><small>${subtitle}</small></button>`;
}

function quickCard(icon, title, subtitle, action) {
  const attribute = ["learn", "records", "settings"].includes(action) ? `data-view-link="${action}"` : `data-action="${action}"`;
  return `<button class="quick-card" type="button" ${attribute}><span class="quick-icon">${icon}</span><span><b>${title}</b><small>${subtitle}</small></span></button>`;
}

function renderRecords() {
  const summary = stats();
  const list = records.length ? records.map((record) => {
    const resultClass = record.relativeResult === "white" ? "win" : record.relativeResult === "black" ? "loss" : (record.relativeResult || "draw");
    const resultText = record.relativeResult === "white" ? "W" : record.relativeResult === "black" ? "B" : resultClass === "win" ? "W" : resultClass === "loss" ? "L" : "D";
    return `<button class="record-card" type="button" data-record-id="${escapeHTML(record.id)}">
      <span class="record-result ${resultClass}">${resultText}</span>
      <span class="record-copy"><strong>${escapeHTML(record.title)}</strong><span>${formatDate(record.finishedAt)} ・ ${record.moveCount}手 ・ ${escapeHTML(reasonLabel(record.reason))}</span></span>
      <span class="record-arrow">›</span>
    </button>`;
  }).join("") : `<div class="empty-state"><strong>棋譜はまだありません</strong><p>対局を最後まで終えると、結果とPGNがこの端末に保存されます。</p></div>`;

  return `<div class="page">
    <header class="page-head"><div><span class="eyebrow">LOCAL ARCHIVE</span><h1>Records</h1><p>この端末に保存されたオフライン対局。</p></div>${records.length ? '<button class="text-button" type="button" data-action="clear-records">CLEAR</button>' : ""}</header>
    <div class="stat-grid">
      <div class="stat-card"><strong>${summary.games}</strong><span>ALL</span></div>
      <div class="stat-card"><strong>${summary.wins}</strong><span>WINS</span></div>
      <div class="stat-card"><strong>${summary.draws}</strong><span>DRAWS</span></div>
    </div>
    <section class="section"><div class="section-head"><h2>Game History</h2><span>最大100件</span></div><div class="record-list">${list}</div></section>
  </div>`;
}

function renderLearn() {
  const lessonCards = LESSONS.map((lesson) => {
    const done = completedLessons.includes(lesson.id);
    return `<article class="lesson-card">
      <span class="lesson-number">${lesson.number}</span>
      <div class="lesson-copy"><strong>${escapeHTML(lesson.title)} ${done ? "✓" : ""}</strong><p>${escapeHTML(lesson.summary)}</p></div>
      <button class="secondary-button" type="button" data-lesson-id="${lesson.id}">${done ? "RETRY" : "START"}</button>
    </article>`;
  }).join("");

  return `<div class="page">
    <header class="page-head"><div><span class="eyebrow">BEGINNER ROUTE</span><h1>Learn</h1><p>説明を読ませるより、盤面で一度動かす。</p></div></header>
    <section class="section"><div class="section-head"><h2>Practice</h2><span>${completedLessons.length}/${LESSONS.length} CLEAR</span></div><div class="lesson-list">${lessonCards}</div></section>
    <section class="section">
      <div class="section-head"><h2>Pieces</h2></div>
      <div class="rule-grid">
        ${ruleCard("♔", "KING", "縦・横・斜めへ1マス。取られたら負けではなく、詰みで終了。")}
        ${ruleCard("♕", "QUEEN", "縦・横・斜めへ、他の駒に遮られるまで進める。")}
        ${ruleCard("♖", "ROOK", "縦・横へ一直線。キャスリングにも使う。")}
        ${ruleCard("♗", "BISHOP", "斜めへ一直線。最初にいたマスと同じ色だけを進む。")}
        ${ruleCard("♘", "KNIGHT", "縦横2マス＋横縦1マス。駒を飛び越えられる。")}
        ${ruleCard("♙", "PAWN", "前へ進み斜め前を取る。初手2マス・昇格・アンパッサンあり。")}
      </div>
    </section>
    <section class="section"><div class="empty-state"><strong>勝敗の基本</strong><p>チェックメイトで勝利。合法手がなく王手でなければステイルメイト。三fold・50手ルールは請求、五fold・75手ルールは自動引き分けとして扱います。</p></div></section>
  </div>`;
}

function ruleCard(piece, title, text) {
  return `<article class="rule-card"><b>${piece}</b><strong>${title}</strong><p>${text}</p></article>`;
}

function renderSettings() {
  return `<div class="page">
    <header class="page-head"><div><span class="eyebrow">LOCAL PREFERENCES</span><h1>Settings</h1><p>対局に影響しない表示・操作設定。</p></div></header>
    <section class="section"><div class="section-head"><h2>Board</h2></div><div class="settings-group">
      ${settingToggle("showLegal", "合法手アシスト", "選択した駒の移動先を表示", settings.showLegal)}
      ${settingToggle("showCoordinates", "座標表示", "a〜h・1〜8を盤面に表示", settings.showCoordinates)}
      ${settingToggle("showLastMove", "直前の手", "移動元と移動先をハイライト", settings.showLastMove)}
      ${settingToggle("autoFlipLocal", "ローカル自動反転", "手番ごとに盤面を相手側へ回す", settings.autoFlipLocal)}
    </div></section>
    <section class="section"><div class="section-head"><h2>Safety</h2></div><div class="settings-group">
      ${settingToggle("confirmResign", "投了前に確認", "誤タップで対局を終了しない", settings.confirmResign)}
    </div></section>
    <section class="section"><div class="section-head"><h2>Advanced</h2></div><div class="settings-group">
      <div class="settings-row"><div class="settings-copy"><strong>FENから開始</strong><small>任意の合法局面を読み込む開発・検証用機能</small></div><button class="secondary-button" type="button" data-action="fen">OPEN</button></div>
      <div class="settings-row"><div class="settings-copy"><strong>保存中の対局を削除</strong><small>棋譜記録は残し、再開データだけ消去</small></div><button class="secondary-button" type="button" data-action="delete-session">DELETE</button></div>
      <div class="settings-row"><div class="settings-copy"><strong>全ローカルデータ初期化</strong><small>設定・棋譜・レッスン進行を初期状態へ戻す</small></div><button class="danger-button" type="button" data-action="reset-all">RESET</button></div>
    </div></section>
    <section class="section"><div class="empty-state"><strong>OFFLINE BUILD</strong><p>オンライン対戦、観戦共有、アカウント、課金、スキン購入はこのビルドには含めていません。</p></div></section>
  </div>`;
}

function settingToggle(key, title, subtitle, active) {
  return `<div class="settings-row"><div class="settings-copy"><strong>${title}</strong><small>${subtitle}</small></div><button class="toggle ${active ? "active" : ""}" type="button" role="switch" aria-checked="${active}" data-setting-toggle="${key}" aria-label="${title}"></button></div>`;
}

function difficultyLabel(value) {
  return value === "hard" ? "HARD" : value === "easy" ? "EASY" : "NORMAL";
}

function reasonLabel(reason) {
  const labels = {
    CHECKMATE: "チェックメイト",
    STALEMATE: "ステイルメイト",
    "DEAD POSITION": "デッドポジション",
    "FIVEFOLD REPETITION": "5回同一局面",
    "75-MOVE RULE": "75手ルール",
    "THREEFOLD REPETITION": "3回同一局面",
    "50-MOVE RULE": "50手ルール",
    RESIGN: "投了",
    TIMEOUT: "時間切れ",
    "TIMEOUT DRAW": "時間切れ・引き分け",
    "LESSON CLEAR": "レッスンクリア"
  };
  return labels[reason] || reason || "対局終了";
}
