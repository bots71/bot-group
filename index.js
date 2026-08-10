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

function loadDb() {
    if (fs.existsSync(DB_FILE)) {
        try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { db = { groups: {} }; }
    }
}
function saveDb() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 4));
}

let topGroupsMessage = null;

async function updateTopGroupsBoard() {
    try {
        const channel = await client.channels.fetch(CHANNELS.TOP_GROUPS).catch(() => null);
        if (!channel) return;

        let groupsObj = db.groups.groups || db.groups;
        let sortedGroups = Object.entries(groupsObj).sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0)).slice(0, 7);

        const embed = new EmbedBuilder()
            .setTitle('Top 7 Groups')
            .setColor('#2b2d31')
            .setImage('https://cdn.discordapp.com/attachments/1531644529818472458/1536220233352880158/9A161D96-ADCF-4787-80D9-73C5DEFABFF6.png?ex=6a7a9c15&is=6a794a95&hm=0a15683d587862c99d97e417edc6d32d9e6fff18567628bb659195228329b193&');

        if (!topGroupsMessage) {
            const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
            if (messages) {
                topGroupsMessage = messages.find(m => m.author.id === client.user.id);
            }
        }

        if (topGroupsMessage) {
            await topGroupsMessage.edit({ embeds: [embed] }).catch(() => { topGroupsMessage = null; });
        } else {
            topGroupsMessage = await channel.send({ embeds: [embed] });
        }
    } catch (e) {
        console.error(e);
    }
}

