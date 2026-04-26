const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { QueryType } = require("discord-player");
const {
  getPlaylistThumbnail,
  getTrackThumbnail,
} = require("../utils/thumbnails");

function isUrl(query) {
  try {
    new URL(query);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Lança as mais brabas no seu chat de voz.")
    .addStringOption((option) =>
      option
        .setName("oqbuscas")
        .setDescription("params for song or playlist")
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName("posicao")
        .setDescription("Numero da musica na fila para pular")
        .setMinValue(1)
        .setRequired(false),
    ),
  run: async ({ client, interaction }) => {
    try {
      const completeMember = await interaction.guild.members.fetch(
        interaction.member.user.id,
      );

      if (!completeMember.voice.channel)
        return interaction.editReply(
          "Entre em um chat de voz para utilizar esse comando",
        );

      const voiceChannel = completeMember.voice.channel;

      const permissions = voiceChannel.permissionsFor(
        interaction.guild.members.me,
      );
      if (
        !permissions.has(PermissionFlagsBits.Connect) ||
        !permissions.has(PermissionFlagsBits.Speak)
      ) {
        return interaction.editReply(
          "Não tenho permissão para entrar/falar nesse canal de voz!",
        );
      }

      const query = interaction.options.getString("oqbuscas")?.trim();
      const position = interaction.options.getInteger("posicao");

      if (!query && !position) {
        return interaction.editReply(
          "Informe uma musica para buscar ou uma posicao da fila para pular.",
        );
      }

      let queue = client.player.nodes.get(interaction.guild.id);

      if (position) {
        if (!queue || !queue.currentTrack) {
          return interaction.editReply("Sem musicas na sua fila para pular.");
        }

        const tracks = queue.tracks.data;

        if (!tracks.length) {
          return interaction.editReply("Sem musicas na sua fila para pular.");
        }

        if (position > tracks.length) {
          return interaction.editReply(
            `Posicao invalida. A fila tem apenas ${tracks.length} musicas.`,
          );
        }

        const botChannel = interaction.guild.members.me.voice.channel;
        if (botChannel && voiceChannel.id !== botChannel.id) {
          return interaction.editReply(
            "Voce precisa estar no mesmo canal de voz que eu para pular musicas!",
          );
        }

        const song = tracks[position - 1];
        const thumbnail = await getTrackThumbnail(song);
        const jumped = queue.node.jump(position - 1);

        if (!jumped) {
          return interaction.editReply("Nao consegui pular para essa musica.");
        }

        const embed = new EmbedBuilder()
          .setDescription(`Pulando para **${song.title}**`)
          .setFooter({ text: `Posicao: ${position}` });
        if (thumbnail) embed.setThumbnail(thumbnail);

        return interaction.editReply({
          embeds: [embed],
        });
      }

      if (!queue) {
        queue = client.player.nodes.create(interaction.guild, {
          metadata: {
            channel: interaction.channel,
          },
          selfDeaf: true,
          volume: 60,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000,
          leaveOnEnd: true,
          leaveOnEndCooldown: 300000,
          connectionTimeout: 60000,
        });
      }

      if (!queue.connection) await queue.connect(voiceChannel);

      let embed = new EmbedBuilder();

      const searchEngine = isUrl(query)
        ? QueryType.AUTO
        : QueryType.YOUTUBE_SEARCH;

      const result = await client.player.search(query, {
        requestedBy: interaction.user,
        searchEngine,
      });

      if (!result.hasTracks()) return interaction.editReply("Nada encontrado");

      if (result.playlist) {
        await queue.addTrack(result.playlist.tracks);
        const playlist = result.playlist;
        const thumbnail = await getPlaylistThumbnail(playlist);
        embed
          .setDescription(
            `**${playlist.title}**\nEssa lista de pedrada foi adicionada a sua fila`,
          )
          .setFooter({ text: `Musicas: ${playlist.tracks.length}` });
        if (thumbnail) embed.setThumbnail(thumbnail);
      } else {
        await queue.addTrack(result.tracks[0]);
        const song = result.tracks[0];
        const thumbnail = await getTrackThumbnail(song, result.playlist);
        embed
          .setDescription(
            `**${song.title}**\nEssa pedrada foi adicionada a sua fila`,
          )
          .setFooter({ text: `Duração: ${song.duration}` });
        if (thumbnail) embed.setThumbnail(thumbnail);
      }

      if (!queue.isPlaying()) await queue.node.play();
      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error("Error in play command:", error);
      console.error("Error stack:", error.stack);
      return interaction.editReply(`❌ | Ocorreu um erro ao tocar a música.`);
    }
  },
};
