const config = require("../config");

module.exports = {
    name: "guildMemberAdd",
    execute(member) {
        const channel = member.guild.systemChannel;
        if (!channel) return;

        channel.send(
            `Ayyy ${member} welcome 😄  
      Check #verification and choose associate role. No tension 👍`
        );
    }
};
