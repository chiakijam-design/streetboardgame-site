"""Build the handwritten question-card fonts (2026-11-15).

The cards use Yomogi (SIL Open Font License 1.1, tools/fonts/Yomogi-Regular.ttf,
licence in assets/fonts/Yomogi-OFL.txt). The OFL allows subsetting, so only the
characters the cards can show are shipped:

  assets/fonts/Yomogi-card.woff2  every question/choice in the repository data and
                                  in the live question catalog, plus kana, ASCII,
                                  full-width forms and common symbols
  assets/fonts/Yomogi-home.woff2  only the three sample cards on the top page

Characters missing from the subset (e.g. a rare kanji in a user's own question)
fall back to Noto Sans JP. Re-run after adding questions:

  python -m pip install --user fonttools brotli
  python tools/build-card-fonts.py            # also reads the live catalog
  python tools/build-card-fonts.py --offline  # repository data + saved list only
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'tools' / 'fonts' / 'Yomogi-Regular.ttf'
CHAR_LIST = ROOT / 'data' / 'card-font-chars.txt'
CATALOG_URL = 'https://www.streetboardgame.com/api/questions/catalog'
DATA_FILES = [
    'prototype_common_data.js', 'prototype_english_common_data.js',
    'src/generated/library-catalog.js', 'src/challenge/packs.js', 'src/challenge/examples.js',
]
BASE = (
    ''.join(chr(c) for c in range(0x20, 0x7F))
    + ''.join(chr(c) for c in range(0x3000, 0x3040))
    + ''.join(chr(c) for c in range(0x3041, 0x3097))
    + ''.join(chr(c) for c in range(0x30A0, 0x3100))
    + ''.join(chr(c) for c in range(0xFF01, 0xFF5F))
    + '・ー〜「」『』（）！？、。…♪♡☆★→←↑↓○×△□◎'
)


def unescape(text):
    return re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), text)


def japanese(text):
    return {c for c in text if '　' <= c <= '鿿' or '＀' <= c <= '￯'}


def card_chars(offline):
    chars = set(CHAR_LIST.read_text(encoding='utf-8').strip()) if CHAR_LIST.exists() else set()
    for name in DATA_FILES:
        path = ROOT / name
        if path.exists():
            chars |= japanese(unescape(path.read_text(encoding='utf-8')))
    if not offline:
        request = urllib.request.Request(CATALOG_URL, headers={'User-Agent': 'Mozilla/5.0 (streetboardgame card-font build)', 'Accept': 'application/json'})
        with urllib.request.urlopen(request, timeout=30) as response:
            catalog = json.load(response)
        for question in catalog.get('questions', []):
            chars |= japanese(question.get('title', '') + ''.join(question.get('choices', [])))
    chars -= set(BASE)
    CHAR_LIST.write_text(''.join(sorted(chars)) + '\n', encoding='utf-8')
    return BASE + ''.join(sorted(chars))


def home_chars():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    text = ''
    for match in re.finditer(r'data-testid="top-question-card"', html):
        block = html[match.start():match.start() + 6000]
        text += re.sub(r'<[^>]+>', ' ', block)
    return ''.join(chr(c) for c in range(0x20, 0x7F)) + ''.join(sorted(japanese(text)))


def build(chars, out):
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True
    font = TTFont(SOURCE)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=chars)
    subsetter.subset(font)
    font.flavor = 'woff2'
    font.save(out)
    print(f'{out.relative_to(ROOT)}: {out.stat().st_size} bytes, {len(set(chars))} characters')


if __name__ == '__main__':
    offline = '--offline' in sys.argv
    build(card_chars(offline), ROOT / 'assets' / 'fonts' / 'Yomogi-card.woff2')
    build(home_chars(), ROOT / 'assets' / 'fonts' / 'Yomogi-home.woff2')
