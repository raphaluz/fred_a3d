const { SlashCommandBuilder } = require("@discordjs/builders");
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pauses the music"),
  run: async ({ interaction }) => {
    try {
      const queue = useQueue(interaction.guildId);

      if (!queue || !queue.isPlaying())
        return await interaction.editReply("Sem músicas para pausar :(");

      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.voice.channel)
        return interaction.editReply(
          "Você precisa estar em um canal de voz para usar esse comando!",
        );

      const botChannel = interaction.guild.members.me.voice.channel;
      if (botChannel && member.voice.channel.id !== botChannel.id)
        return interaction.editReply(
          "Você precisa estar no mesmo canal de voz que eu!",
        );

      if (!queue.node.isPaused()) {
        queue.node.setPaused(true);
        await interaction.editReply(
          "Música pausada! Use `/resume` pra voltar com o som",
        );
      } else {
        await interaction.editReply("A música ja está pausada.");
      }
    } catch (error) {
      console.error("Error in pause command:", error);
      return interaction.editReply(
        `Ocorreu um erro ao pausar a música: ${error.message}`,
      );
    }
  },
};
