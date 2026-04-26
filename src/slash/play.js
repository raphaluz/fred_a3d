const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { QueryType } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Lança as mais brabas no seu chat de voz.")
    .addStringOption((option) =>
      option
        .setName("oqbuscas")
        .setDescription("params for song or playlist")
        .setRequired(true),
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

      let queue = client.player.nodes.get(interaction.guild.id);

      if (!queue) {
        queue = client.player.nodes.create(interaction.guild, {
          metadata: {
            channel: interaction.channel,
          },
          selfDeaf: true,
          volume: 100,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000,
          leaveOnEnd: true,
          leaveOnEndCooldown: 300000,
          connectionTimeout: 60000,
        });
      }

      if (!queue.connection) await queue.connect(voiceChannel);

      let embed = new EmbedBuilder();

      let url = interaction.options.getString("oqbuscas");

      const result = await client.player.search(url, {
        requestedBy: interaction.user,
        searchEngine: QueryType.AUTO,
      });

      if (!result.hasTracks()) return interaction.editReply("Nada encontrado");

      if (result.playlist) {
        await queue.addTrack(result.playlist.tracks);
        const playlist = result.playlist;
        embed
          .setDescription(
            `**${playlist.title}**\nEssa lista de pedrada foi adicionada a sua fila`,
          )
          .setThumbnail(playlist.thumbnail)
          .setFooter({ text: `Musicas: ${playlist.tracks.length}` });
      } else {
        await queue.addTrack(result.tracks[0]);
        const song = result.tracks[0];
        embed
          .setDescription(
            `**${song.title}**\nEssa pedrada foi adicionada a sua fila`,
          )
          .setThumbnail(song.thumbnail)
          .setFooter({ text: `Duração: ${song.duration}` });
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
