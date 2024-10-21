const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("displays the current song queue")
    .addNumberOption((option) =>
      option
        .setName("page")
        .setDescription("Page number of the queue")
        .setMinValue(1)
    ),

  run: async ({ interaction }) => {
    const queue = useQueue(interaction.guildId);
    if (!queue || !queue.isPlaying()) {
      return await interaction.editReply("There are no songs in the queue");
    }

    const totalPages = Math.ceil(queue.size / 10) || 1;
    const page = (interaction.options.getNumber("page") || 1) - 1;

    if (page > totalPages)
      return await interaction.editReply(
        `Invalid Page. There are only a total of ${totalPages} pages of songs`
      );

    const queueString = queue.tracks.data
      .slice(page * 10, page * 10 + 10)
      .map((song, i) => {
        return `**${page * 10 + i + 1}.** \`[${song.duration}]\` ${song.title} -- <@${song.requestedBy.id}>`;
      })
      .join("\n");

    const currentSong = queue.currentTrack;

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setDescription(
            `**Currently Playing**\n` +
              (currentSong
                ? `\`[${currentSong.duration}]\` ${currentSong.title} -- <@${currentSong.requestedBy.id}>`
                : "None") +
              `\n\n**Queue**\n${queueString}`
          )
          .setFooter({
            text: `Page ${page + 1} of ${totalPages}`,
          })
          .setThumbnail(currentSong.setThumbnail),
      ],
    });
  },
};
