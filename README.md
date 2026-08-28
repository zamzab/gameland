# QR Bike Race

大画面にQRコードを表示し、スマートフォンから最大5人が参加して遊ぶカジュアル自転車レースです。

## ローカル起動

```bash
npm install
npm start
```

大画面用:

```text
http://localhost:3000/
```

スマートフォン用:

```text
http://localhost:3000/join
```

スマートフォン実機でローカル確認する場合は、PCとスマートフォンを同じWi-Fiに接続し、`localhost` ではなくPCのLAN IPアドレスで大画面を開いてください。

## ルール

- 大画面のQRコードを読むとスマートフォンで参加画面が開きます。
- 名前は4文字までです。
- 5人が参加できます。
- スマートフォンの `L` / `R` ボタンを交互に押すと進みます。
- 全員がスタートラインに着くと `5` からカウントダウンし、`スタート！` でレース開始です。
- 最初にゴールへ到達したプレイヤーが勝者として中央に表示され、紙吹雪が舞います。

## 無料デプロイ

Render の Free Web Service で動かせます。Socket.IO を使うため、Static Site ではなく Web Service として作成してください。

設定例:

- Build Command: `npm install`
- Start Command: `npm start`
- Plan: `Free`

このリポジトリには Render Blueprint 用の `render.yaml` も含めています。

## Renderで不安定なとき

次の症状がある場合は、Static Site として作られている可能性が高いです。

- `/join` を更新すると Not Found になる
- `/socket.io/socket.io.js` が 404 になる
- スマートフォン操作が大画面に反映されない

Render Dashboard でサービス種別が `Web Service`、Runtime が `Node` になっていることを確認してください。Static Site ではこのゲームは動きません。

Web Service 側の設定:

- Health Check Path: `/healthz`
- Build Command: `npm install`
- Start Command: `npm start`
