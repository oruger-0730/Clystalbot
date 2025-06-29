// events/messageReactionAdd.js
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    if (user.bot) return;

    // partialの対応（キャッシュされてない場合）
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        console.error('[❌] リアクションフェッチ失敗:', err);
        return;
      }
    }

    const messageId = reaction.message.id;
    const emojiKey = reaction.emoji.id || reaction.emoji.name;

    const filePath = path.join(__dirname, '../json/rolepanels.json');
    let panelData = {};
    try {
      if (fs.existsSync(filePath)) {
        panelData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (err) {
      console.error('[❌] rolepanels.json 読み込み失敗:', err);
      return;
    }

    const panel = panelData[messageId];
    if (!panel || !panel.roles[emojiKey]) return;

    const roleId = panel.roles[emojiKey];
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    // ロールを持っていれば外す、持っていなければ付与
    const hasRole = member.roles.cache.has(roleId);
    try {
      if (hasRole) {
        await member.roles.remove(roleId);
        await user.send(`❌ <@&${roleId}> ロールを外しました。`).catch(() => {});
      } else {
        await member.roles.add(roleId);
        await user.send(`✅ <@&${roleId}> ロールを付与しました。`).catch(() => {});
      }
    } catch (err) {
      console.error('[❌] ロールの操作失敗:', err);
    }

    // リアクションを外す（1つだけ選ばせるUI的にも使える）
    reaction.users.remove(user.id).catch(() => {});
  }
};
