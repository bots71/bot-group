Const { 
    Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    EmbedBuilder, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits 
} = require('discord.js');
const fs = require('fs');
const http = require('http');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully');
}).listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildVoiceStates
    ]
});

const CHANNELS = {
    TOP_GROUPS: "1535491143897325578",
    LEADER_PANEL: "1535491487763136542",
    COLOR_ROOM: "1535406298781192292",
    COLOR_ROOM_TARGET: "1536594815779864576", // روم الألوان الجديد
    TEXT_CATEGORY: "1536221607645814874",
    VOICE_CATEGORY: "1536221822717141012"
};

const ALLOWED_CREATOR_ID = "1535375782736560128";
const DB_FILE = './groups_db.json';
let db = { groups: {} };

function loadDb() {
    if (fs.existsSync(DB_FILE)) {
        try { 
            const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            db.groups = data.groups || data;
        } catch (e) { db = { groups: {} }; }
    }
}

function saveDb() { fs.writeFileSync(DB_FILE, JSON.stringify({ groups: db.groups }, null, 4)); }

function getLeaderOrOwnedGroups(member) {
    if (!member) return [];
    return Object.keys(db.groups).filter(k => {
        let g = db.groups[k];
        return g.leaderId === member.id || member.roles.cache.has(g.roleId);
    });
}

const COLOR_MAP = {
    "1": "#FFFFFF", "2": "#B39DDB", "3": "#7986CB", "4": "#5C6BC0", "5": "#455A64",
    "6": "#CE93D8", "7": "#9FA8DA", "8": "#5C6BC0", "9": "#AB47BC", "10": "#78909C",
    "11": "#BA68C8", "999": "#000000", "1010": "#2B2D31"
};

async function updateTopGroupsBoard() {
    try {
        const channel = await client.channels.fetch(CHANNELS.TOP_GROUPS).catch(() => null);
        if (!channel) return;

        let sortedGroups = Object.values(db.groups).sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 7);
        let description = "";

        // التنسيق الجديد: الاسم تحت الشرطة، ثم XP ثم الرقم
        sortedGroups.forEach((g, index) => {
            description += `${index + 1}-\n${g.name}\nXP ${g.xp || 0}\n\n`;
        });

        const embed = new EmbedBuilder()
            .setDescription(description || ' ')
            .setImage('https://cdn.discordapp.com/attachments/1536439598866239518/1536551508802404373/9A161D96-ADCF-4787-80D9-73C5DEFABFF6.png?ex=6a7bd09b&is=6a7a7f1b&hm=71063f8f3ebb33e9af0d22b948f56fd9f405807e325862f7b83edcc45735ce8a&')
            .setColor('#2b2d31');

        const messages = await channel.messages.fetch({ limit: 10 });
        await channel.bulkDelete(messages.filter(m => m.author.id === client.user.id));
        await channel.send({ embeds: [embed] });
    } catch (e) { console.error('Error updating top board', e); }
}

