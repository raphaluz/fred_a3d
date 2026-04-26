const { SlashCommandBuilder } = require("@discordjs/builders");
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Para o BOT e limpa a fila"),
  run: async ({ interaction }) => {
    try {
      const queue = useQueue(interaction.guildId);

      if (!queue) return await interaction.editReply("Sem músicas na sua fila");

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

      queue.node.stop(true);
      await interaction.editReply("Fila zerada!");
    } catch (error) {
      console.error("Error in clear command:", error);
      return interaction.editReply(
        `Ocorreu um erro ao limpar a fila: ${error.message}`,
      );
    }
  },
};
