// Render fixed public copy with existing site colors and character artwork.
// No submitted text, room, answer, name or external image service is involved.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { TARGET_LOCALES, LOCALE_DETAILS } from '../src/i18n/locales.js';
import { createCatalogTranslator, requireCompleteCatalog } from '../src/i18n/catalog-core.js';

const root = new URL('../', import.meta.url);
const corpus = JSON.parse(await readFile(new URL('data/translation-corpus.json', root), 'utf8'));
const supplement = JSON.parse(await readFile(new URL('data/translation-supplement-public-html.json', root), 'utf8'));
const entries = [...corpus.entries, ...supplement.entries];
const copies = [];
const previewLocale = process.argv.find((value) => value.startsWith('--preview='))?.slice(10);
if (previewLocale && (!TARGET_LOCALES.includes(previewLocale) || ['ja', 'en'].includes(previewLocale))) throw new Error('Invalid preview locale');
// Complete validation precedes all output, keeping incomplete drafts private.
for (const locale of TARGET_LOCALES.filter((value) => !['ja', 'en'].includes(value) && (!previewLocale || value === previewLocale))) {
  const catalog = JSON.parse(await readFile(new URL(`src/i18n/catalogs/${locale}.json`, root), 'utf8'));
  requireCompleteCatalog(entries, catalog, locale);
  const { translate } = createCatalogTranslator(entries, catalog.messages, { aliases: corpus.aliases });
  copies.push({ locale, rtl: LOCALE_DETAILS[locale].direction === 'rtl', title: translate('How well do you know me?'),
    brand: translate('KNOW ME QUIZ'), subtitle: translate('10 questions made for conversation.'), badge: translate('10問') });
}
const character = 'data:image/png;base64,' + (await readFile(new URL('assets/character/girl-upper.png', root))).toString('base64');
if (!previewLocale) await mkdir(new URL('assets/locale-share/', root), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<canvas width="1200" height="630"></canvas>');
  for (const copy of copies) {
    const result = await page.evaluate(async ({ copy, character }) => {
      const canvas = document.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const artwork = new Image();
      artwork.src = character;
      await artwork.decode();
      ctx.clearRect(0, 0, 1200, 630);
      ctx.fillStyle = '#EC4F88';
      ctx.fillRect(0, 0, 1200, 630);
      const imageHeight = 460;
      const imageWidth = imageHeight * artwork.naturalWidth / artwork.naturalHeight;
      ctx.drawImage(artwork, copy.rtl ? 22 : 1178 - imageWidth, 170, imageWidth, imageHeight);
      const x = copy.rtl ? 1135 : 65;
      ctx.direction = copy.rtl ? 'rtl' : 'ltr';
      ctx.textAlign = copy.rtl ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '900 30px system-ui, sans-serif';
      ctx.fillStyle = '#FFE26B';
      ctx.fillText(copy.brand, x, 69, 780);
      ctx.font = '900 28px system-ui, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(copy.badge, x, 118, 780);
      function lines(text, width) {
        const segments = [...new Intl.Segmenter(copy.locale, { granularity: 'word' }).segment(text)].map((part) => part.segment);
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
      }
      let size = 76;
      let title;
      do { ctx.font = `900 ${size}px system-ui, sans-serif`; title = lines(copy.title, 770); size -= 2; } while (title.length > 3 && size > 28);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#5BD4E8';
      ctx.fillStyle = '#FFFFFF';
      title.forEach((line, index) => { ctx.strokeText(line, x, 210 + index * (size + 18), 770); ctx.fillText(line, x, 210 + index * (size + 18), 770); });
      ctx.font = '800 30px system-ui, sans-serif';
      lines(copy.subtitle, 770).forEach((line, index) => ctx.fillText(line, x, 490 + index * 39, 770));
      ctx.font = '800 26px system-ui, sans-serif';
      ctx.fillText('streetboardgame.com', x, 590, 770);
      return { data: canvas.toDataURL('image/png').split(',')[1], titleLines: title.length };
    }, { copy, character });
    if (result.titleLines > 3) throw new Error(`Share heading exceeds image bounds: ${copy.locale}`);
    const output = previewLocale ? new URL(`file:///tmp/streetboardgame-share-preview-${copy.locale}.png`) : new URL(`assets/locale-share/${copy.locale}.png`, root);
    await writeFile(output, Buffer.from(result.data, 'base64'));
  }
} finally { await browser.close(); }
console.log(`Rendered ${copies.length} localized fixed share images. Visual and native-language review remain separate.`);
