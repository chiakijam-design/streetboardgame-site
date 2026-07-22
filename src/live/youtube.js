const YOUTUBE_API_ORIGIN = 'https://www.googleapis.com/youtube/v3';
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,15}$/;
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{10,}$/;
const MAX_CAPTION_VIDEOS = 8;
const MAX_CAPTION_CHARACTERS = 12_000;

export function normalizeYouTubeInput(value) {
  let url;
  try {
    const input = String(value || '').trim();
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch (error) {
    return null;
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  let videoId = '';
  if (hostname === 'youtu.be') videoId = parts[0] || '';
  if (hostname !== 'youtu.be' && url.pathname === '/watch') videoId = url.searchParams.get('v') || '';
  if (hostname !== 'youtu.be' && ['shorts', 'live', 'embed'].includes(parts[0])) videoId = parts[1] || '';
  if (videoId) {
    if (!VIDEO_ID_PATTERN.test(videoId)) return null;
    return { kind: 'video', videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
  }
  if (!parts.length) return null;
  const first = parts[0];
  const reserved = ['watch', 'shorts', 'live', 'embed', 'playlist', 'results', 'feed', 'redirect'];
  const valid = first.startsWith('@')
    || (['channel', 'c', 'user'].includes(first) && Boolean(parts[1]))
    || (!reserved.includes(first.toLowerCase()) && parts.length === 1);
  if (!valid) return null;
  const normalizedPath = first.startsWith('@') || parts.length === 1 ? `/${first}` : `/${first}/${parts[1]}`;
  return { kind: 'channel', url: `https://www.youtube.com${normalizedPath}` };
}

export async function fetchYouTubeDataProfile(inputValue, env = {}) {
  const input = typeof inputValue === 'string' ? normalizeYouTubeInput(inputValue) : inputValue;
  if (!input) throw youtubeError('invalid-youtube-url', 400);
  const apiKey = String(env.YOUTUBE_API_KEY || '').trim();
  if (!apiKey) throw youtubeError('youtube-api-not-configured', 503);
  const fetchImpl = typeof env.YOUTUBE_API_FETCH === 'function' ? env.YOUTUBE_API_FETCH : fetch;

  let channelId = '';
  let sourceVideo = null;
  if (input.kind === 'video') {
    const videoResponse = await youtubeApi(fetchImpl, apiKey, 'videos', {
      part: 'snippet',
      id: input.videoId,
      maxResults: '1',
    });
    const video = videoResponse.items?.[0];
    if (!video?.snippet?.channelId) throw youtubeError('youtube-video-channel-not-found', 422);
    channelId = video.snippet.channelId;
    sourceVideo = summarizeVideo(video);
  } else {
    channelId = await resolveChannelId(input.url, fetchImpl, apiKey);
  }

  const channelResponse = await youtubeApi(fetchImpl, apiKey, 'channels', {
    part: 'snippet,contentDetails',
    id: channelId,
    maxResults: '1',
  });
  const channel = channelResponse.items?.[0];
  if (!channel?.id) throw youtubeError('youtube-channel-not-found', 422);
  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads || '';
  let playlistItems = [];
  if (uploadsPlaylistId) {
    const playlistResponse = await youtubeApi(fetchImpl, apiKey, 'playlistItems', {
      part: 'contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: '20',
    });
    playlistItems = playlistResponse.items || [];
  }
  const recentIds = [...new Set(playlistItems.map((item) => item.contentDetails?.videoId).filter(Boolean))];
  let recentVideos = [];
  if (recentIds.length) {
    const videosResponse = await youtubeApi(fetchImpl, apiKey, 'videos', {
      part: 'snippet',
      id: recentIds.join(','),
      maxResults: String(recentIds.length),
    });
    const byId = new Map((videosResponse.items || []).map((video) => [video.id, summarizeVideo(video)]));
    recentVideos = recentIds.map((id) => byId.get(id)).filter(Boolean);
  }
  const videoSummaries = mergeVideos(sourceVideo ? [sourceVideo] : [], recentVideos).slice(0, 20);
  return {
    channelName: cleanText(channel.snippet?.title || 'YouTubeチャンネル').slice(0, 80),
    channelUrl: `https://www.youtube.com/channel/${channel.id}`,
    channelId: channel.id,
    customUrl: cleanText(channel.snippet?.customUrl || ''),
    description: cleanText(channel.snippet?.description || '').slice(0, 1000),
    videoTitles: videoSummaries.map(({ title }) => title),
    videoSummaries,
    videoDescriptionCount: videoSummaries.filter(({ description }) => Boolean(description)).length,
    sourceVideo,
    source: 'youtube-data-api-v3',
    inputKind: input.kind,
  };
}

export async function fetchOwnedYouTubeChannels(accessToken, fetchImpl = fetch) {
  const token = String(accessToken || '').trim();
  if (!token) throw youtubeError('youtube-oauth-token-required', 400);
  const url = new URL(`${YOUTUBE_API_ORIGIN}/channels`);
  url.searchParams.set('part', 'id,snippet');
  url.searchParams.set('mine', 'true');
  url.searchParams.set('maxResults', '50');
  const response = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw youtubeError('youtube-oauth-api-failed', response.status >= 500 ? 502 : 401);
  return (body.items || []).map((channel) => ({
    channelId: channel.id,
    channelName: cleanText(channel.snippet?.title || ''),
  })).filter(({ channelId }) => Boolean(channelId));
}

export async function fetchOwnedYouTubeCaptionSources(profile, accessToken, fetchImpl = fetch) {
  const token = String(accessToken || '').trim();
  if (!token) throw youtubeError('youtube-oauth-token-required', 400);
  const videos = Array.isArray(profile?.videoSummaries)
    ? profile.videoSummaries.filter(({ videoId }) => VIDEO_ID_PATTERN.test(String(videoId || ''))).slice(0, MAX_CAPTION_VIDEOS)
    : [];
  const sources = [];
  for (const video of videos) {
    try {
      const captions = await youtubeAuthorizedJson(fetchImpl, token, 'captions', {
        part: 'snippet', videoId: video.videoId,
      });
      const track = selectCaptionTrack(captions.items || []);
      if (!track?.id) continue;
      const url = new URL(`${YOUTUBE_API_ORIGIN}/captions/${encodeURIComponent(track.id)}`);
      url.searchParams.set('tfmt', 'vtt');
      const response = await fetchImpl(url, { headers: { authorization: `Bearer ${token}`, accept: 'text/vtt' } });
      if (!response.ok) continue;
      const transcript = normalizeCaptionText(await response.text()).slice(0, MAX_CAPTION_CHARACTERS);
      if (transcript.length < 20) continue;
      sources.push({
        videoId: video.videoId,
        title: cleanText(video.title || '').slice(0, 120),
        transcript,
        language: cleanText(track.snippet?.language || '').slice(0, 16),
        autoGenerated: track.snippet?.trackKind === 'ASR',
      });
    } catch (error) {
      // 字幕がない・権限がない動画だけを飛ばし、ほかの所有動画の取り込みを続ける。
    }
  }
  return sources;
}

async function resolveChannelId(channelUrl, fetchImpl, apiKey) {
  const parts = new URL(channelUrl).pathname.split('/').filter(Boolean);
  const first = parts[0] || '';
  let parameters;
  if (first === 'channel' && CHANNEL_ID_PATTERN.test(parts[1] || '')) parameters = { id: parts[1] };
  else if (first.startsWith('@')) parameters = { forHandle: first.slice(1) };
  else if (first === 'user' && parts[1]) parameters = { forUsername: parts[1] };
  if (parameters) {
    const response = await youtubeApi(fetchImpl, apiKey, 'channels', {
      part: 'id', maxResults: '1', ...parameters,
    });
    const channelId = response.items?.[0]?.id || '';
    if (!channelId) throw youtubeError('youtube-channel-not-found', 422);
    return channelId;
  }

  const legacyName = decodeURIComponent(first === 'c' ? parts[1] || '' : first).trim();
  if (!legacyName) throw youtubeError('youtube-channel-not-found', 422);
  const search = await youtubeApi(fetchImpl, apiKey, 'search', {
    part: 'snippet', type: 'channel', q: legacyName, maxResults: '5',
  });
  const expected = normalizeComparable(legacyName);
  const exact = (search.items || []).find((item) => (
    normalizeComparable(item.snippet?.channelTitle) === expected
    || normalizeComparable(item.snippet?.title) === expected
  ));
  const channelId = exact?.snippet?.channelId || exact?.id?.channelId || '';
  if (!channelId) throw youtubeError('youtube-channel-url-ambiguous', 422);
  return channelId;
}

async function youtubeApi(fetchImpl, apiKey, resource, parameters) {
  const url = new URL(`${YOUTUBE_API_ORIGIN}/${resource}`);
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set('key', apiKey);
  const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = body?.error?.errors?.[0]?.reason || '';
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw youtubeError('youtube-api-quota-exceeded', 503);
    throw youtubeError('youtube-api-request-failed', response.status >= 500 ? 502 : 422);
  }
  return body;
}

async function youtubeAuthorizedJson(fetchImpl, accessToken, resource, parameters) {
  const url = new URL(`${YOUTUBE_API_ORIGIN}/${resource}`);
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetchImpl(url, { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw youtubeError('youtube-caption-request-failed', response.status >= 500 ? 502 : 422);
  return body;
}

function selectCaptionTrack(items) {
  return [...items]
    .filter((item) => item?.id && item.snippet?.status !== 'failed' && item.snippet?.isDraft !== true)
    .sort((left, right) => captionTrackScore(right) - captionTrackScore(left))[0] || null;
}

function captionTrackScore(item) {
  const language = String(item?.snippet?.language || '').toLowerCase();
  return (language === 'ja' ? 10 : language.startsWith('ja') ? 8 : 0)
    + (item?.snippet?.trackKind === 'standard' ? 3 : 0)
    + (item?.snippet?.status === 'serving' ? 2 : 0);
}

export function normalizeCaptionText(value) {
  const lines = String(value || '').replace(/\r/g, '').split('\n');
  const result = [];
  let previous = '';
  for (const rawLine of lines) {
    const line = rawLine
      .replace(/^WEBVTT.*$/i, '')
      .replace(/^\d+$/, '')
      .replace(/^\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}\s+-->\s+.*$/, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    if (!line || line === previous || /^\[(?:音楽|拍手|笑い|music|applause)\]$/i.test(line)) continue;
    result.push(line);
    previous = line;
  }
  return result.join('\n').trim();
}

function summarizeVideo(video) {
  return {
    videoId: String(video?.id || ''),
    title: cleanText(video?.snippet?.title || '').slice(0, 120),
    description: cleanText(video?.snippet?.description || '').slice(0, 1200),
    keywords: Array.isArray(video?.snippet?.tags)
      ? video.snippet.tags.map(cleanText).filter(Boolean).slice(0, 20)
      : [],
  };
}

function mergeVideos(...groups) {
  const result = [];
  const seen = new Set();
  groups.flat().forEach((video) => {
    if (!video?.title) return;
    const key = video.videoId || video.title;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(video);
  });
  return result;
}

function cleanText(value) {
  return String(value || '').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeComparable(value) {
  return String(value || '').normalize('NFKC').replace(/^@/, '').replace(/[\s_-]+/g, '').toLowerCase();
}

function youtubeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
