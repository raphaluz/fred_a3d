const { SlashCommandBuilder } = require("@discordjs/builders");
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Adjusts the music volume")
    .addIntegerOption((option) =>
      option
        .setName("volume")
        .setDescription("Volume number from 1 to 100, for example 50")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    ),
  run: async ({ interaction }) => {
    try {
      const queue = useQueue(interaction.guildId);

      if (!queue || !queue.isPlaying()) {
        return interaction.editReply("Sem musicas tocando para ajustar.");
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

      const volume =
        interaction.options.getInteger("volume") ||
        interaction.options.getInteger("nivel");
      queue.node.setVolume(volume);

      return interaction.editReply(`Volume ajustado para ${volume}%.`);
    } catch (error) {
      console.error("Error in volume command:", error);
      return interaction.editReply(
        `Ocorreu um erro ao ajustar o volume: ${error.message}`,
      );
    }
  },
};
