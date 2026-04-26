const { BaseExtractor, QueryType, Track, Util } = require("discord-player");
const playdl = require("play-dl");
const ytdl = require("@distube/ytdl-core");
const youtubeDl = require("youtube-dl-exec");

const YOUTUBE_QUERY_TYPES = new Set([
  QueryType.AUTO,
  QueryType.AUTO_SEARCH,
  QueryType.YOUTUBE,
  QueryType.YOUTUBE_SEARCH,
  QueryType.YOUTUBE_VIDEO,
  QueryType.YOUTUBE_PLAYLIST,
]);

const COOKIE_PLACEHOLDERS = new Set([
  "",
  "your_youtube_cookie_here",
  "optional_youtube_cookie_here",
]);

let youtubeAgent;

function getYoutubeAgent() {
  if (youtubeAgent) return youtubeAgent;

  const rawCookie = (process.env.YOUTUBE_COOKIE || "").trim();
  const rawJsonCookie = (process.env.YOUTUBE_COOKIE_JSON || "").trim();

  if (rawJsonCookie && !COOKIE_PLACEHOLDERS.has(rawJsonCookie)) {
    youtubeAgent = ytdl.createAgent(JSON.parse(rawJsonCookie));
    return youtubeAgent;
  }

  if (rawCookie && !COOKIE_PLACEHOLDERS.has(rawCookie)) {
    const cookies = rawCookie
      .split(";")
      .map((pair) => {
        const [name, ...rest] = pair.trim().split("=");
        return { name: name?.trim(), value: rest.join("=").trim() };
      })
      .filter((cookie) => cookie.name && cookie.value);

    if (cookies.length) {
      youtubeAgent = ytdl.createAgent(cookies);
      return youtubeAgent;
    }
  }

  youtubeAgent = ytdl.createAgent();
  return youtubeAgent;
}

function getThumbnail(thumbnails) {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return "";
  const thumbnail = thumbnails[thumbnails.length - 1];
  return thumbnail.url || "";
}

function formatDuration(seconds) {
  const duration = Number(seconds);
  if (!Number.isFinite(duration) || duration <= 0) return "00:00";
  return Util.buildTimeCode(Util.parseMS(duration * 1000));
}

function isYoutubeUrl(query) {
  return typeof query === "string" && ytdl.validateURL(query);
}

