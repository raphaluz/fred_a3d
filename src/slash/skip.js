const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Pula a música atual"),
  run: async ({ interaction }) => {
    try {
      const queue = useQueue(interaction.guildId);

      if (!queue || !queue.currentTrack)
        return await interaction.editReply("Sem músicas na sua fila");

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

      const currentSong = queue.currentTrack;

      queue.node.skip();
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setDescription(`${currentSong.title} foi skipada!`)
            .setThumbnail(currentSong.thumbnail),
        ],
      });
    } catch (error) {
      console.error("Error in skip command:", error);
      return interaction.editReply(
        `Ocorreu um erro ao pular a música: ${error.message}`,
      );
    }
  },
};
