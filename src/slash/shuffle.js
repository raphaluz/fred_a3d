const { SlashCommandBuilder } = require("@discordjs/builders");
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Embaralha a fila."),
  run: async ({ interaction }) => {
    try {
      const queue = useQueue(interaction.guildId);

      if (!queue)
        return await interaction.editReply("Sem músicas na fila :(");

      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.voice.channel)
        return interaction.editReply(
          "Você precisa estar em um canal de voz para usar esse comando!"
        );

      const botChannel = interaction.guild.members.me.voice.channel;
      if (botChannel && member.voice.channel.id !== botChannel.id)
        return interaction.editReply(
          "Você precisa estar no mesmo canal de voz que eu!"
        );

      queue.tracks.shuffle();
      await interaction.editReply(
        `A fila de ${queue.size} musicas foi embaralhada!`
      );
    } catch (error) {
      console.error("Error in shuffle command:", error);
      return interaction.editReply(
        `Ocorreu um erro ao embaralhar a fila: ${error.message}`
      );
    }
  },
};