// ... سأكمل لك بقية الدوال (Create, Setup, Logic) في الرد القادم لضمان الحجم الكامل
client.once('ready', () => {
    loadDb();
    console.log(`Logged in as ${client.user.tag}`);
    updateTopGroupsBoard();

    setInterval(() => {
        updateTopGroupsBoard();
    }, 30000);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const hasAllowedRole = message.member.roles.cache.has(ALLOWED_CREATOR_ID) || message.author.id === ALLOWED_CREATOR_ID;

    if (message.content === 'فحص القروبات') {
        if (!hasAllowedRole) return;
        let groupList = Object.values(db.groups);
        let totalGroupsCount = groupList.length;
        let requiredWords = 25 + ((totalGroupsCount > 4 ? totalGroupsCount - 4 : 0) * 5);

        let report = `تقرير وفحص القروبات الشامل\nإجمالي عدد القروبات ${totalGroupsCount}\nالحد الأدنى المطلوب للكلمات اليومية لكل قروب ${requiredWords} كلمة\n-----------------------------------\n`;

        groupList.forEach((g, idx) => {
            let membersCount = (g.members ? g.members.length : 0) + 1;
            let wordsToday = g.textCount || 0;
            let hasWarning = false;

            if (membersCount < 4 || wordsToday < requiredWords) {
                hasWarning = true;
            }

            let statusIcon = hasWarning ? "تحذير" : "سليم";
            report += `${idx + 1} القروب ${g.name} الأعضاء ${membersCount} الكلمات ${wordsToday} ${statusIcon}\n`;
        });

        return message.channel.send({ content: report });
    }

    if (message.content.startsWith('delete group')) {
        if (!hasAllowedRole) return;
        const targetMember = message.mentions.members.first();
        if (!targetMember) {
            return message.channel.send({ content: 'منشن ليدر القروب المراد حذفه' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
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
        await message.channel.send({ content: 'تم حذف قروبات الشخص بنجاح' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
        return;
    }

    if (message.content === '!setup') {
        if (!hasAllowedRole || message.channel.id !== CHANNELS.LEADER_PANEL) {
            return;
        }

        const leaderChannel = message.guild.channels.cache.get(CHANNELS.LEADER_PANEL);
        if (leaderChannel) {
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
            await leaderChannel.send({ components: [row] });
        }
        return;
    }

    if (message.content.toLowerCase() === 'crator group') {
        if (!hasAllowedRole) return;

        const replyMsg = await message.reply({ content: 'منشن الشخص الذي تريده أن يصبح ليدر للجروب' }).catch(() => null);

        const filter = m => m.author.id === message.author.id;
        const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            if (replyMsg) await replyMsg.delete().catch(() => {});

            const targetOwner = msg.mentions.members.first();
            if (!targetOwner) {
                return message.channel.send({ content: 'لم تقم بمنشن أي عضو صحيح' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }

            const namePrompt = await message.channel.send({ content: 'اكتب اسم الجروب' });
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

                    await message.channel.send({ content: `تم إنشاء القروب بنجاح لليدر <@${targetOwner.id}>` }).then(m => setTimeout(() => m.delete().catch(()=>{}), 10000));
                } catch (err) {
                    console.error(err);
                }
            });
        });
        return;
    }

    if (message.channel.id === CHANNELS.COLOR_ROOM_TARGET) {
        let userOwned = getLeaderOrOwnedGroups(message.member);
        if (userOwned.length > 0) {
            let colorHex = COLOR_MAP[message.content.trim()];
            if (colorHex) {
                let myGroup = db.groups[userOwned[0]];
                let role = message.guild.roles.cache.get(myGroup.roleId);
                if (role) {
                    await role.setColor(colorHex).catch(()=>{});
                    await message.delete().catch(()=>{});
                    let confirm = await message.channel.send({ content: `تم تغيير لون رول القروب بنجاح` });
                    setTimeout(() => confirm.delete().catch(()=>{}), 2000);
                    return;
                }
            }
        }
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
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('accept_invite_')) {
            let groupKey = interaction.customId.replace('accept_invite_', '');
            let targetGroup = db.groups[groupKey];
            if (!targetGroup) return interaction.reply({ content: 'القروب لم يعد موجوداً', ephemeral: true });

            let guild = interaction.guild;
            let member = interaction.member;

            let existingGroups = getLeaderOrOwnedGroups(member);
            for (let oldKey of existingGroups) {
                let oldG = db.groups[oldKey];
                if (oldG && oldG.leaderId !== member.id) {
                    let oldRole = guild.roles.cache.get(oldG.roleId);
                    if (oldRole) await member.roles.remove(oldRole).catch(()=>{});
                }
            }

            let newRole = guild.roles.cache.get(targetGroup.roleId);
            if (newRole) await member.roles.add(newRole).catch(()=>{});
            if (!targetGroup.members.includes(member.id)) {
                targetGroup.members.push(member.id);
                saveDb();
            }

            return interaction.update({ content: `تم انضمامك بنجاح إلى قروب ${targetGroup.name}`, components: [] }).catch(()=>{});
        }

        if (interaction.customId.startsWith('decline_invite_')) {
            return interaction.update({ content: 'تم رفض الدعوة', components: [] }).catch(()=>{});
        }
        return;
    }

    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'leader_select_menu') return;

    await interaction.deferUpdate().catch(() => {});

    const guild = interaction.guild;
    const member = interaction.member;

    let userOwnedGroups = getLeaderOrOwnedGroups(member);
    let myGroupKey = userOwnedGroups[0];
    let myGroup = myGroupKey ? db.groups[myGroupKey] : null;

    if (!myGroup && interaction.values[0] !== 'btn_my_stats') {
        const replyMsg = await interaction.followUp({ content: 'القائمة غير مخصصة لك أو ليس لديك قروب', ephemeral: true });
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

    const channel = interaction.channel;

    if (selectedValue === 'btn_my_stats') {
        if (!myGroup) {
            const replyMsg = await interaction.followUp({ content: 'ليس لديك قروب لعرض إحصائياته', ephemeral: true });
            setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
            return;
        }
        let totalCount = (myGroup.members ? myGroup.members.length : 0) + 1;
        let wordsToday = myGroup.textCount || 0;
        let averageWords = Math.round(wordsToday / 7);

        const stats = `
-1- عدد القروب ${totalCount}
-2- كم كلمة كتبوها اليوم ${wordsToday}
-3- كم متوسط الكلمات التي يكتبونها يومياً ${averageWords}
        `.trim();
        const replyMsg = await interaction.followUp({ content: stats, ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 4000);
        return;
    }

    if (selectedValue === 'btn_role_color') {
        const replyMsg = await interaction.followUp({ content: `توجه إلى روم الألوان <#${CHANNELS.COLOR_ROOM_TARGET}> وأرسل رقم اللون المطلوب`, ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 6000);
        return;
    }

    if (selectedValue === 'btn_edit_role') {
        const promptMsg = await interaction.followUp({ content: `اكتب اسم رول القروب الجديد`, ephemeral: true });
        const filter = m => m.author.id === member.id;
        const collector = channel.createMessageCollector({ filter, time: 20000, max: 1 });

        collector.on('collect', async (m) => {
            await m.delete().catch(()=>{});
            let newName = m.content.trim();
            try {
                let role = guild.roles.cache.get(myGroup.roleId);
                if (role) await role.setName(newName);

                myGroup.name = newName;
                saveDb();
                await updateTopGroupsBoard();

                let confirm = await channel.send({ content: `تم` });
                setTimeout(() => confirm.delete().catch(()=>{}), 500);
            } catch (err) {}
        });
        return;
    }

    if (selectedValue === 'btn_invite_member') {
        const promptMsg = await interaction.followUp({ content: `منشن الأشخاص المراد دعوتهم للقروب`, ephemeral: true });
        const filter = m => m.author.id === member.id;
        const collector = channel.createMessageCollector({ filter, time: 25000, max: 1 });

        collector.on('collect', async (m) => {
            await m.delete().catch(()=>{});

            let mentions = m.mentions.members;
            if (mentions.size === 0) {
                let err = await channel.send({ content: 'عذراً لم تقم بمنشن أي شخص' });
                setTimeout(() => err.delete().catch(()=>{}), 3000);
                return;
            }

            for (let [id, targetMember] of mentions) {
                let targetOwned = getLeaderOrOwnedGroups(targetMember);
                if (targetOwned.length > 0 && targetOwned.some(k => db.groups[k].leaderId === targetMember.id)) {
                    let err = await channel.send({ content: `العضو ليدر لقروب آخر ولا يمكن دعوته` });
                    setTimeout(() => err.delete().catch(()=>{}), 3000);
                    continue;
                }

                try {
                    const rowBtns = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`accept_invite_${myGroupKey}`).setLabel('قبول').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`decline_invite_${myGroupKey}`).setLabel('رفض').setStyle(ButtonStyle.Secondary)
                    );

                    await targetMember.send({ 
                        content: `دعاك للانضمام إلى القروب ${myGroup.name}`, 
                        components: [rowBtns] 
                    });
                } catch (e) {
                    let err = await channel.send({ content: `لا يمكن إرسال رسالة خاصة للعضو` });
                    setTimeout(() => err.delete().catch(()=>{}), 4000);
                }
            }
        });
        return;
    }

    if (selectedValue === 'btn_kick_member') {
        const promptMsg = await interaction.followUp({ content: `منشن الشخص أو الأشخاص المراد طردهم من القروب`, ephemeral: true });
        const filter = m => m.author.id === member.id;
        const collector = channel.createMessageCollector({ filter, time: 25000, max: 1 });

        collector.on('collect', async (m) => {
            await m.delete().catch(()=>{});

            let mentions = m.mentions.members;
            if (mentions.size === 0) return;

            let role = guild.roles.cache.get(myGroup.roleId);
            for (let [id, targetMember] of mentions) {
                if (role) await targetMember.roles.remove(role).catch(()=>{});
                if (myGroup.members && myGroup.members.includes(targetMember.id)) {
                    myGroup.members = myGroup.members.filter(mId => mId !== targetMember.id);
                }
            }
            saveDb();
            let confirm = await channel.send({ content: `تم طرد العضو بنجاح وسحب الرول` });
            setTimeout(() => confirm.delete().catch(()=>{}), 3000);
        });
        return;
    }

    if (selectedValue === 'btn_leave_group') {
        let isLeader = myGroup.leaderId === member.id;

        if (isLeader) {
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
            const replyMsg = await interaction.followUp({ content: 'تم حذف قروبك بالكامل بنجاح', ephemeral: true });
            setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
        } else {
            let role = guild.roles.cache.get(myGroup.roleId);
            if (role) await member.roles.remove(role).catch(()=>{});
            if (myGroup.members) {
                myGroup.members = myGroup.members.filter(mId => mId !== member.id);
                saveDb();
            }
            const replyMsg = await interaction.followUp({ content: 'تم خروجك من القروب وسحب الرول بنجاح', ephemeral: true });
            setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
        }
        return;
    }
});

client.login(process.env.TOKEN);
