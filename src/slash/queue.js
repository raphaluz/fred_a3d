const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Exibe a fila")
    .addNumberOption((option) =>
      option
        .setName("page")
        .setDescription("Numero da página da fila")
        .setMinValue(1),
    ),

  run: async ({ interaction }) => {
    try {
      const queue = useQueue(interaction.guildId);
      if (!queue || !queue.isPlaying()) {
        return await interaction.editReply("Sem músicas na sua fila");
      }

      const totalPages = Math.ceil(queue.size / 10) || 1;
      const page = (interaction.options.getNumber("page") || 1) - 1;

      if (page >= totalPages)
        return await interaction.editReply(
          `Página invalida. Há apenas ${totalPages} páginas de músicas.`,
        );

      const queueString =
        queue.tracks.data
          .slice(page * 10, page * 10 + 10)
          .map((song, i) => {
            return `**${page * 10 + i + 1}.** \`[${song.duration}]\` ${song.title} -- <@${song.requestedBy.id}>`;
          })
          .join("\n") || "Nenhuma musica na fila.";

      const currentSong = queue.currentTrack;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setDescription(
              `**Tocando Agora**\n` +
                (currentSong
                  ? `\`[${currentSong.duration}]\` ${currentSong.title} -- <@${currentSong.requestedBy.id}>`
                  : "Nenhuma") +
                `\n\n**Fila**\n${queueString}`,
            )
            .setFooter({
              text: `Página ${page + 1} de ${totalPages}`,
            })
            .setThumbnail(currentSong.thumbnail),
        ],
      });
    } catch (error) {
      console.error("Error in queue command:", error);
      return interaction.editReply(
        `Ocorreu um erro ao exibir a fila: ${error.message}`,
      );
    }
  },
};
