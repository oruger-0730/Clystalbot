const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = './json/rolepanels.json';

const COLOR_MAP = {
  DEFAULT: 0x000000,
  WHITE: 0xffffff,
  AQUA: 0x1abc9c,
  GREEN: 0x57f287,
  BLUE: 0x3498db,
  YELLOW: 0xfee75c,
  PURPLE: 0x9b59b6,
  LUMINOUS_VIVID_PINK: 0xe91e63,
  FUCHSIA: 0xeb459e,
  GOLD: 0xf1c40f,
  ORANGE: 0xe67e22,
  RED: 0xed4245,
  GREY: 0x95a5a6,
  NAVY: 0x34495e,
  DARK_AQUA: 0x11806a,
  DARK_GREEN: 0x1f8b4c,
  DARK_BLUE: 0x206694,
  DARK_PURPLE: 0x71368a,
  DARK_VIVID_PINK: 0xad1457,
  DARK_GOLD: 0xc27c0e,
  DARK_ORANGE: 0xa84300,
  DARK_RED: 0x992d22,
  DARK_GREY: 0x979c9f,
  DARK_NAVY: 0x2c3e50,
  BLURPLE: 0x5865f2,
  GREYPLE: 0x99aab5,
  DARK_BUT_NOT_BLACK: 0x2c2f33,
  NOT_QUITE_BLACK: 0x23272a
};

function loadData() {
  try {
    if (fs.existsSync(path)) {
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } else {
      return {};
    }
  } catch (err) {
    console.error('[❌] JSON読み込み失敗:', err);
    return {};
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[❌] JSON保存失敗:', err);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolepanel')
    .setDescription('リアクションロールパネルの設定')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('ロールパネルを作成します')
        .addStringOption(opt => opt.setName('emoji').setDescription('リアクション絵文字').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('付与するロール').setRequired(true))
        .addStringOption(opt => opt.setName('title').setDescription('パネルタイトル').setRequired(true))
        .addStringOption(opt => opt.setName('color').setDescription('Embedカラー (例: RED, GREEN, BLUE)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('既存パネルにロールを追加します')
        .addStringOption(opt => opt.setName('messageid').setDescription('パネルのメッセージID').setRequired(true))
        .addStringOption(opt => opt.setName('emoji').setDescription('リアクション絵文字').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('追加するロール').setRequired(true))
    ),

  async execute(interaction) {
    try {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return await interaction.reply({
          content: '❌ このコマンドを使うには「ロールの管理」権限が必要です。',
          ephemeral: true
        });
      }

      const sub = interaction.options.getSubcommand();
      const data = loadData();

      if (sub === 'create') {
        const emoji = interaction.options.getString('emoji');
        const role = interaction.options.getRole('role');
        const title = interaction.options.getString('title');
        const colorName = interaction.options.getString('color').toUpperCase();

        if (!COLOR_MAP[colorName]) {
          return interaction.reply({
            content: `❌ 色名「${colorName}」は無効です。以下のいずれかを使用してください:\n\`${Object.keys(COLOR_MAP).join(', ')}\``,
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setColor(COLOR_MAP[colorName])
          .setDescription(`${emoji} → <@&${role.id}>`)
          .setFooter({ text: 'リアクションでロールが付与されます' });

        const msg = await interaction.channel.send({ embeds: [embed] }).catch(() => {
          throw new Error('❌ パネルの送信に失敗しました。チャンネルの送信権限があるか確認してください。');
        });

        await msg.react(emoji).catch(() => {
          throw new Error(`❌ リアクションに失敗しました。絵文字が有効か確認してください。`);
        });

        data[msg.id] = {
          channelId: interaction.channel.id,
          roles: { [emoji]: role.id }
        };

        saveData(data);

        return interaction.reply({
          content: `✅ パネルを作成しました！\nメッセージID: \`${msg.id}\``,
          ephemeral: true
        });

      } else if (sub === 'add') {
        const messageId = interaction.options.getString('messageid');
        const emoji = interaction.options.getString('emoji');
        const role = interaction.options.getRole('role');

        if (!data[messageId]) {
          return interaction.reply({ content: '❌ パネルが見つかりません。正しいメッセージIDですか？', ephemeral: true });
        }

        const panel = data[messageId];
        const channel = await interaction.client.channels.fetch(panel.channelId).catch(() => null);
        if (!channel) return interaction.reply({ content: '❌ パネルのチャンネルが見つかりません。', ephemeral: true });

        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (!msg) return interaction.reply({ content: '❌ メッセージが見つかりません。', ephemeral: true });

        const embed = msg.embeds[0];
        if (!embed) return interaction.reply({ content: '❌ パネルに埋め込みがありません。', ephemeral: true });

        const newEmbed = EmbedBuilder.from(embed)
          .setDescription(`${embed.description}\n${emoji} → <@&${role.id}>`);

        await msg.edit({ embeds: [newEmbed] });
        await msg.react(emoji).catch(() => {
          return interaction.reply({ content: '❌ リアクションに失敗しました。絵文字が正しいか確認してください。', ephemeral: true });
        });

        data[messageId].roles[emoji] = role.id;
        saveData(data);

        return interaction.reply({
          content: `✅ <@&${role.id}> をパネルに追加しました！`,
          ephemeral: true
        });
      }
    } catch (err) {
      console.error('[❌ rolepanel エラー]:', err);
      return interaction.reply({ content: `❌ エラーが発生しました: ${err.message || err}`, ephemeral: true });
      }
  }
};
