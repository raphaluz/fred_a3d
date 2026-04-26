const https = require("node:https");

const SPOTIFY_FALLBACK_THUMBNAIL =
  "https://www.scdn.co/i/_global/twitter_card-default.jpg";
const spotifyThumbnailCache = new Map();

function getImageUrl(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(getImageUrl).find(Boolean) || null;
  return value.url || value.sources?.map(getImageUrl).find(Boolean) || null;
}

function isUsefulThumbnail(url) {
  return Boolean(url) && url !== SPOTIFY_FALLBACK_THUMBNAIL;
}

function normalizeSpotifyUrl(url) {
  if (!url) return null;

  return url
    .replace("open.spotify.com/tracks/", "open.spotify.com/track/")
    .replace("open.spotify.com/albums/", "open.spotify.com/album/");
}

function getSpotifyUrl(item) {
  const source = item?.metadata?.source || item?.raw || {};
  const candidates = [
    item?.source === "spotify" && item?.type === "album" && item?.id
      ? `https://open.spotify.com/album/${item.id}`
      : null,
    item?.source === "spotify" && item?.type === "playlist" && item?.id
      ? `https://open.spotify.com/playlist/${item.id}`
      : null,
    item?.playlist?.source === "spotify" &&
    item?.playlist?.type === "album" &&
    item?.playlist?.id
      ? `https://open.spotify.com/album/${item.playlist.id}`
      : null,
    item?.url,
    source.url,
    source.externalUrl,
    source.external_urls?.spotify,
  ];

  const spotifyUrl = candidates.find(
    (url) => typeof url === "string" && url.includes("open.spotify.com"),
  );

  return normalizeSpotifyUrl(spotifyUrl);
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = https
      .get(url, (response) => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Spotify oEmbed returned ${response.statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);

    request.setTimeout(3000, () => {
      request.destroy(new Error("Spotify oEmbed timed out"));
    });
  });
}

async function getSpotifyOEmbedThumbnail(spotifyUrl) {
  if (!spotifyUrl) return null;
  if (spotifyThumbnailCache.has(spotifyUrl)) {
    return spotifyThumbnailCache.get(spotifyUrl);
  }

  try {
    const endpoint = new URL("https://open.spotify.com/oembed");
    endpoint.searchParams.set("url", spotifyUrl);

    const data = await getJson(endpoint);
    const thumbnail = getImageUrl(data.thumbnail_url);
    const usefulThumbnail = isUsefulThumbnail(thumbnail) ? thumbnail : null;
    spotifyThumbnailCache.set(spotifyUrl, usefulThumbnail);
    return usefulThumbnail;
  } catch (error) {
    console.warn("Could not fetch Spotify cover art:", error.message);
    spotifyThumbnailCache.set(spotifyUrl, null);
    return null;
  }
}

async function getTrackThumbnail(track, playlist = null) {
  const source = track.metadata?.source || track.raw || {};
  const candidates = [
    source.coverArt?.sources,
    source.album?.images,
    source.images,
    source.thumbnail,
    source.image,
    track.thumbnail,
    playlist?.thumbnail,
    track.playlist?.thumbnail,
  ];

  const thumbnail = candidates.map(getImageUrl).find(isUsefulThumbnail);
  if (thumbnail) return thumbnail;

  return (
    (await getSpotifyOEmbedThumbnail(getSpotifyUrl(track))) || track.thumbnail
  );
}

async function getPlaylistThumbnail(playlist) {
  const thumbnail = getImageUrl(playlist.thumbnail);
  if (isUsefulThumbnail(thumbnail)) return thumbnail;

  return (
    (await getSpotifyOEmbedThumbnail(getSpotifyUrl(playlist))) || thumbnail
  );
}

module.exports = {
  getTrackThumbnail,
  getPlaylistThumbnail,
};
