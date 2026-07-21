# Testing

## Engine

```bash
node tests/engine.test.js
```

開始局面、キャスリングを含む局面、アンパッサンを含む終盤局面の手数木と、SAN、UNDO、昇格、チェックメイトを検証する。

## Browser smoke test

スマートフォン相当の画面で以下を確認する。

1. CPU戦を開始して1往復進む
2. UNDOで対局開始局面へ戻る
3. ローカル2人対局を開始する
4. レッスンをクリアする
5. FENから終局して棋譜が保存される
