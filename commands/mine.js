const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const userDataPath = path.join(__dirname, '../json/userData.json');
const mineDataPath = path.join(__dirname, '../json/mine.json');
const configDataPath = path.join(__dirname, '../json/config.json');

const configData = JSON.parse(fs.readFileSync(configDataPath, "utf-8"));

// アイテムと出現確率
const mineItems = [
    { name: '石炭', rate: 20, price: 2 },
    { name: '鉄鉱石', rate: 15, price: 4 },
    { name: '金鉱石', rate: 10, price: 10 },
    { name: 'ダイヤモンド', rate: 10, price: 40 },
    { name: 'エメラルド', rate: 10, price: 60 },
    { name: 'ルビー', rate: 8, price: 80 },
    { name: 'サファイア', rate: 8, price: 80 },
    { name: 'ウラン鉱石', rate: 8, price: 100 },
    { name: 'ミスリル鉱石', rate: 5, price: 120 },
    { name: '伝説の鉱石', rate: 5, price: 200 },
    { name: '賢者の石', rate: 0.001, price: 10000000 }
];

// JSONデータを読み込む関数
function loadJson(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// JSONデータを保存する関数
function saveJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// 確率に基づいてアイテムを選択
function getRandomItem() {
    const totalRate = mineItems.reduce((sum, item) => sum + item.rate, 0);
    const rand = Math.random() * totalRate;
    let sum = 0;

    for (const item of mineItems) {
        sum += item.rate;
        if (rand < sum) return item.name;
    }
    return '石炭'; // 保険
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mine')
        .setDescription('鉱山で採掘を行い、アイテムを獲得します。')
        .addSubcommand(subcommand =>
            subcommand.setName('dig')
                .setDescription('採掘を開始します')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('sell')
                .setDescription('所持している鉱石をすべて売却します')
        ),

    async execute(interaction) {
      
      if (configData.status === "developing" && !configData.devUsers.includes(interaction.user.id)) {
      const errorEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("開発中")
        .setDescription("現在bot開発のため一部機能を制限しています。後ほどお試しください。");

      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
      
        const userId = interaction.user.id;
        const mineData = loadJson(mineDataPath);
        const userData = loadJson(userDataPath);

        if (!userData[userId]) {
            userData[userId] = { G: 0, items: {} };
        }
        if (!userData[userId].items) {
            userData[userId].items = {};
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'dig') {
            const now = Date.now();
            const cooldown = 9 * 60 * 1000; // 10分 (ミリ秒)

            // クールダウンチェック
            if (mineData[userId] && now - mineData[userId] < cooldown) {
                const remainingTime = cooldown - (now - mineData[userId]);
                const minutes = Math.ceil(remainingTime / 60000);
                const seconds = Math.floor((remainingTime % 60000) / 1000);
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('⛏ 採掘失敗')
                        .setDescription(`採掘は ${minutes}分 ${seconds}秒後にもう一度行えます。`)],
                    ephemeral: true
                });
            }

            // 10回抽選してアイテムを獲得
            let minedItems = {};
            for (let i = 0; i < 10; i++) {
                const item = getRandomItem();
                minedItems[item] = (minedItems[item] || 0) + 1;
            }

            // ユーザーデータに追加
            for (const [item, amount] of Object.entries(minedItems)) {
                userData[userId].items[item] = (userData[userId].items[item] || 0) + amount;
            }

            // タイムスタンプを保存
            mineData[userId] = now;
            saveJson(userDataPath, userData);
            saveJson(mineDataPath, mineData);

            // メッセージを作成
            let resultText = Object.entries(minedItems)
                .map(([item, amount]) => `**${item} x${amount}**`)
                .join('\n');

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('⛏ 採掘成功！')
                    .setDescription(`あなたは以下のアイテムを獲得しました！\n\n${resultText}`)]
            });
        } else if (subcommand === 'sell') {
            let totalEarned = 0;
            let soldItems = [];

            for (const item of mineItems) {
                const amount = userData[userId].items[item.name] || 0;
                if (amount > 0) {
                    const earnings = item.price * amount;
                    totalEarned += earnings;
                    soldItems.push(`**${item.name} x${amount} → ${earnings}G**`);
                    delete userData[userId].items[item.name];
                }
            }

            if (totalEarned === 0) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('💰 売却失敗')
                        .setDescription('売却できるアイテムがありません。')],
                    ephemeral: true
                });
            }

            userData[userId].G += totalEarned;
            saveJson(userDataPath, userData);

            let resultText = soldItems.join('\n');

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('Gold')
                    .setTitle('💰 売却成功！')
                    .setDescription(`以下のアイテムを売却しました！\n\n${resultText}\n\n**合計: ${totalEarned}G**`)]
            });
        }
    }
};