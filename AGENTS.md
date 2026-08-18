# Project Overview

このプロジェクトは、Googleカレンダー上で表示するメンバー構成をプリセットとして保存し、Chrome拡張機能から簡単に切り替えられるようにするためのものです。

## Tech Stack

* WXT
* Vue 3
* TypeScript
* Chrome Extension
* Chrome Storage API

## Development Policy

* 一度に大量の機能を実装しない
* フェーズごとに小さく実装し、都度動作確認する
* ユーザーから指示された範囲のみ実装する
* 未指示の機能を先回りして追加しない
* 既存コードを不必要に変更しない
* シンプルで保守しやすい構成を優先する
* UIは直感的で、説明なしでも操作できることを重視する
* Googleカレンダー本体へのUI追加は原則行わない
* 拡張機能のPopup内で操作を完結させる
* バックエンドや独自DBは使用しない
* 外部サーバーは使用しない
* Google Calendar APIは現段階では使用しない
* Google Workspace Directory APIは現段階では使用しない
* OAuth認証は現段階では導入しない
* 実装したフェーズは、必要な依存関係とnpm scriptsを整え、すぐに開発起動・ビルドできる状態にする
* 実装後は、使用するコマンドとChromeで読み込む対象ディレクトリを明示する

## Architecture Policy

役割を可能な限り分離する。

想定構成：

```text
Popup
  ↓
Preset Service
  ↓
Chrome Storage

Popup
  ↓
Chrome Messaging
  ↓
Content Script
  ↓
Calendar Adapter
  ↓
Google Calendar DOM
```

GoogleカレンダーのDOM操作は、Google側のUI変更に対応しやすいように `Calendar Adapter` 相当の責務へ分離する。

## Requirements

実装前に必ず以下の仕様書を確認すること。

* `docs/requirements.md`

仕様書と実装内容が矛盾する場合、勝手に仕様変更しないこと。

## Current Development Phase

現在は Phase 0。

### Phase 0 Goal

WXT + Vue + TypeScript の最小構成を作成し、Chromeで開発用拡張機能として認識・起動できることを確認する。

また、依存関係とnpm scriptsを整え、`npm install` 後にすぐ開発起動またはビルドできる状態にする。

### Phase 0で実装するもの

* WXTプロジェクト
* Vue 3
* TypeScript
* 最小Popup
* 必要な依存関係
* npm scripts
* 開発起動可能な構成
* ビルド可能な構成
* Chrome拡張として読み込める構成

Popupには動作確認用の簡単な表示のみ設置する。

例：

```text
Calendar Presets

Extension loaded successfully.
```

### Phase 0の完了条件

以下をすべて満たした時点でPhase 0完了とする。

1. `npm install` が正常に完了する
2. `npm run dev` で開発起動できる
3. `npm run build` でビルドできる
4. Chromeの「パッケージ化されていない拡張機能を読み込む」から読み込める
5. 拡張機能アイコンをクリックするとPopupが表示される
6. Popupに動作確認用のテキストが表示される
7. 実装後に以下を明示する

   * 開発起動コマンド
   * ビルドコマンド
   * Chromeで読み込む対象ディレクトリ

### Phase 0で実装しないもの

* GoogleカレンダーDOM操作
* Content Script
* Chrome Messaging
* Chrome Storage
* プリセット保存
* プリセット切り替え
* プリセット編集
* カレンダー一覧取得
* Google Calendar API
* OAuth
* バックエンド

Phase 0の完了確認後、次のフェーズへ進む。
