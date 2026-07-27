export const AD_PLACEMENTS = Object.freeze({
  RESULT_AFTER_DISPLAY: 'result-after-display',
  LIBRARY_AFTER_LONG_BROWSE: 'library-after-long-browse',
  BEFORE_NEW_DIAGNOSIS: 'before-new-diagnosis',
  AFTER_UNDERSTANDING_BOARD: 'after-understanding-board',
});

export const ALLOWED_AD_PLACEMENTS = Object.freeze(Object.values(AD_PLACEMENTS));

const BLOCKING_CONTEXT_KEYS = Object.freeze([
  'isCreatingQuestions',
  'isAnsweringQuestions',
  'isLiveSession',
  'isPaymentFlow',
  'isAuthenticationFlow',
  'isAdminScreen',
]);

const placementRequirements = Object.freeze({
  [AD_PLACEMENTS.RESULT_AFTER_DISPLAY]: (context) => (
    context.resultDisplayed === true
    && Number(context.answeredQuestionCount) >= 10
  ),
  [AD_PLACEMENTS.LIBRARY_AFTER_LONG_BROWSE]: (context) => (
    context.libraryLongBrowseCompleted === true
  ),
  [AD_PLACEMENTS.BEFORE_NEW_DIAGNOSIS]: (context) => (
    context.beforeDiagnosisStart === true
  ),
  [AD_PLACEMENTS.AFTER_UNDERSTANDING_BOARD]: (context) => (
    context.understandingBoardViewed === true
  ),
});

export function canDisplayAd({ placement, context = {} } = {}) {
  if (!ALLOWED_AD_PLACEMENTS.includes(placement)) return false;
  if (BLOCKING_CONTEXT_KEYS.some((key) => context[key] === true)) return false;
  return placementRequirements[placement](context);
}