function createYtDlpStream(url) {
  const addHeader = [
    "referer:youtube.com",
    "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  ];
  const cookie = (process.env.YOUTUBE_COOKIE || "").trim();

  if (cookie && !COOKIE_PLACEHOLDERS.has(cookie)) {
    addHeader.push(`cookie:${cookie}`);
  }

  const subprocess = youtubeDl.exec(
    url,
    {
      output: "-",
      format: "251/140/bestaudio/best",
      noPlaylist: true,
      quiet: true,
      noWarnings: true,
      addHeader,
    },
    {
      windowsHide: true,
    },
  );

  subprocess.stderr?.resume();
  subprocess.catch(() => {});

  subprocess.stdout.once("close", () => {
    if (!subprocess.killed) subprocess.kill();
  });
  subprocess.stdout.once("error", () => {
    if (!subprocess.killed) subprocess.kill();
  });

  return subprocess.stdout;
}

class YouTubeExtractor extends BaseExtractor {
  static identifier = "fred.youtube";

  priority = 2;

  async activate() {
    this.protocols = ["ytsearch", "youtube"];
  }

  async deactivate() {
    this.protocols = [];
  }

  async validate(query, type) {
    if (typeof query !== "string") return false;
    return YOUTUBE_QUERY_TYPES.has(type) || isYoutubeUrl(query);
  }

  async handle(query, context) {
    const type =
      context.protocol === "ytsearch" ? QueryType.YOUTUBE_SEARCH : context.type;

    if (type === QueryType.YOUTUBE_PLAYLIST) {
      return this.handlePlaylist(query, context);
    }

    if (isYoutubeUrl(query)) {
      const info = await ytdl.getBasicInfo(query, {
        agent: getYoutubeAgent(),
      });

      return this.createResponse(null, [
        this.createTrackFromVideoDetails(
          info.videoDetails,
          context.requestedBy,
        ),
      ]);
    }

    const results = await playdl.search(query, {
      source: { youtube: "video" },
      limit: 5,
    });

    return this.createResponse(
      null,
      results.map((video) =>
        this.createTrackFromPlayDl(video, context.requestedBy),
      ),
    );
  }

  async handlePlaylist(query, context) {
    const playlist = await playdl.playlist_info(query, { incomplete: true });
    const videos = await playlist.all_videos();
    const tracks = videos
      .filter((video) => video.url)
      .map((video) => this.createTrackFromPlayDl(video, context.requestedBy));

    const discordPlaylist = this.context.player.createPlaylist({
      tracks,
      title: playlist.title || "YouTube playlist",
      description: playlist.description || "",
      thumbnail: playlist.thumbnail?.url || tracks[0]?.thumbnail || "",
      type: "playlist",
      source: "youtube",
      author: {
        name: playlist.channel?.name || "YouTube",
        url: playlist.channel?.url || "",
      },
      id: playlist.id || query,
      url: playlist.url || query,
      rawPlaylist: playlist,
    });

    tracks.forEach((track) => {
      track.playlist = discordPlaylist;
    });

    return this.createResponse(discordPlaylist, tracks);
  }

  async stream(track) {
    const url = isYoutubeUrl(track.url)
      ? track.url
      : await this.findYoutubeUrl(track);

    return createYtDlpStream(url);
  }

  async bridge(track, sourceExtractor) {
    if (sourceExtractor?.identifier === YouTubeExtractor.identifier) {
      return this.stream(track);
    }

    const query =
      sourceExtractor?.createBridgeQuery(track) ||
      this.createBridgeQuery(track);
    const result = await this.handle(query, {
      type: QueryType.YOUTUBE_SEARCH,
      requestedBy: track.requestedBy,
    });

    const bridgedTrack = result.tracks[0];
    if (!bridgedTrack) return null;

    track.bridgedTrack = bridgedTrack;
    track.bridgedExtractor = this;

    return this.stream(bridgedTrack);
  }

  async findYoutubeUrl(track) {
    const result = await this.handle(this.createBridgeQuery(track), {
      type: QueryType.YOUTUBE_SEARCH,
      requestedBy: track.requestedBy,
    });

    const bridgedTrack = result.tracks[0];
    if (!bridgedTrack) {
      throw new Error(`Could not find a YouTube stream for ${track.title}`);
    }

    return bridgedTrack.url;
  }

  createTrackFromVideoDetails(details, requestedBy) {
    const track = new Track(this.context.player, {
      title: details.title,
      author: details.author?.name || details.ownerChannelName || "YouTube",
      url:
        details.video_url ||
        `https://www.youtube.com/watch?v=${details.videoId}`,
      thumbnail: getThumbnail(details.thumbnails),
      duration: formatDuration(details.lengthSeconds),
      views: Number(details.viewCount) || 0,
      requestedBy,
      source: "youtube",
      queryType: QueryType.YOUTUBE_VIDEO,
      raw: details,
    });

    track.extractor = this;
    return track;
  }

  createTrackFromPlayDl(video, requestedBy) {
    const track = new Track(this.context.player, {
      title: video.title || "Unknown YouTube video",
      author: video.channel?.name || "YouTube",
      url: video.url,
      thumbnail: video.thumbnails?.[0]?.url || "",
      duration: video.durationRaw || formatDuration(video.durationInSec),
      views: Number(video.views) || 0,
      requestedBy,
      source: "youtube",
      queryType: QueryType.YOUTUBE_VIDEO,
      raw: video,
    });

    track.extractor = this;
    return track;
  }
}

module.exports = YouTubeExtractor;
