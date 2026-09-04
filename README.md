# depth-driller

スマホのブラウザで遊べる、掘り進みアクション。ミスタードリラー風。

**遊ぶ**: https://bubbleshaker.github.io/depth-driller/

## 遊びかた

- 画面下の十字を押した方向に掘る。指を滑らせれば押し直さずに方向を変えられる。
- ブロックを壊すと、支えを失った同色の塊がまとめて落ちてくる。
- 落ちてきたブロックの下敷きになると終わり。深く潜るほどスコアが伸びる。
- PC では矢印キー / WASD でも操作できる。

## 開発

```sh
npm install
npm run dev     # 開発サーバー
npm test        # domain 層の単体テスト
npm run lint
npm run build
```

## 構成

```
src/
  domain/   ゲームのルール。Canvas も DOM も知らないので単体テストできる
  render/   Canvas 2D への描画だけ
  input/    タッチ / キーボード → 方向
  main.ts   組み立てとゲームループ
```

設計とマイルストーンは [PLAN.md](./PLAN.md) を参照。
