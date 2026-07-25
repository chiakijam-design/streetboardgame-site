const CARD_WIDTH = 756;
const CARD_HEIGHT = 1122;
const LINE_YS = [40, 113, 186, 260, 333, 407, 480, 553, 627, 701, 773, 848, 922, 996, 1068];
const CHOICE_YS = [296, 444, 590, 739, 885];
const COLORS = ['#7BB661', '#3B6FB5', '#F0C53D', '#C8323C', '#E88A3C'];

function escapeMarkup(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[character]));
}

function normalizedChoices(card) {
  const choices = card?.choices || card?.options || [];
  return choices.slice(0, 5).map((choice) => String(choice ?? ''));
}

function cardTitle(card) {
  return String(card?.title || card?.text || '');
}

function splitLine(value, limit) {
  const text = String(value || '').trim();
  if (text.length <= limit) return [text];
  const preferredBreak = Math.ceil(text.length / 2);
  return [text.slice(0, preferredBreak), text.slice(preferredBreak)];
}

function textElement(lines, { x, y, size, lineGap = 44, className = '' }) {
  const startY = y - ((lines.length - 1) * lineGap) / 2;
  return `<text class="${className}" x="${x}" y="${startY}" font-size="${size}" text-anchor="middle" dominant-baseline="middle">
    ${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineGap}">${escapeMarkup(line)}</tspan>`).join('')}
  </text>`;
}

function dynamicQuestionCardSvg(card) {
  const title = cardTitle(card);
  const choices = normalizedChoices(card);
  const titleLines = splitLine(title, 13);
  const titleSize = titleLines.length > 1 ? 38 : title.length >= 15 ? 40 : title.length >= 11 ? 44 : 50;
  const holes = Array.from({ length: 12 }, (_, index) => 30 + index * 63);

  return `<svg
    class="notebook-question-card-visual"
    viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}"
    width="${CARD_WIDTH}"
    height="${CARD_HEIGHT}"
    role="img"
    aria-label="${escapeMarkup(title)}"
  >
    <title>${escapeMarkup(title)}</title>
    <defs>
      <filter id="notebook-card-dot-shadow" x="-35%" y="-35%" width="170%" height="170%">
        <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000000" flood-opacity=".24"/>
      </filter>
      <linearGradient id="notebook-card-curl" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#D8D8D8"/>
        <stop offset=".48" stop-color="#FFFFFF"/>
        <stop offset="1" stop-color="#C8C8C8"/>
      </linearGradient>
    </defs>
    <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#FFFFFF"/>
    ${holes.map((x) => `<circle cx="${x}" cy="-1" r="30" fill="#EF6E9B"/>`).join('')}
    <line x1="137" y1="0" x2="137" y2="${CARD_HEIGHT}" stroke="#EFABB0" stroke-width="2"/>
    ${LINE_YS.map((y) => `<line x1="0" y1="${y}" x2="${CARD_WIDTH}" y2="${y}" stroke="#9DD0E5" stroke-width="4"/>`).join('')}
    <path d="M68 55 L690 55 L681 198 L66 198 Z" fill="#75C7E6" opacity=".9"/>
    <g class="notebook-question-card-copy" fill="#111111">
      ${textElement(titleLines, { x: 378, y: 132, size: titleSize, lineGap: 45, className: 'notebook-question-card-title' })}
      ${choices.map((choice, index) => {
        const lines = splitLine(choice, 12);
        const size = lines.length > 1 ? 34 : choice.length >= 14 ? 32 : choice.length >= 10 ? 36 : 42;
        return `<circle cx="76" cy="${CHOICE_YS[index]}" r="42" fill="${COLORS[index]}" filter="url(#notebook-card-dot-shadow)"/>
          ${textElement(lines, {
            x: 406,
            y: CHOICE_YS[index],
            size,
            lineGap: 38,
            className: 'notebook-question-card-choice',
          })}`;
      }).join('')}
    </g>
    <path d="M690 920 C726 932 750 1005 738 1122 L650 1122 C667 1055 677 982 690 920 Z" fill="url(#notebook-card-curl)" opacity=".94"/>
    <path d="M681 932 C716 953 731 1015 725 1122" stroke="rgba(0,0,0,.12)" stroke-width="4" fill="none"/>
  </svg>`;
}

export function renderNotebookQuestionCard(card) {
  const accessibleChoices = normalizedChoices(card)
    .map((choice) => `<li>${escapeMarkup(choice)}</li>`)
    .join('');
  return `${dynamicQuestionCardSvg(card)}<ol class="notebook-card-accessible-choices">${accessibleChoices}</ol>`;
}
