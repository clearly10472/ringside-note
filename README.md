# リングサイド・ノート

日本語のボクシング速報サイト。静的ページ（`index.html`）が `data.json` と `fighters.json` を読み込んで表示する。

- `data.json`：トップの対戦カード、結果、試合予定と配信先、ニュース、P4P、ランキング（TBRBと4団体）
- `fighters.json`：選手ごとの詳しい解説
- `api/votes.js`：勝敗予想の投票（Vercelの関数。保存先はUpstash Redis）

毎朝のスケジュールタスクが、2つのJSONを更新して `main` にpushする。Vercelがpushを受けて自動で公開し直す。

## 投票の保存先

VercelのプロジェクトのStorageからUpstash（Redis）を追加してプロジェクトにつなぐと、`KV_REST_API_URL` と `KV_REST_API_TOKEN`（または `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`）が自動で入る。保存先がない間は、投票欄は表示されない。
