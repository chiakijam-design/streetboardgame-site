import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('current pricing offers the standard free game and closes new sales', async () => {
  const html = await readFile('pricing.html', 'utf8');
  assert.match(html, /無料（0円）/);
  assert.match(html, /新規の有料販売・配信者登録は受け付けていません/);
  assert.match(html, /href="\/challenge"/);
  assert.match(html, /href="\/refund-policy"/);
  assert.doesNotMatch(html, /data-price-list|href="\/live-challenge|Stripe決済|480円/);
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1);
});
test('past transactions retain the original legal documents and refund support', async () => {
  for (const page of ['terms', 'creator-terms', 'legal', 'refund-policy']) {
    const current = await readFile(page + '.html', 'utf8');
    assert.match(current, /過去のLIVE取引と既存データ/);
    assert.match(current, /お問い合わせフォーム/);
    const original = await readFile('legal-history/' + page + '.html', 'utf8');
    assert.ok(original.length > 3000);
  }
});