client.on('ready', () => {
    loadDb();
    console.log(`Logged in as ${client.user.tag}! Groups Bot is Online.`);
    setInterval(updateTopGroupsBoard, 30000);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const hasAllowedRole = message.member.roles.cache.has(ALLOWED_CREATOR_ID) || message.author.id === ALLOWED_CREATOR_ID;

    if (message.content === '!setup') {
        if (!hasAllowedRole || message.channel.id !== CHANNELS.LEADER_PANEL) {
            await message.react('❌').catch(() => {});
            return;
        }

        const leaderChannel = message.guild.channels.cache.get(CHANNELS.LEADER_PANEL);
        if (leaderChannel) {
            const embed = new EmbedBuilder()
                .setTitle('Leader Panel')
                .setDescription('هنا يقدر ليدر القروب يتحكم بقروحه بشكل سريع ومنظم.')
                .setColor('#2b2d31')
                .setThumbnail('https://cdn.discordapp.com/attachments/1531644529818472458/1536192486597197824/A2CE557C-489A-468B-826F-8076DE214463.png?ex=6a7a823d&is=6a7930bd&hm=f3847c68a29e21539c5c2b84af48a5255a970a72bc9aa970732f9ac8e330ff11&');

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
            await message.react('✅').catch(() => {});
        } else {
            await message.react('❌').catch(() => {});
        }
        return;
    }

    if (message.content.toLowerCase() === 'crator group') {
        if (!hasAllowedRole) {
            await message.react('❌').catch(() => {});
            return;
        }

        await message.react('✅').catch(() => {});
        const replyMsg = await message.reply({ content: 'منشن الشخص الذي تريده أن يصبح أونر للجروب:', ephemeral: true }).catch(() => null);

        const filter = m => m.author.id === message.author.id;
        const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            if (replyMsg) await replyMsg.delete().catch(() => {});

            const targetOwner = msg.mentions.members.first();
            if (!targetOwner) {
                return message.channel.send({ content: 'لم تقم بمنشن أي عضو صحيح.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }

            let groupsObj = db.groups.groups || db.groups;
            let existing = Object.values(groupsObj).find(g => g.leaderId === targetOwner.id);
            if (existing) {
                return message.channel.send({ content: 'هذا الشخص لديه قروب مسبقاً.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }

            const namePrompt = await message.channel.send({ content: 'اكتب اسم الجروب:' });
            const nameCollector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            nameCollector.on('collect', async (nameMsg) => {
                await nameMsg.delete().catch(() => {});
                await namePrompt.delete().catch(() => {});

                const groupName = nameMsg.content;
                const groupKey = 'group_' + Date.now();

                try {
                    const guild = message.guild;
                    
                    const textChannel = await guild.channels.create({
                        name: groupName,
                        type: ChannelType.GuildText,
                        parent: CHANNELS.TEXT_CATEGORY,
                        permissionOverwrites: [
                            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: targetOwner.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ]
                    });

                    const voiceChannel = await guild.channels.create({
                        name: groupName,
                        type: ChannelType.GuildVoice,
                        parent: CHANNELS.VOICE_CATEGORY,
                        permissionOverwrites: [
                            { id: guild.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
                            { id: targetOwner.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }
                        ]
                    });

                    groupsObj[groupKey] = {
                        name: groupName,
                        leaderId: targetOwner.id,
                        leaderAvatar: targetOwner.user.displayAvatarURL({ extension: 'png', size: 256 }),
                        members: [],
                        xp: 0,
                        textCount: 0,
                        textChannelId: textChannel.id,
                        voiceChannelId: voiceChannel.id,
                        createdAt: Date.now(),
                        warningDeadline: Date.now() + (3 * 24 * 60 * 60 * 1000)
                    };
                    saveDb();

                    await message.channel.send({ content: `تم إنشاء القروب بنجاح للأونر <@${targetOwner.id}>!` }).then(m => setTimeout(() => m.delete().catch(()=>{}), 10000));
                } catch (err) {
                    console.error(err);
                }
            });
        });
        return;
    }

    let groupsObj = db.groups.groups || db.groups;
    let userGroupKey = Object.keys(groupsObj).find(k => groupsObj[k].leaderId === message.author.id || (groupsObj[k].members && groupsObj[k].members.includes(message.author.id)));
    
    if (userGroupKey) {
        let userGroup = groupsObj[userGroupKey];
        const wordsCount = message.content.trim().split(/\s+/).length;
        const earnedXp = wordsCount * 2;
        userGroup.xp = (userGroup.xp || 0) + earnedXp;
        userGroup.textCount = (userGroup.textCount || 0) + wordsCount;

        if (userGroup.xp >= 5000) {
            let increments = Math.floor(userGroup.xp / 5000);
            userGroup.xp += increments * 1000;
            userGroup.xp = userGroup.xp % 5000;
        }
        saveDb();
    }
});

setInterval(async () => {
    loadDb();
    let groupsObj = db.groups.groups || db.groups;
    let now = Date.now();
    let modified = false;

    for (let key in groupsObj) {
        let g = groupsObj[key];
        let totalMembers = (g.members ? g.members.length : 0) + 1;
        if (totalMembers < 5) {
            if (g.warningDeadline && now > g.warningDeadline) {
                try {
                    let guild = client.guilds.cache.first();
                    if (guild) {
                        let tChan = guild.channels.cache.get(g.textChannelId);
                        let vChan = guild.channels.cache.get(g.voiceChannelId);
                        if (tChan) await tChan.delete().catch(() => {});
                        if (vChan) await vChan.delete().catch(() => {});
                    }
                } catch (e) {}
                delete groupsObj[key];
                modified = true;
            }
        } else {
            g.warningDeadline = null;
            modified = true;
        }
    }
    if (modified) saveDb();
}, 60000);

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'leader_select_menu') return;

    const guild = interaction.guild;
    const member = interaction.member;
    const userId = member.id;

    let groupsObj = db.groups.groups || db.groups;
    let myGroupKey = Object.keys(groupsObj).find(k => groupsObj[k].leaderId === userId || (groupsObj[k].members && groupsObj[k].members.includes(userId)));
    let myGroup = myGroupKey ? groupsObj[myGroupKey] : null;
    let isLeader = myGroup && myGroup.leaderId === userId;

    const selectedValue = interaction.values[0];

    if (selectedValue === 'btn_role_color') {
        if (!isLeader) return interaction.reply({ content: 'الصلاحيات غير مخصصة لك (هذا الخيار للأونر فقط).', ephemeral: true });
        return interaction.reply({ content: `حدد لونك من هنا <#${CHANNELS.COLOR_ROOM}>`, ephemeral: true });
    }

    if (selectedValue === 'btn_edit_role') {
        if (!isLeader) return interaction.reply({ content: 'الصلاحيات غير مخصصة لك (هذا الخيار للأونر فقط).', ephemeral: true });
        await interaction.reply({ content: 'اكتب اسم القروب الجديد:', ephemeral: true });

        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 15000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            const newName = msg.content;
            myGroup.name = newName;
            
            try {
                let tChan = guild.channels.cache.get(myGroup.textChannelId);
                let vChan = guild.channels.cache.get(myGroup.voiceChannelId);
                if (tChan) await tChan.setName(newName).catch(()=>{});
                if (vChan) await vChan.setName(newName).catch(()=>{});
            } catch (e) {}

            saveDb();
            await interaction.editReply({ content: `تم تحديث اسم القروب إلى: **${newName}**` }).catch(() => {});
        });
    }

    if (selectedValue === 'btn_invite_member') {
        if (!isLeader) return interaction.reply({ content: 'الصلاحيات غير مخصصة لك (هذا الخيار للأونر فقط).', ephemeral: true });
        await interaction.reply({ content: 'منشن الأعضاء المراد دعوتهم:', ephemeral: true });

        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            const targetMembers = msg.mentions.members;
            if (!targetMembers || targetMembers.size === 0) return interaction.followUp({ content: 'لم يتم العثور على أعضاء.', ephemeral: true });

            const inviteRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`accept_invite_${myGroupKey}`).setLabel('قبول').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`decline_invite_${myGroupKey}`).setLabel('رفض').setStyle(ButtonStyle.Danger)
            );

            targetMembers.forEach(async (targetMember) => {
                try {
                    await targetMember.send({ content: `دعوك للانضمام لقروب (${myGroup.name})`, components: [inviteRow] });
                } catch (e) {}
            });

            await interaction.followUp({ content: 'تم إرسال الدعوات بنجاح.', ephemeral: true });
        });
    }

    if (selectedValue === 'btn_kick_member') {
        if (!isLeader) return interaction.reply({ content: 'الصلاحيات غير مخصصة لك (هذا الخيار للأونر فقط).', ephemeral: true });
        await interaction.reply({ content: 'منشن الأعضاء المراد طردهم:', ephemeral: true });

        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            const kicked = msg.mentions.members;
            kicked.forEach(km => {
                myGroup.members = myGroup.members.filter(id => id !== km.id);
            });
            
            try {
                let tChan = guild.channels.cache.get(myGroup.textChannelId);
                let vChan = guild.channels.cache.get(myGroup.voiceChannelId);
                kicked.forEach(async km => {
                    if (tChan) await tChan.permissionOverwrites.delete(km.id).catch(()=>{});
                    if (vChan) await vChan.permissionOverwrites.delete(km.id).catch(()=>{});
                });
            } catch (e) {}

            saveDb();
            await interaction.followUp({ content: 'تم طرد الأعضاء المحددين بنجاح.', ephemeral: true });
        });
    }

    if (selectedValue === 'btn_my_stats') {
        if (!myGroup) return interaction.reply({ content: 'القائمة غير مخصصة لك.', ephemeral: true });
        const stats = `
-1- أعضاء القروب: ${(myGroup.members ? myGroup.members.length : 0) + 1}
-2- كم كلمة باليوم: ${myGroup.textCount || 0}
-3- كم اكس بي القروب: ${myGroup.xp || 0}
        `.trim();
        return interaction.reply({ content: stats, ephemeral: true });
    }

    if (selectedValue === 'btn_leave_group') {
        if (!myGroup) return interaction.reply({ content: 'القائمة غير مخصصة لك.', ephemeral: true });
        if (isLeader) {
            try {
                let tChan = guild.channels.cache.get(myGroup.textChannelId);
                let vChan = guild.channels.cache.get(myGroup.voiceChannelId);
                if (tChan) await tChan.delete().catch(() => {});
                if (vChan) await vChan.delete().catch(() => {});
            } catch (e) {}

            delete groupsObj[myGroupKey];
            saveDb();
            return interaction.reply({ content: 'تم حذف القروب بنجاح.', ephemeral: true });
        } else {
            myGroup.members = myGroup.members.filter(id => id !== userId);
            try {
                let tChan = guild.channels.cache.get(myGroup.textChannelId);
                let vChan = guild.channels.cache.get(myGroup.voiceChannelId);
                if (tChan) await tChan.permissionOverwrites.delete(userId).catch(()=>{});
                if (vChan) await vChan.permissionOverwrites.delete(userId).catch(()=>{});
            } catch (e) {}

            saveDb();
            return interaction.reply({ content: 'تم خروجك من القروب.', ephemeral: true });
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const customId = interaction.customId;
    const userId = interaction.user.id;
    const guild = interaction.guild;

    let groupsObj = db.groups.groups || db.groups;

    if (customId.startsWith('accept_invite_')) {
        const gKey = customId.replace('accept_invite_', '');
        const targetGroup = groupsObj[gKey];
        if (targetGroup) {
            if (!targetGroup.members.includes(userId) && targetGroup.leaderId !== userId) {
                targetGroup.members.push(userId);
                saveDb();

                try {
                    let tChan = guild.channels.cache.get(targetGroup.textChannelId);
                    let vChan = guild.channels.cache.get(targetGroup.voiceChannelId);
                    if (tChan) await tChan.permissionOverwrites.create(userId, { ViewChannel: true, SendMessages: true }).catch(()=>{});
                    if (vChan) await vChan.permissionOverwrites.create(userId, { ViewChannel: true, Connect: true, Speak: true }).catch(()=>{});
                } catch (e) {}
            }
        }
        return interaction.update({ content: 'تم انضمامك للقروب بنجاح!', components: [] });
    }

    if (customId.startsWith('decline_invite_')) {
        return interaction.update({ content: 'تم رفض الدعوة.', components: [] });
    }
});

client.login(process.env.TOKEN);
