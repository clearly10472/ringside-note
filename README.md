# リングサイド・ノート

日本語のボクシング速報サイト。静的ページ（`index.html`）が `data.json` と `fighters.json` を読み込んで表示する。

- `data.json`：トップの対戦カード、結果、試合予定と配信先、ニュース、P4P、ランキング（TBRBと4団体）
- `fighters.json`：選手ごとの詳しい解説
- `functions/api/votes.js`：勝敗予想の投票（Cloudflare Pages Functions。保存先はD1、バインディング名 `DB`）
- `api/votes.js`：Vercel時代の投票API（Cloudflareへの移行後に削除予定）

毎朝のスケジュールタスクが、2つのJSONを更新して `main` にpushする。Cloudflare Pagesがpushを受けて自動で公開し直す。

## 投票の保存先

CloudflareのD1データベースを作り、Pagesプロジェクトの設定でバインディング名 `DB` としてつなぐ。テーブルは最初のアクセスで自動で作られる。保存先がない間は、投票欄は表示されない。
