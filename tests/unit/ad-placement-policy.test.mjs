import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AD_PLACEMENTS,
  ALLOWED_AD_PLACEMENTS,
  canDisplayAd,
} from '../../src/ads/placement-policy.js';

test('広告を許可する場所は指定された4場面だけ', () => {
  assert.deepEqual(ALLOWED_AD_PLACEMENTS, [
    'result-after-display',
    'library-after-long-browse',
    'before-new-diagnosis',
    'after-understanding-board',
  ]);
  assert.equal(canDisplayAd({
    placement: 'question-answer',
    context: { resultDisplayed: true, answeredQuestionCount: 10 },
  }), false);
});

test('各広告枠は対応する画面状態を満たした後だけ許可する', () => {
  assert.equal(canDisplayAd({
    placement: AD_PLACEMENTS.RESULT_AFTER_DISPLAY,
    context: { resultDisplayed: true, answeredQuestionCount: 10 },
  }), true);
  assert.equal(canDisplayAd({
    placement: AD_PLACEMENTS.RESULT_AFTER_DISPLAY,
    context: { resultDisplayed: false, answeredQuestionCount: 10 },
  }), false);

  assert.equal(canDisplayAd({
    placement: AD_PLACEMENTS.LIBRARY_AFTER_LONG_BROWSE,
    context: { libraryLongBrowseCompleted: true },
  }), true);
  assert.equal(canDisplayAd({
    placement: AD_PLACEMENTS.LIBRARY_AFTER_LONG_BROWSE,
    context: { libraryLongBrowseCompleted: false },
  }), false);

  assert.equal(canDisplayAd({
    placement: AD_PLACEMENTS.BEFORE_NEW_DIAGNOSIS,
    context: { beforeDiagnosisStart: true },
  }), true);
  assert.equal(canDisplayAd({
    placement: AD_PLACEMENTS.AFTER_UNDERSTANDING_BOARD,
    context: { understandingBoardViewed: true },
  }), true);
});

test('ゲーム進行・LIVE・決済・認証・管理画面では常に広告を拒否する', () => {
  const allowedCases = [
    [AD_PLACEMENTS.RESULT_AFTER_DISPLAY, {
      resultDisplayed: true,
      answeredQuestionCount: 10,
    }],
    [AD_PLACEMENTS.LIBRARY_AFTER_LONG_BROWSE, {
      libraryLongBrowseCompleted: true,
    }],
    [AD_PLACEMENTS.BEFORE_NEW_DIAGNOSIS, {
      beforeDiagnosisStart: true,
    }],
    [AD_PLACEMENTS.AFTER_UNDERSTANDING_BOARD, {
      understandingBoardViewed: true,
    }],
  ];
  const blockingKeys = [
    'isCreatingQuestions',
    'isAnsweringQuestions',
    'isLiveSession',
    'isPaymentFlow',
    'isAuthenticationFlow',
    'isAdminScreen',
  ];

  for (const [placement, context] of allowedCases) {
    for (const key of blockingKeys) {
      assert.equal(canDisplayAd({
        placement,
        context: { ...context, [key]: true },
      }), false, `${placement} must be blocked by ${key}`);
    }
  }
});
