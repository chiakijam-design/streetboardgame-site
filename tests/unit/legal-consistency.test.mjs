import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const current = async file => (await readFile(file, 'utf8')).split('<details class="legal-card" data-testid="historical-provisions">')[0];

test('current legal documents have continuous section numbers after LIVE retirement', async () => {
  for (const file of ['terms.html', 'privacy.html', 'minor-policy.html', 'content-guidelines.html']) {
    const html = await current(file);
    const numbers = [...html.matchAll(/<h2>(?:第)?(\d+)(?:条|\.)/g)].map(match => Number(match[1]));
    assert.deepEqual(numbers, numbers.map((_, index) => index + 1), file);
  }
});

test('current terms define the free service and retain the original consent-limited question license', async () => {
  const html = await current('terms.html');
  assert.match(html, /第1条（適用）/);
  assert.match(html, /無料の通常版クイズと関連機能（以下「本サービス」）/);
  const clause = html.match(/<h2>第6条[\s\S]*?<ol>([\s\S]*?)<\/ol>/)[1];
  const items = [...clause.matchAll(/<li>(.*?)<\/li>/g)].map(match => match[1]);
  assert.match(items[2], /掲載候補の送信に同意した利用者コンテンツ/);
  assert.match(items[2], /必要な範囲で、無償かつ非独占的/);
  assert.match(items[3], /^前号の許諾は/);
  assert.match(items[3], /第三者へ販売.*生成AIの学習.*許諾するものではありません/);
  assert.doesNotMatch(html, /お金がかかる機能は|出題者または配信者|スタッフ用URL/);
});

test('ordinary question publication remains opt-in and no current board comment or paid LIVE offer is described', async () => {
  for (const file of ['privacy.html', 'minor-policy.html', 'content-guidelines.html']) {
    const html = await current(file);
    assert.match(html, /掲載候補への送信に同意した問題文と選択肢/);
    assert.match(html, /掲載候補として送信しない問題は、この目的では公開しません/);
    assert.doesNotMatch(html, /選択したコメントまたは|有料販売を行う場合は|上記目的|Googleセキュリティ設定/);
  }
  const legal = await current('legal.html');
  assert.doesNotMatch(legal, /LIVE版の有料サービスの内容をご案内/);
  assert.match(legal, /通常版のクイズ作成・回答は無料です/);
  const privacy = await current('privacy.html');
  assert.match(privacy, /本ポリシーは、Streetboardgameの無料の通常版クイズ/);
  assert.match(privacy, /Googleの広告Cookie/);
  assert.match(privacy, /myadcenter.google.com\/personalizationoff/);
});

test('the current content license retains user ownership and excludes unrelated AI training and third-party sales', async () => {
  const html = await current('content-guidelines.html');
  assert.match(html, /権利は、利用者または元の権利者に留保されます/);
  assert.match(html, /掲載候補の送信に同意した利用者コンテンツ/);
  assert.match(html, /この許諾は、利用者コンテンツを第三者へ販売したり/);
  assert.match(html, /本サービスの提供と無関係な生成AIの学習へ無期限に利用したりする許可を含みません/);
  assert.doesNotMatch(html, /画像は、上記目的|掲載候補のお題および登録画像を審査/);
});
