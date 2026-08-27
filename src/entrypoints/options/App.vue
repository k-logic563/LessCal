<script setup lang="ts">
import { browser } from 'wxt/browser';

const privacyPolicyUrl =
  'https://k-logic563.github.io/LessCal/';
const version = browser.runtime.getManifest().version;
</script>

<template>
  <div class="page-shell">
    <header class="page-header">
      <p class="eyebrow">HELP / ABOUT</p>
      <h1>LessCal</h1>
      <p>使い方と、困ったときに確認することをご案内します。</p>
    </header>

    <main>
      <section class="section-card" aria-labelledby="about-heading">
        <h2 id="about-heading">LessCalについて</h2>
        <p>
          LessCalは、Googleカレンダーで表示するメンバー構成をプリセットとして保存し、簡単に切り替えられるChrome拡張機能です。
        </p>
      </section>

      <section class="section-card" aria-labelledby="usage-heading">
        <h2 id="usage-heading">基本的な使い方</h2>
        <ol class="steps">
          <li><span>Googleカレンダーを開く</span></li>
          <li>
            <span>表示したいカレンダーをGoogleカレンダー上でON／OFFする</span>
          </li>
          <li><span>LessCalのPopupを開く</span></li>
          <li>
            <span>「現在の表示を保存」からプリセット名を入力して保存する</span>
          </li>
          <li>
            <span>保存したプリセットをクリックして、その表示構成へ切り替える</span>
          </li>
        </ol>
        <div class="note">
          <p>プリセット名は自由に設定でき、複数保存できます。</p>
          <p>自分自身のカレンダーは常にONになります。</p>
        </div>
      </section>

      <section class="section-card" aria-labelledby="management-heading">
        <h2 id="management-heading">プリセットの管理</h2>
        <p>
          各プリセットの右側にある <code>⋯</code> メニューから、次の操作ができます。
        </p>
        <ul class="feature-list">
          <li><strong>名前を変更</strong><span>プリセット名を変更します。</span></li>
          <li>
            <strong>現在の表示で更新</strong>
            <span>現在のカレンダー表示状態で保存内容を更新します。</span>
          </li>
          <li><strong>削除</strong><span>不要なプリセットを削除します。</span></li>
          <li>
            <strong>並び替え</strong>
            <span>ドラッグ＆ドロップでプリセットの順番を変更します。</span>
          </li>
        </ul>
      </section>

      <section class="section-card" aria-labelledby="availability-heading">
        <h2 id="availability-heading">Googleカレンダー以外での利用</h2>
        <p>
          LessCalは <code>calendar.google.com</code> 上でのみ利用できます。Googleカレンダー以外のページでPopupを開くと、「Googleカレンダーでのみ利用できます」と表示されます。
        </p>
      </section>

      <section class="section-card troubleshooting" aria-labelledby="trouble-heading">
        <div class="section-heading">
          <p class="eyebrow">TROUBLESHOOTING</p>
          <h2 id="trouble-heading">困ったとき</h2>
        </div>

        <article class="trouble-item">
          <h3>LessCalを開いても「Googleカレンダーでのみ利用できます」と表示される</h3>
          <ul>
            <li>現在開いているタブがGoogleカレンダーか確認してください。</li>
            <li><code>calendar.google.com</code> を開いてください。</li>
            <li>Googleカレンダーを再読み込みしてからLessCalを開き直してください。</li>
          </ul>
        </article>

        <article class="trouble-item">
          <h3>プリセットを登録できない</h3>
          <ul>
            <li>Googleカレンダーの読み込みが完了しているか確認してください。</li>
            <li>Googleカレンダーを再読み込みしてください。</li>
            <li>LessCalのPopupを閉じて、再度開いてください。</li>
          </ul>
        </article>

        <article class="trouble-item">
          <h3>プリセットを選択しても表示が切り替わらない</h3>
          <ul>
            <li>Googleカレンダーのカレンダー一覧が表示されていることを確認してください。</li>
            <li>Googleカレンダーを再読み込みして再度お試しください。</li>
            <li>新しく追加されたカレンダーがある場合は、必要に応じてプリセットを更新してください。</li>
          </ul>
        </article>

        <article class="trouble-item">
          <h3>新しく追加したカレンダーがプリセットに反映されない</h3>
          <p>
            Googleカレンダーを再読み込みしたうえで、プリセットの
            <code>⋯ → 現在の表示で更新</code> から保存内容を更新してください。
          </p>
        </article>

        <article class="trouble-item">
          <h3>プリセットの並び順が保存されない</h3>
          <ul>
            <li>ドラッグ＆ドロップ後にPopupを閉じて再度開き、順番を確認してください。</li>
            <li>改善しない場合は、GoogleカレンダーとLessCalを再読み込みしてください。</li>
          </ul>
        </article>

        <article class="trouble-item trouble-item--last">
          <h3>それでも解決しない場合</h3>
          <ol>
            <li>Googleカレンダーを再読み込みする</li>
            <li>LessCalのPopupを開き直す</li>
            <li>Chrome拡張機能一覧でLessCalが最新版か確認する</li>
            <li>必要に応じてLessCalを再インストールする</li>
          </ol>
          <p class="warning">
            <strong>再インストール前にご確認ください</strong>
            再インストールすると、保存済みプリセットなどのローカルデータが削除される可能性があります。
          </p>
        </article>
      </section>

      <section class="section-card privacy" aria-labelledby="privacy-heading">
        <div>
          <h2 id="privacy-heading">プライバシー</h2>
          <p>LessCalが扱う情報と保存方法について確認できます。</p>
        </div>
        <a :href="privacyPolicyUrl" target="_blank" rel="noopener noreferrer">
          プライバシーポリシーを開く
          <span aria-hidden="true">↗</span>
        </a>
      </section>
    </main>

    <footer>LessCal v{{ version }}</footer>
  </div>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(html) {
  color-scheme: light;
  background: #f8f9fa;
}

