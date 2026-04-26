const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { useQueue } = require("discord-player");
const { getTrackThumbnail } = require("../utils/thumbnails");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove musicas da fila")
    .addIntegerOption((option) =>
      option
        .setName("posicao")
        .setDescription("Numero da primeira musica na fila para remover")
        .setMinValue(1)
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("quantidade")
        .setDescription("Quantidade de musicas para remover")
        .setMinValue(1)
        .setRequired(false),
    ),

  run: async ({ interaction }) => {
    try {
      const queue = useQueue(interaction.guildId);

      if (!queue || !queue.currentTrack) {
        return await interaction.editReply("Sem musicas na sua fila");
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.voice.channel) {
        return interaction.editReply(
          "Voce precisa estar em um canal de voz para usar esse comando!",
        );
      }

      const botChannel = interaction.guild.members.me.voice.channel;
      if (botChannel && member.voice.channel.id !== botChannel.id) {
        return interaction.editReply(
          "Voce precisa estar no mesmo canal de voz que eu!",
        );
      }

      const position = interaction.options.getInteger("posicao");
      const amount = interaction.options.getInteger("quantidade") || 1;
      const startIndex = position - 1;
      const availableTracks = queue.tracks.data.length;

      if (!availableTracks) {
        return interaction.editReply("Nao tem musicas esperando na fila.");
      }

      if (position > availableTracks) {
        return interaction.editReply(
          `Posicao invalida. A fila tem apenas ${availableTracks} musicas.`,
        );
      }

      const removeCount = Math.min(amount, availableTracks - startIndex);
      const removedTracks = [];

      for (let i = 0; i < removeCount; i += 1) {
        const removedTrack = queue.removeTrack(startIndex);
        if (removedTrack) removedTracks.push(removedTrack);
      }

      if (!removedTracks.length) {
        return interaction.editReply("Nao consegui remover essa musica.");
      }

      const removedList = removedTracks
        .slice(0, 5)
        .map((song, index) => `${index + 1}. ${song.title}`)
        .join("\n");
      const remainingText =
        removedTracks.length > 5
          ? `\n...e mais ${removedTracks.length - 5} musica(s)`
          : "";
      const thumbnail = await getTrackThumbnail(removedTracks[0]);

      const embed = new EmbedBuilder()
        .setDescription(`Removido da fila:\n${removedList}${remainingText}`)
        .setFooter({
          text: `Removidas: ${removedTracks.length}`,
        });
      if (thumbnail) embed.setThumbnail(thumbnail);

      return interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error("Error in remove command:", error);
      return interaction.editReply(
        `Ocorreu um erro ao remover da fila: ${error.message}`,
      );
    }
  },
};
