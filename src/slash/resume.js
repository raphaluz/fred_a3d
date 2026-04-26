const { SlashCommandBuilder } = require("@discordjs/builders");
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Despausa a sua musga"),
  run: async ({ interaction }) => {
    try {
      const queue = useQueue(interaction.guildId);

      if (!queue)
        return await interaction.editReply("Sem músicas para tocar :(");

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

      if (queue.node.isPaused()) {
        queue.node.setPaused(false);
        await interaction.editReply("O som está de volta.");
      } else {
        await interaction.editReply("A música ja está tocando.");
      }
    } catch (error) {
      console.error("Error in resume command:", error);
      return interaction.editReply(
        `Ocorreu um erro ao despausar a música: ${error.message}`,
      );
    }
  },
};
