require("dotenv").config();
const Discord = require("discord.js");
const { GatewayIntentBits } = require("discord.js");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const { Player } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");
const YouTubeExtractor = require("./extractors/youtube");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Required environment variables are missing!");
  process.exit(1);
}

const client = new Discord.Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.slashcommands = new Discord.Collection();

client.player = new Player(client, {
  skipFFmpeg: false,
  connectionTimeout: 60000,
});

const slashFiles = fs
  .readdirSync(path.join(__dirname, "slash"))
  .filter((file) => file.endsWith(".js"));

let commands = [];
for (const file of slashFiles) {
  const slashcmd = require(path.join(__dirname, "slash", file));
  client.slashcommands.set(slashcmd.data.name, slashcmd);
  commands.push(slashcmd.data.toJSON());
}

async function deployCommands(guildId) {
  try {
    const rest = new REST({ version: "9" }).setToken(TOKEN);
    console.log(`Deploying slash commands to guild ${guildId}`);

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), {
      body: commands,
    });

    console.log(`Successfully deployed commands to guild ${guildId}`);
  } catch (error) {
    console.error(`Failed to deploy commands to guild ${guildId}:`, error);
  }
}

client.on("guildCreate", async (guild) => {
  console.log(`Joined new guild: ${guild.name} (${guild.id})`);
  await deployCommands(guild.id);
});

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    for (const extractor of DefaultExtractors) {
      await client.player.extractors.register(extractor, {});
    }
    await client.player.extractors.register(YouTubeExtractor, {});
    console.log("✅ Extractors loaded successfully");
  } catch (error) {
    console.error("❌ Failed to load extractors:", error);
  }

  console.log("Deploying commands to all existing guilds...");
  const guilds = client.guilds.cache;

  for (const [guildId] of guilds) {
    await deployCommands(guildId);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const slashcmd = client.slashcommands.get(interaction.commandName);
  if (!slashcmd) {
    return interaction.reply("Not a valid slash command");
  }

  try {
    await interaction.deferReply();
    await client.player.context.provide({ guild: interaction.guild }, () =>
      slashcmd.run({ client, interaction }),
    );
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);
    const errorMessage = `Ocorreu um erro ao executar o comando: ${error.message}`;

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errorMessage);
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

client.player.events.on("error", (_queue, error) => {
  console.error(`Player error: ${error.message}`);
  console.error("Error stack:", error.stack);
});

client.player.events.on("playerError", (queue, error) => {
  console.error(`Player error in queue ${queue.guild.name}:`, error);
  console.error("Error stack:", error.stack);
});

client.on("error", (error) => {
  console.error("Discord client error:", error);
});

client.login(TOKEN).catch((error) => {
  console.error("Failed to login:", error);
  process.exit(1);
});
