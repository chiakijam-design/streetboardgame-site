// Browser-local templates only. Answers, names and quiz capabilities never belong here.
export const PERSONAL_QUESTIONS_KEY = 'watachan:my-questions:v1';
export const PERSONAL_QUESTIONS_LIMIT = 30;
export const PERSONAL_HISTORY_LIMIT = 10;

export function questionTemplate(value) {
  if (!value || typeof value.title !== 'string' || !Array.isArray(value.choices) || value.choices.length !== 5) throw new Error('invalid');
  const title = value.title.replace(/\s+/gu, ' ').trim();
  const choices = value.choices.map(choice => typeof choice === 'string' ? choice.trim() : '');
  if (!title || title.length > 80 || choices.some(choice => !choice || choice.length > 40)
    || new Set(choices.map(choice => choice.normalize('NFKC').toLocaleLowerCase())).size !== 5) throw new Error('invalid');
  return { title, choices };
}

const fingerprint = value => JSON.stringify([value.title, ...value.choices].map(text => text.normalize('NFKC').toLocaleLowerCase()));
function read(storage) {
  const raw = storage.getItem(PERSONAL_QUESTIONS_KEY);
  if (raw === null) return [];
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.items) || value.items.length > PERSONAL_QUESTIONS_LIMIT) throw new Error('storage');
  const ids = new Set();
  return value.items.map(item => {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(item?.id || '') || ids.has(item.id)) throw new Error('storage');
    ids.add(item.id);
    if (item.history !== undefined && (!Array.isArray(item.history) || item.history.length > PERSONAL_HISTORY_LIMIT)) throw new Error('storage');
    return { id: item.id, ...questionTemplate(item), history: (item.history || []).map(questionTemplate) };
  });
}

export function loadPersonalQuestions(storage) {
  try { return { ok: true, items: read(storage) }; }
  catch { return { ok: false, error: 'storage', items: [] }; }
}

export function changePersonalQuestions(storage, operation) {
  try {
    const items = read(storage);
    if (operation.type === 'delete') {
      const index = items.findIndex(item => item.id === operation.id);
      if (index < 0) throw new Error('missing');
      items.splice(index, 1);
    } else {
      const template = questionTemplate(operation.question);
      let index = operation.id ? items.findIndex(item => item.id === operation.id) : -1;
      if (operation.id && index < 0) throw new Error('missing');
      // An unchanged save reuses its template rather than making duplicate rows.
      const duplicate = items.find(item => item.id !== operation.id && fingerprint(item) === fingerprint(template));
      if (duplicate) {
        if (operation.id) throw new Error('invalid');
        if (!operation.allowEviction) return { ok: true, items, id: duplicate.id };
        index = items.findIndex(item => item.id === duplicate.id);
      }
      if (index < 0 && items.length >= PERSONAL_QUESTIONS_LIMIT) {
        if (!operation.allowEviction) throw new Error('limit');
        items.shift();
      }
      const id = operation.id || duplicate?.id || globalThis.crypto.randomUUID();
      const previous = items[index];
      const history = previous ? JSON.stringify(questionTemplate(previous)) === JSON.stringify(template) ? previous.history
        : [questionTemplate(previous), ...previous.history].slice(0, PERSONAL_HISTORY_LIMIT) : [];
      const item = { id, ...template, history };
      if (index < 0) items.push(item);
      else if (operation.allowEviction) { items.splice(index,1); items.push(item); }
      else items[index] = item;
      operation = { ...operation, id };
    }
    const serialized = JSON.stringify({ version: 1, items });
    storage.setItem(PERSONAL_QUESTIONS_KEY, serialized);
    if (storage.getItem(PERSONAL_QUESTIONS_KEY) !== serialized) throw new Error('storage');
    return { ok: true, items, id: operation.id };
  } catch (error) {
    return { ok: false, error: ['invalid', 'missing', 'limit'].includes(error.message) ? error.message : 'storage' };
  }
}

// Only this fresh copy goes into the creator draft. No saved answer or library ID.
export function personalQuestionCard(template, id) {
  return { id, sourceId: '', category: '自作のお題', ...questionTemplate(template),
    ...(template.id ? { personalTemplateId: template.id } : {}), personalQuestion: true, personalSubmissionConsent: false };
}

export function restorePersonalQuestion(currentCard, previous, scope, id) {
  if (!['all','choices'].includes(scope)) throw new Error('invalid');
  const template = questionTemplate(previous);
  return personalQuestionCard(scope === 'choices'
    ? { id: currentCard.personalTemplateId, title: currentCard.title, choices: template.choices }
    : { ...template, id: previous.id }, id);
}

export function personalQuestionBatch(cards, answers, index, templates, idPrefix) {
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > 10 || !Number.isInteger(index)
    || index < 0 || index >= cards.length || !Array.isArray(templates) || templates.length < 1
    || templates.length > cards.length - index) throw new Error('invalid');
  return {
    cards: [...cards.slice(0,index), ...templates.map((template,i) => personalQuestionCard(template, `${idPrefix}${i}`))],
    answers: answers.slice(0,index),
  };
}

export function submissionEligibleCards(cards, generalConsent) {
  return cards.filter(card => card.personalQuestion ? card.personalSubmissionConsent === true : generalConsent === true);
}

export function publicQuizCards(cards) {
  return cards.map(({ id, sourceId, category, title, choices }) => ({ id, sourceId, category, title, choices: [...choices] }));
}

// Automatic save is local only. A persistence failure never opts a question into
// publication review, and callers can keep using the in-memory quiz copy.
export function autoSavePersonalQuestion(storage, card) {
  const privacy = { personalQuestion: true, personalSubmissionConsent: card.personalQuestion === true && card.personalSubmissionConsent === true };
  const loaded = loadPersonalQuestions(storage);
  let result;
  if (!loaded.ok) result = { ok:false, error:'storage' };
  else {
    const existing = loaded.items.find(item => item.id === card.personalTemplateId);
    try {
      const question = questionTemplate(card);
      result = changePersonalQuestions(storage,{type:'save',id:existing?.id,question,allowEviction:true});
    } catch { result = { ok:false, error:'invalid' }; }
  }
  return { ...result, card:{...card,...privacy,
    ...(result.ok ? {personalTemplateId:result.id,personalSaveError:''} : {personalSaveError:result.error === 'invalid' ? 'invalid' : 'failure'})} };
}
