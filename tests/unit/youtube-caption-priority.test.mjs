import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchOwnedYouTubeCaptionSources } from '../../src/live/youtube.js';

test('OAuth字幕は過去1年の再生数を主軸に公開日の新しさも加味して最大8本を選ぶ', async () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const videos = [
    { id: 'popularOld01', views: 900_000, ageDays: 330, privacyStatus: 'public' },
    { id: 'popularNew02', views: 800_000, ageDays: 20, privacyStatus: 'public' },
    { id: 'recentMid003', views: 250_000, ageDays: 3, privacyStatus: 'public' },
    { id: 'candidate004', views: 200_000, ageDays: 40, privacyStatus: 'public' },
    { id: 'candidate005', views: 150_000, ageDays: 60, privacyStatus: 'public' },
    { id: 'candidate006', views: 120_000, ageDays: 90, privacyStatus: 'public' },
    { id: 'candidate007', views: 100_000, ageDays: 120, privacyStatus: 'public' },
    { id: 'candidate008', views: 80_000, ageDays: 150, privacyStatus: 'public' },
    { id: 'privateVid09', views: 2_000_000, ageDays: 2, privacyStatus: 'private' },
    { id: 'olderVideo10', views: 3_000_000, ageDays: 380, privacyStatus: 'public' },
  ];
  const captionRequests = [];
  const searchOrders = [];
  const apiFetch = async (request, options = {}) => {
    const url = new URL(String(request));
    assert.equal(options.headers?.authorization, 'Bearer oauth-access-token');
    if (url.pathname.endsWith('/search')) {
      searchOrders.push(url.searchParams.get('order'));
      const publishedAfter = Date.parse(url.searchParams.get('publishedAfter'));
      assert.equal(Math.abs(publishedAfter - (now - (365 * day))) < 5_000, true);
      const ordered = url.searchParams.get('order') === 'date' ? [...videos].reverse() : videos;
      return Response.json({ items: ordered.map(({ id }) => ({ id: { videoId: id } })) });
    }
    if (url.pathname.endsWith('/videos')) {
      assert.equal(url.searchParams.get('part'), 'snippet,statistics,status');
      return Response.json({ items: videos.map((video) => ({
        id: video.id,
        snippet: { title: `title-${video.id}`, publishedAt: new Date(now - (video.ageDays * day)).toISOString() },
        statistics: { viewCount: String(video.views) },
        status: { privacyStatus: video.privacyStatus },
      })) });
    }
    if (url.pathname.endsWith('/captions')) {
      const videoId = url.searchParams.get('videoId');
      captionRequests.push(videoId);
      return Response.json({ items: [{
        id: `track-${videoId}`,
        snippet: { language: 'ja', trackKind: 'standard', status: 'serving', isDraft: false },
      }] });
    }
    if (url.pathname.includes('/captions/track-')) {
      const videoId = decodeURIComponent(url.pathname.split('/captions/track-')[1]);
      return new Response(`WEBVTT\n\n00:00:00.000 --> 00:00:03.000\n${videoId} の動画で話した具体的なエピソードです。`);
    }
    return Response.json({}, { status: 404 });
  };

  const sources = await fetchOwnedYouTubeCaptionSources({
    channelId: 'UC1234567890_sample',
    videoSummaries: [{ videoId: 'fallbackVid1', title: 'fallback' }],
  }, 'oauth-access-token', apiFetch);

  assert.deepEqual(searchOrders.sort(), ['date', 'viewCount']);
  assert.equal(sources.length, 8);
  assert.deepEqual(captionRequests, sources.map(({ videoId }) => videoId));
  assert.equal(captionRequests[0], 'popularNew02');
  assert.equal(captionRequests[1], 'popularOld01');
  assert.equal(captionRequests.includes('privateVid09'), false);
  assert.equal(captionRequests.includes('olderVideo10'), false);
});
