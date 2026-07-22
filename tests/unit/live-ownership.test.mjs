import test from 'node:test';
import assert from 'node:assert/strict';

import { assertPaidChannelApproved } from '../../src/live/ownership.js';

function verificationDb(row) {
  return {
    prepare() {
      return {
        bind() { return this; },
        async first() { return row; },
      };
    },
  };
}

test('無料LIVEと分離し、有料販売だけ所有確認・現行規約同意・Stripe本人確認・名義関係を必須にする', async () => {
  await assert.doesNotReject(assertPaidChannelApproved({
    REMOTE_DB: verificationDb({
      channel_id: 'UC1234567890_sample',
      ownership_status: 'verified',
      stripe_identity_verified: 1,
      stripe_relationship_status: 'verified',
      stripe_account_id: 'acct_verified123',
      agreement_accepted_at: Date.now(),
    }),
  }, 'verification01', 'UC1234567890_sample'));

  const rejectedRows = [
    { channel_id: 'UC1234567890_sample', ownership_status: 'pending', stripe_identity_verified: 1, stripe_relationship_status: 'verified' },
    { channel_id: 'UC1234567890_sample', ownership_status: 'verified', stripe_identity_verified: 0, stripe_relationship_status: 'verified' },
    { channel_id: 'UC1234567890_sample', ownership_status: 'verified', stripe_identity_verified: 1, stripe_relationship_status: 'pending' },
    { channel_id: 'UC_other_channel', ownership_status: 'verified', stripe_identity_verified: 1, stripe_relationship_status: 'verified' },
    { channel_id: 'UC1234567890_sample', ownership_status: 'verified', stripe_identity_verified: 1, stripe_relationship_status: 'verified', stripe_account_id: '' },
    { channel_id: 'UC1234567890_sample', ownership_status: 'verified', stripe_identity_verified: 1, stripe_relationship_status: 'verified', stripe_account_id: 'acct_verified123', agreement_accepted_at: null },
  ];
  for (const row of rejectedRows) {
    await assert.rejects(
      assertPaidChannelApproved({ REMOTE_DB: verificationDb(row) }, 'verification01', 'UC1234567890_sample'),
      (error) => error.message === 'paid-channel-verification-required' && error.status === 403,
    );
  }
});
