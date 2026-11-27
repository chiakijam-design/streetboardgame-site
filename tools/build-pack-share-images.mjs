// 2026-11-27 (Codex review 11/26 #2-2): one 1200x630 share image per question pack and search language,
// so a friend can tell the pack's theme from the shared card. Fixed public copy and the site's own pack
// artwork only (no submitted text, names or answers, no external image service).
// Run: node tools/build-pack-share-images.mjs  → assets/pack-share/<locale>-<slug>.jpg
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { SEARCH_COPY, SEARCH_COPY_LOCALES, PACK_SLUGS } from '../src/content/search-copy.js';
import { questionPacks } from '../src/challenge/packs.js';

const root = new URL('../', import.meta.url);
const artBySlug = new Map(questionPacks(false).map((pack) => [pack.slug, pack.image]));
await mkdir(new URL('assets/pack-share/', root), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let count = 0;
try {
  const page = await browser.newPage();
  await page.setContent('<canvas width="1200" height="630"></canvas>');
  for (const locale of SEARCH_COPY_LOCALES) {
    const copy = SEARCH_COPY[locale];
    for (const slug of PACK_SLUGS) {
      const art = 'data:image/svg+xml;base64,' + (await readFile(new URL(artBySlug.get(slug).slice(1), root))).toString('base64');
      const card = { locale, title: copy.packs[slug].title, brand: copy.ui.siteName, url: 'streetboardgame.com' };
      const result = await page.evaluate(async ({ card, art }) => {
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const image = new Image();
        image.src = art;
        await image.decode();
        ctx.fillStyle = '#EC4F88';
        ctx.fillRect(0, 0, 1200, 630);
        // artwork on the right, in a white rounded frame
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.roundRect(640, 150, 520, 330, 28); ctx.fill();
        ctx.drawImage(image, 655, 165, 490, 300);
        ctx.textBaseline = 'middle';
        ctx.font = '900 30px system-ui, sans-serif';
        ctx.fillStyle = '#FFE26B';
        ctx.fillText(card.brand, 60, 80, 560);
        const lines = (text, width) => {
          const segments = [...new Intl.Segmenter(card.locale, { granularity: 'word' }).segment(text)].map((part) => part.segment);
          const output = [];
          let line = '';
          for (const segment of segments) {
            if (line.trim() && ctx.measureText(line + segment).width > width && segment.trim() && !/^[\p{P}\p{S}]+$/u.test(segment)) {
              output.push(line.trim()); line = '';
            }
            line += segment;
          }
          if (line.trim()) output.push(line.trim());
          return output;
        };
        let size = 72;
        let title;
        do { ctx.font = `900 ${size}px system-ui, sans-serif`; title = lines(card.title, 540); size -= 2; } while (title.length > 4 && size > 30);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#5BD4E8';
        ctx.fillStyle = '#FFFFFF';
        const top = 315 - ((title.length - 1) * (size + 16)) / 2;
        title.forEach((line, index) => { ctx.strokeText(line, 60, top + index * (size + 16), 540); ctx.fillText(line, 60, top + index * (size + 16), 540); });
        ctx.font = '800 26px system-ui, sans-serif';
        ctx.fillText(card.url, 60, 575, 560);
        return { data: canvas.toDataURL('image/jpeg', 0.88).split(',')[1], lines: title.length };
      }, { card, art });
      if (result.lines > 4) throw new Error(`Pack title exceeds image bounds: ${locale} ${slug}`);
      await writeFile(new URL(`assets/pack-share/${locale}-${slug}.jpg`, root), Buffer.from(result.data, 'base64'));
      count += 1;
    }
  }
} finally { await browser.close(); }
console.log(`Rendered ${count} pack share images.`);
