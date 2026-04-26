const { BaseExtractor, QueryType, Track, Util } = require("discord-player");
const { spawn } = require("child_process");
const playdl = require("play-dl");

if (!process.env.YTDL_NO_UPDATE) {
  process.env.YTDL_NO_UPDATE = "1";
}

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

  const args = [
    url,
    "--output",
    "-",
    "--format",
    "140/251/bestaudio/best",
    "--no-playlist",
    "--quiet",
    "--no-warnings",
  ];

  addHeader.forEach((header) => {
    args.push("--add-header", header);
  });

  const subprocess = spawn(youtubeDl.constants.YOUTUBE_DL_PATH, args, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  subprocess.stderr?.resume();

  subprocess.stdout.once("close", () => {
    if (!subprocess.killed) subprocess.kill();
  });
  subprocess.stdout.once("error", () => {
    if (!subprocess.killed) subprocess.kill();
  });

  return subprocess.stdout;
}

async function searchWithYtDlp(query, limit = 5) {
  const info = await getYtDlpJson(`ytsearch${limit}:${query}`, [
    "--dump-single-json",
    "--skip-download",
    "--quiet",
    "--no-warnings",
  ]);

  return Array.isArray(info.entries) ? info.entries.filter(Boolean) : [];
}

function getYtDlpJson(target, args) {
  return new Promise((resolve, reject) => {
    const subprocess = spawn(
      youtubeDl.constants.YOUTUBE_DL_PATH,
      [target, ...args],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    subprocess.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    subprocess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    subprocess.once("error", reject);
    subprocess.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
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

    let results = [];

    try {
      results = await playdl.search(query, {
        source: { youtube: "video" },
        limit: 5,
      });
    } catch (error) {
      this.debug(`play-dl search failed, falling back to yt-dlp: ${error}`);
    }

    if (!results.length) {
      results = await searchWithYtDlp(query, 5);
    }

    return this.createResponse(
      null,
      results.map((video) => this.createTrack(video, context.requestedBy)),
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

  createTrackFromYtDlp(video, requestedBy) {
    const track = new Track(this.context.player, {
      title: video.title || "Unknown YouTube video",
      author: video.uploader || video.channel || "YouTube",
      url: video.webpage_url || video.original_url || video.url,
      thumbnail: video.thumbnail || "",
      duration: formatDuration(video.duration),
      views: Number(video.view_count) || 0,
      requestedBy,
      source: "youtube",
      queryType: QueryType.YOUTUBE_VIDEO,
      raw: video,
    });

    track.extractor = this;
    return track;
  }

  createTrack(video, requestedBy) {
    if (video.webpage_url || video.original_url || video.view_count) {
      return this.createTrackFromYtDlp(video, requestedBy);
    }

    return this.createTrackFromPlayDl(video, requestedBy);
  }
}

module.exports = YouTubeExtractor;
