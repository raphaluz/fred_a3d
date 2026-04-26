# Discord Music Bot

This is a Discord music bot that allows users to play and manage music in a voice channel. The bot uses discord-player v7 with support for multiple streaming platforms.

## Supported Platforms

- ✅ **YouTube** - Play videos and music directly from YouTube links
- ✅ **Spotify** - Play tracks, albums, and playlists (uses YouTube as audio source)
- ✅ **SoundCloud** - Search and play SoundCloud tracks
- ✅ **Apple Music** - Play Apple Music tracks
- ✅ **Vimeo** - Play audio from Vimeo videos
- ✅ **Reverbnation** - Play from Reverbnation
- ✅ **Direct Attachments** - Play audio file attachments

## Features

- Play music from YouTube, Spotify, SoundCloud, and other platforms
- Accurate Spotify track matching via YouTube bridge
- YouTube audio streaming uses yt-dlp first, so cookies are optional for normal public videos
- Pause, resume, skip, and stop playback
- Display the currently playing song and queue
- Shuffle queue and clear queue commands

## Setup

To set up the bot, follow these steps:

1. Clone or download this repository to your local machine:
   `git clone https://github.com/raphaluz/fred_a3d.git`

2. Install the required dependencies using npm:
   `npm install`

3. Create a new application on the Discord Developer Portal ([discord.com/developers/applications](https://discord.com/developers/applications)).

4. Under the "Bot" tab, click on "Add Bot" to create a new bot user.

5. Create a `.env` file in the root directory by copying `.env.example`:

   ```bash
   cp .env.example .env
   ```

6. Edit the `.env` file and add your bot credentials:

   ```
   TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   # Optional; only needed if YouTube blocks or rate-limits your host
   YOUTUBE_COOKIE=
   YOUTUBE_COOKIE_JSON=
   ```

   - Get the bot token from the "Bot" tab in the Developer Portal
   - Get the client ID from the "General Information" tab
   - You do not need a YouTube cookie for normal public playback

7. Invite the bot to your Discord server. Go to the "OAuth2" tab in the Developer Portal, select the "bot" scope, and copy the generated invite URL. Paste the URL into your web browser and choose the server where you want to add the bot.

8. Run bot using npm:
   ```bash
   npm run start
   ```

## Docker Setup (Optional)

You can also run the bot using Docker:

1. Make sure you have Docker and Docker Compose installed.

2. Create a `.env` file with your bot credentials (see step 5-6 above).

3. Build and run the container:

   ```bash
   docker-compose up -d
   ```

4. View logs:

   ```bash
   docker-compose logs -f
   ```

5. Stop the bot:
   ```bash
   docker-compose down
   ```

## Usage

Once the bot is running and connected to your Discord server, you can use the following commands:

    /play <query>: Searches for a song on YouTube and adds it to the queue.
    /play <URL>: Plays the song from the provided URL.
    /pause: Pauses the currently playing song.
    /resume: Resumes playback if paused.
    /skip: Skips the current song and plays the next one in the queue.
    /clear: Stops playback and clears the queue.
    /shuffle: Shuffles the queue.
    /queue: Show songs in the queue and current song.
