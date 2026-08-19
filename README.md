# Calendar Presets

Googleカレンダーで表示するメンバーの組み合わせをプリセットとして保存し、Chrome拡張機能のPopupから切り替えるためのプロジェクトです。

Googleカレンダー本体にはUIを追加せず、既存のカレンダー一覧とチェック状態を利用します。プリセットはChrome Storageへ保存され、外部サーバーへ送信されません。

詳細な要件は [`docs/requirements.md`](docs/requirements.md) を参照してください。

## 主な機能

- 現在表示中のカレンダー構成をプリセットとして保存
- 保存したプリセットをクリックして表示状態を切り替え
- プリセット対象外のカレンダーを非表示
- 自分自身のカレンダーを常時表示
- プリセット名の変更
- 現在の表示状態によるプリセット更新
- プリセットの削除
- 現在の表示状態と一致するプリセットの表示
- 一致するプリセットがない場合の「カスタム」表示

## 適用ルール

プリセットを適用すると、Googleカレンダーの表示状態を次のように変更します。

| 対象 | 適用後の状態 |
| --- | --- |
| プリセットに含まれるカレンダー | ON |
| プリセットに含まれないカレンダー | OFF |
| 自分自身のカレンダー | 常にON |

プリセットへ登録できるのは、Googleカレンダーの左側一覧へ追加済みのカレンダーです。

## 利用方法

### プリセットを作成する

1. Googleカレンダーを開き、プリセットへ含めたいカレンダーだけを表示します。
2. 拡張機能のアイコンをクリックします。
3. 「現在の表示を保存」をクリックします。
4. プリセット名を入力して保存します。

### プリセットを適用する

1. Googleカレンダーを開きます。
2. 拡張機能のPopupを開きます。
3. 適用したいプリセット名をクリックします。

### プリセットを管理する

プリセット右側の `⋯` メニューから、次の操作を行えます。

- 名前を変更
- 現在の表示状態で更新
- 削除

## 技術構成

- WXT
- Vue 3
- TypeScript
- Chrome Extension Manifest V3
- Chrome Storage API
- Chrome Messaging
- Content Script

独自バックエンド、外部DB、Google Calendar API、Google Workspace Directory API、OAuth認証は使用しません。

## アーキテクチャ

```text
Popup
  ├─ Preset Service
  │    └─ Chrome Storage
  │
  └─ Chrome Messaging
       └─ Content Script
            └─ Calendar Adapter
                 └─ Google Calendar DOM
```

主な責務は次のとおりです。

| パス | 責務 |
| --- | --- |
| `src/App.vue` | Popupの表示と操作 |
| `src/services/presetService.ts` | プリセットの保存・更新・削除 |
| `src/entrypoints/google-calendar.content.ts` | Popupとのメッセージ通信 |
| `src/calendar/calendarAdapter.ts` | GoogleカレンダーのDOM取得・表示切り替え |
| `src/utils/presetMatcher.ts` | 現在の表示状態とプリセットの照合 |
| `src/shared/calendarMessaging.ts` | メッセージとDOMデータの型定義 |

GoogleカレンダーのDOMへ依存する処理は、UI変更へ対応しやすいようにCalendar Adapterへ分離しています。

## プリセットのデータ構造

```ts
type CalendarPreset = {
  id: string;
  name: string;
  calendarIds: string[];
  createdAt: number;
  updatedAt: number;
};
```

プリセットは `chrome.storage.local` の `calendarPresets` キーへ保存します。

## セットアップ

必要な環境：

- Node.js
- npm
- Google Chrome

依存関係をインストールします。

```bash
npm install
```

## 開発起動

```bash
npm run dev
```

Chromeで `chrome://extensions` を開き、デベロッパーモードを有効にします。「パッケージ化されていない拡張機能を読み込む」から次のディレクトリを選択してください。

```text
.output/chrome-mv3-dev
```

`wxt.config.ts` ではブラウザーランナーを無効化しているため、Chromeへの読み込みは手動で行います。

## ビルド

```bash
npm run build
```

本番ビルドをChromeへ読み込む場合の対象ディレクトリ：

```text
.output/chrome-mv3
```

配布用ZIPを作成する場合：

```bash
npm run zip
```

型チェック：

```bash
npm run compile
```

## 動作確認

1. `npm run build` が成功することを確認します。
2. `.output/chrome-mv3` をChromeへ読み込みます。
3. Googleカレンダーを開くか再読み込みします。
4. 拡張機能のアイコンをクリックし、Popupが表示されることを確認します。
5. プリセットの保存・適用・更新・削除を確認します。

Content Scriptを更新した場合は、拡張機能だけでなくGoogleカレンダーのタブも再読み込みしてください。

## 制約・注意事項

- Googleカレンダーが公開していないDOM構造を読み取るため、Google側のUI変更によって動作しなくなる可能性があります。
- DOMの再描画中に不完全な一覧を保存しないよう安定待ちと件数確認を行っていますが、適用対象は画面上へ読み込まれている必要があります。
- プリセットは端末内のChrome Storageへ保存されます。独自の端末間同期やプリセット共有には対応していません。
- Googleカレンダーへ未追加のメンバーを、拡張機能から追加することはできません。
- カレンダーやアカウント情報を外部サーバーへ送信する機能はありません。

## 対象外の機能

- Google Calendar API連携
- Google Workspace Directory API連携
- OAuth認証
- バックエンド・独自DB
- プリセット共有・管理者配布
- 部署マスター・ユーザー管理
- スプレッドシート連携

これらはMVPの対象外です。将来機能を追加する場合も、詳細仕様は [`docs/requirements.md`](docs/requirements.md) を基準に更新します。