:global(body) {
  margin: 0;
  color: #202124;
  background: #f8f9fa;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", sans-serif;
}

.page-shell {
  width: min(800px, calc(100% - 32px));
  margin: 0 auto;
  padding: 52px 0 32px;
}

.page-header {
  margin-bottom: 28px;
  padding: 0 4px;
}

.eyebrow {
  margin: 0 0 7px;
  color: #1967d2;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.page-header h1 {
  margin: 0;
  color: #174ea6;
  font-size: 32px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.page-header > p:last-child {
  margin: 9px 0 0;
  color: #5f6368;
  font-size: 15px;
}

main {
  display: grid;
  gap: 16px;
}

.section-card {
  padding: 28px 30px;
  border: 1px solid #e0e3e7;
  border-radius: 12px;
  background: #ffffff;
}

h2 {
  margin: 0 0 14px;
  color: #3c4043;
  font-size: 19px;
  font-weight: 650;
}

p,
li {
  font-size: 14px;
  line-height: 1.75;
}

p {
  margin: 0;
}

code {
  padding: 2px 5px;
  border-radius: 4px;
  color: #174ea6;
  background: #eef3fc;
  font-family: inherit;
  font-size: 0.92em;
  font-weight: 600;
}

.steps {
  display: grid;
  gap: 12px;
  margin: 20px 0;
  padding: 0;
  counter-reset: step;
  list-style: none;
}

.steps li {
  display: grid;
  grid-template-columns: 28px 1fr;
  align-items: start;
  gap: 11px;
  counter-increment: step;
}

.steps li::before {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  color: #174ea6;
  background: #e8f0fe;
  content: counter(step);
  font-size: 12px;
  font-weight: 700;
}

.steps span {
  padding-top: 2px;
}

.note {
  padding: 12px 14px;
  border-left: 3px solid #a8c7fa;
  border-radius: 0 6px 6px 0;
  color: #5f6368;
  background: #f8fafd;
}

.note p + p {
  margin-top: 2px;
}

.feature-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.feature-list li {
  display: grid;
  gap: 3px;
  padding: 13px 14px;
  border-radius: 7px;
  background: #f8f9fa;
}

.feature-list strong {
  color: #3c4043;
  font-size: 13px;
}

.feature-list span {
  color: #5f6368;
  font-size: 12px;
  line-height: 1.6;
}

.section-heading {
  margin-bottom: 18px;
}

.section-heading h2 {
  margin-bottom: 0;
}

.trouble-item {
  padding: 20px 0;
  border-top: 1px solid #e8eaed;
}

.trouble-item h3 {
  margin: 0 0 9px;
  color: #3c4043;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.55;
}

.trouble-item ul,
.trouble-item ol {
  display: grid;
  gap: 3px;
  margin: 0;
  padding-left: 22px;
  color: #5f6368;
}

.trouble-item p {
  color: #5f6368;
}

.trouble-item--last {
  padding-bottom: 0;
}

.warning {
  display: grid;
  gap: 2px;
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid #f1d5a7;
  border-radius: 7px;
  color: #6d4c16;
  background: #fef7e0;
}

.warning strong {
  color: #6d4c16;
  font-size: 12px;
}

.privacy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.privacy h2 {
  margin-bottom: 6px;
}

.privacy p {
  color: #5f6368;
}

.privacy a {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  padding: 9px 13px;
  border: 1px solid #a8c7fa;
  border-radius: 6px;
  color: #1967d2;
  background: #ffffff;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.privacy a:hover {
  background: #f1f6fd;
}

.privacy a:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 2px;
}

footer {
  padding: 24px 4px 0;
  color: #80868b;
  font-size: 12px;
  text-align: center;
}

@media (max-width: 600px) {
  .page-shell {
    width: min(100% - 20px, 800px);
    padding-top: 28px;
  }

  .section-card {
    padding: 22px 20px;
  }

  .feature-list {
    grid-template-columns: 1fr;
  }

  .privacy {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
