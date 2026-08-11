const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder,
    StringSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const http = require('http');

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
    COLOR_ROOM: "1535406298781192292",
    TEXT_CATEGORY: "1536221607645814874",
    VOICE_CATEGORY: "1536221822717141012"
};

const ALLOWED_CREATOR_ID = "1535375782736560128";
const DB_FILE = './groups_db.json';
let db = { groups: {} };

// صورتك الأساسية التي طلبتها
const BACKGROUND_IMAGE_URL = "https://cdn.discordapp.com/attachments/1536439598866239518/1536551508802404373/9A161D96-ADCF-4787-80D9-73C5DEFABFF6.png";

function loadDb() {
    if (fs.existsSync(DB_FILE)) {
        try { 
            const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            db.groups = data.groups || data;
        } catch (e) { db = { groups: {} }; }
    }
}

function saveDb() {
    fs.writeFileSync(DB_FILE, JSON.stringify({ groups: db.groups }, null, 4));
}

function getLeaderOrOwnedGroups(member) {
    if (!member) return [];
    return Object.keys(db.groups).filter(k => {
        let g = db.groups[k];
        let hasRole = member.roles.cache.has(g.roleId);
        let isLeader = g.leaderId === member.id;
        return isLeader || hasRole;
    });
}

async function updateTopGroupsBoard() {
    try {
        const channel = await client.channels.fetch(CHANNELS.TOP_GROUPS).catch(() => null);
        if (!channel) return;

        let sortedGroups = Object.values(db.groups).sort((a, b) => (b.xp || 0) - (a.xp || 0));

        let description = "### 🔥 لوحة صدارة القروبات النشطة\n\n";

        if (sortedGroups.length === 0) {
            description += "لا توجد قروبات مسجلة حتى الآن. استخدم `crator group` لإنشاء قروب جديد.";
        } else {
            sortedGroups.forEach((g, index) => {
                let medal = index === 0 ? "👑" : `\`#${index + 1}\``;
                // تم استبدال "يوزر" باسم القروب الحقيقي وعرض الأكس بي بوضوح تحت كل قروب
                description += `${medal} اسم القروب: **${g.name}**\n`;
                description += `👤 الليدر: **${g.leaderName}** | ⚡ الاكس بي: **${(g.xp || 0).toLocaleString()} XP**\n`;
                description += `-----------------------------------\n`;
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🏆 GROUPS LEADERBOARD')
            .setDescription(description)
            .setColor('#2b2d31')
            .setImage(BACKGROUND_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'يتم تحديث اللوحة تلقائياً كل 30 ثانية' });

        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        if (messages) {
            const botMessages = messages.filter(m => m.author.id === client.user.id);
            for (const [id, msg] of botMessages) {
                await msg.delete().catch(() => {});
            }
        }

        await channel.send({ embeds: [embed] });
    } catch (e) {
        console.error('Error updating top board:', e);
    }
}

client.once('ready', () => {
    loadDb();
    console.log(`Logged in as ${client.user.tag}! Groups Bot is Online.`);
    updateTopGroupsBoard();

    setInterval(() => {
        updateTopGroupsBoard();
    }, 30000);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const hasAllowedRole = message.member.roles.cache.has(ALLOWED_CREATOR_ID) || message.author.id === ALLOWED_CREATOR_ID;

    if (message.content.startsWith('delete group')) {
        if (!hasAllowedRole) return;
        const targetMember = message.mentions.members.first();
        if (!targetMember) {
            return message.channel.send({ content: 'منشن ليدر القروب المراد حذفه.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
        }

        let userGroups = getLeaderOrOwnedGroups(targetMember);
        for (const gKey of userGroups) {
            let myGroup = db.groups[gKey];
            try {
                let guild = message.guild;
                let tChan = guild.channels.cache.get(myGroup.textChannelId);
                let vChan = guild.channels.cache.get(myGroup.voiceChannelId);
                let role = guild.roles.cache.get(myGroup.roleId);
                if (tChan) await tChan.delete().catch(() => {});
                if (vChan) await vChan.delete().catch(() => {});
                if (role) await role.delete().catch(() => {});
            } catch (e) {}

            delete db.groups[gKey];
        }

        saveDb();
        await updateTopGroupsBoard();
        await message.channel.send({ content: 'تم حذف قروبات الشخص بنجاح.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
        return;
    }

    if (message.content === '!setup') {
        if (!hasAllowedRole || message.channel.id !== CHANNELS.LEADER_PANEL) {
            return;
        }

        const leaderChannel = message.guild.channels.cache.get(CHANNELS.LEADER_PANEL);
        if (leaderChannel) {
            const embed = new EmbedBuilder()
                .setTitle('Leader Panel')
                .setDescription('هنا يقدر ليدر القروب يتحكم بقروبه بشكل سريع ومنظم.')
                .setColor('#2b2d31');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('leader_select_menu')
                .setPlaceholder('Choose a leader action')
                .addOptions([
                    { label: 'Role Color', description: 'تغيير لون رول القروب', value: 'btn_role_color' },
                    { label: 'Edit Role', description: 'تعديل اسم رول القروب', value: 'btn_edit_role' },
                    { label: 'Invite Member', description: 'دعوة عضو أو أكثر للقروب', value: 'btn_invite_member' },
                    { label: 'Kick Member', description: 'طرد عضو من القروب', value: 'btn_kick_member' },
                    { label: 'My Stats', description: 'عرض إحصائيات القروب', value: 'btn_my_stats' },
                    { label: 'Leave Group', description: 'الخروج أو حذف القروب', value: 'btn_leave_group' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            await leaderChannel.send({ embeds: [embed], components: [row] });
        }
        return;
    }

    if (message.content.toLowerCase() === 'crator group') {
        if (!hasAllowedRole) return;

        const replyMsg = await message.reply({ content: 'منشن الشخص الذي تريده أن يصبح ليدر للجروب:' }).catch(() => null);

        const filter = m => m.author.id === message.author.id;
        const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            if (replyMsg) await replyMsg.delete().catch(() => {});

            const targetOwner = msg.mentions.members.first();
            if (!targetOwner) {
                return message.channel.send({ content: 'لم تقم بمنشن أي عضو صحيح.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }

            const namePrompt = await message.channel.send({ content: 'اكتب اسم الجروب:' });
            const nameCollector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            nameCollector.on('collect', async (nameMsg) => {
                await nameMsg.delete().catch(() => {});
                await namePrompt.delete().catch(() => {});

                const groupName = nameMsg.content.trim();
                const groupKey = 'group_' + Date.now();

                try {
                    const guild = message.guild;
                    
                    const groupRole = await guild.roles.create({
                        name: groupName,
                        color: '#2b2d31',
                        reason: 'Group Role'
                    });

                    await targetOwner.roles.add(groupRole).catch(() => {});

                    const textChannel = await guild.channels.create({
                        name: groupName,
                        type: ChannelType.GuildText,
                        parent: CHANNELS.TEXT_CATEGORY,
                        permissionOverwrites: [
                            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: groupRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ]
                    });

                    const voiceChannel = await guild.channels.create({
                        name: groupName,
                        type: ChannelType.GuildVoice,
                        parent: CHANNELS.VOICE_CATEGORY,
                        permissionOverwrites: [
                            { id: guild.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
                            { id: groupRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }
                        ]
                    });

                    db.groups[groupKey] = {
                        name: groupName,
                        roleId: groupRole.id,
                        leaderId: targetOwner.id,
                        leaderName: targetOwner.user.username,
                        members: [],
                        xp: 0,
                        textCount: 0,
                        textChannelId: textChannel.id,
                        voiceChannelId: voiceChannel.id,
                        createdAt: Date.now()
                    };
                    saveDb();
                    await updateTopGroupsBoard();

                    await message.channel.send({ content: `تم إنشاء القروب بنجاح لليدر <@${targetOwner.id}>!` }).then(m => setTimeout(() => m.delete().catch(()=>{}), 10000));
                } catch (err) {
                    console.error(err);
                }
            });
        });
        return;
    }

    if (message.channel.type === ChannelType.GuildText) {
        let userGroupKey = Object.keys(db.groups).find(k => {
            let g = db.groups[k];
            return g.textChannelId === message.channel.id || 
                   message.member.roles.cache.has(g.roleId) ||
                   (g.name && message.channel.name && g.name.toLowerCase() === message.channel.name.toLowerCase());
        });
        
        if (userGroupKey) {
            let userGroup = db.groups[userGroupKey];
            if (userGroup.textChannelId !== message.channel.id) {
                userGroup.textChannelId = message.channel.id;
            }
            userGroup.xp = (userGroup.xp || 0) + 2;
            userGroup.textCount = (userGroup.textCount || 0) + 1;
            saveDb();
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'leader_select_menu') return;

    await interaction.deferUpdate().catch(() => {});

    const guild = interaction.guild;
    const member = interaction.member;

    let userOwnedGroups = getLeaderOrOwnedGroups(member);
    let myGroupKey = userOwnedGroups[0];
    let myGroup = myGroupKey ? db.groups[myGroupKey] : null;

    if (!myGroup && interaction.values[0] !== 'btn_my_stats') {
        const replyMsg = await interaction.followUp({ content: 'القائمة غير مخصصة لك أو ليس لديك قروب.', ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
        return;
    }

    const selectedValue = interaction.values[0];

    const currentSelectMenu = new StringSelectMenuBuilder()
        .setCustomId('leader_select_menu')
        .setPlaceholder('Choose a leader action')
        .addOptions([
            { label: 'Role Color', description: 'تغيير لون رول القروب', value: 'btn_role_color' },
            { label: 'Edit Role', description: 'تعديل اسم رول القروب', value: 'btn_edit_role' },
            { label: 'Invite Member', description: 'دعوة عضو أو أكثر للقروب', value: 'btn_invite_member' },
            { label: 'Kick Member', description: 'طرد عضو من القروب', value: 'btn_kick_member' },
            { label: 'My Stats', description: 'عرض إحصائيات القروب', value: 'btn_my_stats' },
            { label: 'Leave Group', description: 'الخروج أو حذف القروب', value: 'btn_leave_group' }
        ]);

    const row = new ActionRowBuilder().addComponents(currentSelectMenu);
    await interaction.editReply({ components: [row] }).catch(() => {});

    if (selectedValue === 'btn_my_stats') {
        if (!myGroup) {
            const replyMsg = await interaction.followUp({ content: 'ليس لديك قروب لعرض إحصائياته.', ephemeral: true });
            setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
            return;
        }
        const stats = `
-1- أعضاء القروب: ${(myGroup.members ? myGroup.members.length : 0) + 1}
-2- كم كلمة باليوم: ${myGroup.textCount || 0}
-3- كم اكس بي القروب: ${myGroup.xp || 0}
        `.trim();
        const replyMsg = await interaction.followUp({ content: stats, ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
        return;
    }

    if (selectedValue === 'btn_role_color') {
        const replyMsg = await interaction.followUp({ content: 'اكتب كود اللون السداسي في الروم الآن.', ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 5000);
        return;
    }

    if (selectedValue === 'btn_edit_role') {
        const replyMsg = await interaction.followUp({ content: 'اسم الرول مرتبط باسم القروب.', ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 5000);
        return;
    }

    if (selectedValue === 'btn_invite_member') {
        const replyMsg = await interaction.followUp({ content: 'منشن العضو الذي تريد إضافته للقروب.', ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 5000);
        return;
    }

    if (selectedValue === 'btn_kick_member') {
        const replyMsg = await interaction.followUp({ content: 'منشن العضو الذي تريد طرده من القروب.', ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 5000);
        return;
    }

    if (selectedValue === 'btn_leave_group') {
        try {
            let tChan = guild.channels.cache.get(myGroup.textChannelId);
            let vChan = guild.channels.cache.get(myGroup.voiceChannelId);
            let role = guild.roles.cache.get(myGroup.roleId);
            if (tChan) await tChan.delete().catch(() => {});
            if (vChan) await vChan.delete().catch(() => {});
            if (role) await role.delete().catch(() => {});
        } catch (e) {}

        delete db.groups[myGroupKey];
        saveDb();
        await updateTopGroupsBoard();
        const replyMsg = await interaction.followUp({ content: 'تم حذف قروبك بنجاح.', ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
        return;
    }
});

client.login(process.env.TOKEN);
