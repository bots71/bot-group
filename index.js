const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder 
} = require('discord.js');
const fs = require('fs');
const http = require('http');

// سيرفر وهمي بسيط عشان Render ما يقفل البوت ولا يعطيني خطأ بورت
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully!');
}).listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const CHANNELS = {
    TOP_GROUPS: "1535491143897325578",
    LEADER_PANEL: "1535491487763136542",
    COLOR_ROOM: "1535406298781192292"
};

const DB_FILE = './groups_db.json';
let db = { groups: {} };

function loadDb() {
    if (fs.existsSync(DB_FILE)) {
        try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { db = { groups: {} }; }
    }
}
function saveDb() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 4));
}

client.on('ready', () => {
    loadDb();
    console.log(`Logged in as ${client.user.tag}! Groups Bot is Online.`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === '!setup') {
        if (!message.member.permissions.has('Administrator')) return;

        const leaderChannel = message.guild.channels.cache.get(CHANNELS.LEADER_PANEL);
        if (leaderChannel) {
            const embed = new EmbedBuilder()
                .setTitle('Leader Panel')
                .setDescription('هنا يقدر ليدر القروب يتحكم بقروحه بشكل سريع ومنظم.')
                .setColor('#0099ff');

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_role_color').setLabel('Role Color (تغيير لون رول القروب)').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_edit_role').setLabel('Edit Role (تعديل اسم رول القروب)').setStyle(ButtonStyle.Secondary)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_invite_member').setLabel('Invite Member (دعوة عضو أو أكثر)').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_kick_member').setLabel('Kick Member (طرد عضو من القروب)').setStyle(ButtonStyle.Secondary)
            );
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_my_stats').setLabel('My Stats (عرض إحصائيات القروب)').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_leave_group').setLabel('Leave / Delete Group (خروج أو حذف)').setStyle(ButtonStyle.Danger)
            );

            await leaderChannel.send({ embeds: [embed], components: [row1, row2, row3] });
            await message.reply('تم إرسال لوحة التحكم بنجاح إلى روم الليدر!');
        } else {
            await message.reply('لم يتم العثور على روم الليدر، تأكد من الآيدي.');
        }
        return;
    }

    let groupsObj = db.groups.groups || db.groups;
    let userGroup = Object.values(groupsObj).find(g => g.leaderId === message.author.id || (g.members && g.members.includes(message.author.id)));
    
    if (userGroup) {
        const wordsCount = message.content.trim().split(/\s+/).length;
        const earnedXp = wordsCount * 2;
        userGroup.xp = (userGroup.xp || 0) + earnedXp;
        userGroup.textCount = (userGroup.textCount || 0) + wordsCount;
        saveDb();
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const guild = interaction.guild;
    const member = interaction.member;
    const userId = member.id;

    let groupsObj = db.groups.groups || db.groups;
    let myGroupKey = Object.keys(groupsObj).find(k => groupsObj[k].leaderId === userId || (groupsObj[k].members && groupsObj[k].members.includes(userId)));
    let myGroup = myGroupKey ? groupsObj[myGroupKey] : null;
    let isLeader = myGroup && myGroup.leaderId === userId;

    const customId = interaction.customId;

    if (customId === 'btn_role_color') {
        if (!isLeader) return interaction.reply({ content: 'الصلاحيات غير مخصصة لك.', ephemeral: true });
        return interaction.reply({ content: `حدد لونك من هنا <#${CHANNELS.COLOR_ROOM}>`, ephemeral: true });
    }

    if (customId === 'btn_edit_role') {
        if (!isLeader) return interaction.reply({ content: 'الصلاحيات غير مخصصة لك.', ephemeral: true });
        await interaction.reply({ content: 'اكتب اسم القروب الجديد:', ephemeral: true });

        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 15000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            const newName = msg.content;
            myGroup.name = newName;
            saveDb();
            await interaction.editReply({ content: `تم تحديث اسم القروب إلى: **${newName}**` }).catch(() => {});
        });
    }

    if (customId === 'btn_invite_member') {
        if (!isLeader) return interaction.reply({ content: 'الصلاحيات غير مخصصة لك.', ephemeral: true });
        await interaction.reply({ content: 'منشن العضو أو اكتب يوزره لدعوته:', ephemeral: true });

        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            const targetMember = msg.mentions.members.first() || guild.members.cache.find(m => m.user.tag === msg.content || m.id === msg.content);
            if (!targetMember) return interaction.followUp({ content: 'لم يتم العثور على العضو.', ephemeral: true });

            const inviteRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`accept_invite_${myGroupKey}`).setLabel('قبول').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`decline_invite_${myGroupKey}`).setLabel('رفض').setStyle(ButtonStyle.Danger)
            );

            try {
                await targetMember.send({ content: `دعوك للانضمام لقروبة (${myGroup.name})`, components: [inviteRow] });
                await interaction.followUp({ content: 'تم إرسال الدعوة بنجاح.', ephemeral: true });
            } catch (e) {
                await interaction.followUp({ content: 'تعذر إرسال الخاصة للعضو.', ephemeral: true });
            }
        });
    }

    if (customId.startsWith('accept_invite_')) {
        const gKey = customId.replace('accept_invite_', '');
        const targetGroup = groupsObj[gKey];
        if (targetGroup) {
            if (!targetGroup.members.includes(userId)) targetGroup.members.push(userId);
            saveDb();
        }
        return interaction.update({ content: 'تم انضمامك للقروب بنجاح!', components: [] });
    }

    if (customId.startsWith('decline_invite_')) {
        return interaction.update({ content: 'تم رفض الدعوة.', components: [] });
    }

    if (customId === 'btn_kick_member') {
        if (!isLeader) return interaction.reply({ content: 'الصلاحيات غير مخصصة لك.', ephemeral: true });
        await interaction.reply({ content: 'منشن الأعضاء المراد طردهم:', ephemeral: true });

        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            const kicked = msg.mentions.members;
            kicked.forEach(km => {
                myGroup.members = myGroup.members.filter(id => id !== km.id);
            });
            saveDb();
            await interaction.followUp({ content: 'تم طرد الأعضاء المحددين بنجاح.', ephemeral: true });
        });
    }

    if (customId === 'btn_my_stats') {
        if (!myGroup) return interaction.reply({ content: 'القائمة غير مخصصة لك.', ephemeral: true });
        const stats = `
-1- أعضاء القروب: ${(myGroup.members ? myGroup.members.length : 0) + 1}
-2- كم كلمة باليوم: ${myGroup.textCount || 0}
-3- كم اكس بي القروب: ${myGroup.xp || 0}
        `.trim();
        return interaction.reply({ content: stats, ephemeral: true });
    }

    if (customId === 'btn_leave_group') {
        if (!myGroup) return interaction.reply({ content: 'القائمة غير مخصصة لك.', ephemeral: true });
        if (isLeader) {
            delete groupsObj[myGroupKey];
            saveDb();
            return interaction.reply({ content: 'تم حذف القروب بنجاح.', ephemeral: true });
        } else {
            myGroup.members = myGroup.members.filter(id => id !== userId);
            saveDb();
            return interaction.reply({ content: 'تم خروجك من القروب.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
