const { 
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
        GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.DirectMessages
    ]
});

const CHANNELS = {
    TOP_GROUPS: "1535491143897325578",
    LEADER_PANEL: "1535491487763136542",
    SETUP_TARGET: "1536594815779864576",
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

function getLeaderGroupByMember(member) {
    if (!member) return null;
    let foundKey = Object.keys(db.groups).find(k => db.groups[k].leaderId === member.id);
    return foundKey ? { key: foundKey, data: db.groups[foundKey] } : null;
}

function getMemberGroupByRole(member) {
    if (!member) return null;
    let foundKey = Object.keys(db.groups).find(k => member.roles.cache.has(db.groups[k].roleId));
    return foundKey ? { key: foundKey, data: db.groups[foundKey] } : null;
}

async function updateTopGroupsBoard() {
    try {
        const channel = await client.channels.fetch(CHANNELS.TOP_GROUPS).catch(() => null);
        if (!channel) return;

        let sortedGroups = Object.values(db.groups).sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 7);
        let description = "";

        sortedGroups.forEach((g, index) => {
            description += `${index + 1}- ${g.name}\nXP ${g.xp || 0}\n\n`;
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
        
        let groupList = Object.values(db.groups).sort((a, b) => (b.xp || 0) - (a.xp || 0));
        let totalGroupsCount = groupList.length;
        let requiredWords = 25;

        let report = `تقرير وفحص القروبات الشامل\nعدد القروبات ${totalGroupsCount}\nالعدد المطلوب للكلمات اليوميه\n(${requiredWords})\n-----------------------------------\n`;

        groupList.forEach((g, idx) => {
            let membersCount = (g.members ? g.members.length : 0) + 1;
            let wordsToday = g.textCount || 0;
            let isCommitted = wordsToday >= requiredWords ? "نعم" : "لا";

            report += `-${idx + 1} القروب ${g.name}\n`;
            report += `-${idx + 1} الأعضاء ${membersCount}\n`;
            report += `-${idx + 1} الكلمات ملتزمين بيوميا 25 رسالة ${isCommitted}`;
            if (isCommitted === "لا") {
                report += ` ⚠️⚠️⚠️`;
            }
            report += `\n\n`;
        });

        return message.channel.send({ content: report });
    }

    if (message.content.startsWith('delete group')) {
        if (!hasAllowedRole) return;
        const targetMember = message.mentions.members.first();
        if (!targetMember) {
            return message.channel.send({ content: 'منشن ليدر القروب المراد حذفه' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
        }

        let leaderGroup = getLeaderGroupByMember(targetMember);
        if (leaderGroup) {
            let myGroup = leaderGroup.data;
            try {
                let guild = message.guild;
                let tChan = guild.channels.cache.get(myGroup.textChannelId);
                let vChan = guild.channels.cache.get(myGroup.voiceChannelId);
                let role = guild.roles.cache.get(myGroup.roleId);
                if (tChan) await tChan.delete().catch(() => {});
                if (vChan) await vChan.delete().catch(() => {});
                if (role) await role.delete().catch(() => {});
            } catch (e) {}

            delete db.groups[leaderGroup.key];
            saveDb();
            await updateTopGroupsBoard();
            await message.channel.send({ content: 'تم حذف قروب الشخص بنجاح' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
        }
        return;
    }

    if (message.content === '!setup') {
        if (!hasAllowedRole) return;
        const targetChannel = message.guild.channels.cache.get(CHANNELS.SETUP_TARGET) || message.channel;

        const panelEmbed = new EmbedBuilder()
            .setTitle('Leader Panel')
            .setDescription('هنا يقدر ليدر القروب يتحكم بقروبه بشكل سريع ومنظم.')
            .setColor('#2b2d31');

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('leader_select_menu')
            .setPlaceholder('Choose a leader action')
            .addOptions([
                { label: 'Edit Role', description: 'تعديل اسم رول القروب', value: 'btn_edit_role' },
                { label: 'Invite Member', description: 'دعوة عضو أو أكثر للقروب', value: 'btn_invite_member' },
                { label: 'Kick Member', description: 'طرد عضو من القروب', value: 'btn_kick_member' },
                { label: 'My Stats', description: 'عرض إحصائيات القروب', value: 'btn_my_stats' },
                { label: 'Leave Group', description: 'الخروج من القروب', value: 'btn_leave_group' },
                { label: 'Delete Group', description: 'حذف القروب', value: 'btn_delete_group' }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await targetChannel.send({ embeds: [panelEmbed], components: [row] });
        if (message.channel.id !== targetChannel.id) {
            await message.delete().catch(()=>{});
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

            try {
                let guild = await client.guilds.fetch(interaction.guildId || interaction.message.guildId).catch(() => null);
                if (!guild) {
                    guild = client.guilds.cache.first();
                }

                let member = await guild.members.fetch(interaction.user.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'تعذر العثور عليك في السيرفر', ephemeral: true });

                let newRole = guild.roles.cache.get(targetGroup.roleId);
                if (newRole) await member.roles.add(newRole).catch(() => {});

                if (!targetGroup.members.includes(member.id)) {
                    targetGroup.members.push(member.id);
                    saveDb();
                }

                return interaction.update({ content: `تم انضمامك بنجاح إلى قروب ${targetGroup.name}`, components: [] }).catch(() => {});
            } catch (e) {
                console.error(e);
                return interaction.reply({ content: 'حدث خطأ أثناء قبول الدعوة', ephemeral: true });
            }
        }

        if (interaction.customId.startsWith('decline_invite_')) {
            return interaction.update({ content: 'تم رفض الدعوة', components: [] }).catch(() => {});
        }
        return;
    }

    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'leader_select_menu') return;

    await interaction.deferUpdate().catch(() => {});

    const guild = interaction.guild;
    const member = interaction.member;
    const channel = interaction.channel;

    const selectedValue = interaction.values[0];

    let leaderObj = getLeaderGroupByMember(member);
    let memberObj = getMemberGroupByRole(member);

    let myGroupObj = leaderObj || memberObj;
    let myGroup = myGroupObj ? myGroupObj.data : null;
    let myGroupKey = myGroupObj ? myGroupObj.key : null;
    let isLeader = !!leaderObj;

    if (selectedValue === 'btn_leave_group') {
        if (!myGroup) {
            return interaction.followUp({ content: 'أنت ليس ليدر لأي جروب', ephemeral: true });
        }
        if (isLeader) {
            return interaction.followUp({ content: 'هذا الزر مخصص للعضو وليس لليدر', ephemeral: true });
        }

        let role = guild.roles.cache.get(myGroup.roleId);
        if (role) await member.roles.remove(role).catch(() => {});
        if (myGroup.members) {
            myGroup.members = myGroup.members.filter(mId => mId !== member.id);
            saveDb();
        }
        return interaction.followUp({ content: 'تم خروجك من القروب وسحب الرول بنجاح', ephemeral: true });
    }

    if (!isLeader) {
        return interaction.followUp({ content: 'أنت ليس ليدر لأي جروب', ephemeral: true });
    }

    if (selectedValue === 'btn_my_stats') {
        let totalCount = (myGroup.members ? myGroup.members.length : 0) + 1;
        let wordsToday = myGroup.textCount || 0;
        let averageWords = Math.round(wordsToday / 7);

        const stats = `
-1- عدد القروب ${totalCount}
-2- كم كلمة تكتب يوميا ${averageWords}
-3- كم كلمة كتبوها اليوم ${wordsToday}
        `.trim();
        return interaction.followUp({ content: stats, ephemeral: true });
    }

    if (selectedValue === 'btn_edit_role') {
        await channel.permissionOverwrites.edit(member.id, { SendMessages: true }).catch(() => {});
        await interaction.followUp({ content: `اكتب اسم الجروب الجديد`, ephemeral: true });
        
        const filter = m => m.author.id === member.id;
        const collector = channel.createMessageCollector({ filter, time: 20000, max: 1 });

        collector.on('collect', async (m) => {
            await m.delete().catch(() => {});
            await channel.permissionOverwrites.delete(member.id).catch(() => {});

            let newName = m.content.trim();
            try {
                let role = guild.roles.cache.get(myGroup.roleId);
                if (role) await role.setName(newName).catch(() => {});

                myGroup.name = newName;
                saveDb();
                await updateTopGroupsBoard();

                return interaction.followUp({ content: `تم التغيير`, ephemeral: true });
            } catch (err) {}
        });
        return;
    }

    if (selectedValue === 'btn_invite_member') {
        await channel.permissionOverwrites.edit(member.id, { SendMessages: true }).catch(() => {});
        await interaction.followUp({ content: `منشن الاعضاء المراد دعوتهم`, ephemeral: true });
        
        const filter = m => m.author.id === member.id;
        const collector = channel.createMessageCollector({ filter, time: 25000, max: 1 });

        collector.on('collect', async (m) => {
            await m.delete().catch(() => {});
            await channel.permissionOverwrites.delete(member.id).catch(() => {});

            let mentions = m.mentions.members;
            if (mentions.size === 0) {
                return interaction.followUp({ content: 'عذراً لم تقم بمنشن أي شخص', ephemeral: true });
            }

            for (let [id, targetMember] of mentions) {
                let targetGroup = getMemberGroupByRole(targetMember);
                if (targetGroup) {
                    await interaction.followUp({ content: `هذا العضو داخل جروب ثاني فما يمديك`, ephemeral: true });
                    continue;
                }

                try {
                    const rowBtns = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`accept_invite_${myGroupKey}`).setLabel('قبول').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`decline_invite_${myGroupKey}`).setLabel('رفض').setStyle(ButtonStyle.Secondary)
                    );

                    await targetMember.send({ 
                        content: `يريد دعوتك الى القروب (${myGroup.name})`, 
                        components: [rowBtns] 
                    });
                } catch (e) {
                    await interaction.followUp({ content: `لا يمكن إرسال رسالة خاصة للعضو`, ephemeral: true });
                }
            }

            return interaction.followUp({ content: `تم الارسال`, ephemeral: true });
        });
        return;
    }

    if (selectedValue === 'btn_kick_member') {
        await channel.permissionOverwrites.edit(member.id, { SendMessages: true }).catch(() => {});
        await interaction.followUp({ content: `منشن الاعضاء المراد طردهم`, ephemeral: true });
        
        const filter = m => m.author.id === member.id;
        const collector = channel.createMessageCollector({ filter, time: 25000, max: 1 });

        collector.on('collect', async (m) => {
            await m.delete().catch(() => {});
            await channel.permissionOverwrites.delete(member.id).catch(() => {});

            let mentions = m.mentions.members;
            if (mentions.size === 0) return;

            let role = guild.roles.cache.get(myGroup.roleId);
            let kickedAny = false;

            for (let [id, targetMember] of mentions) {
                let isMemberInGroup = (myGroup.members && myGroup.members.includes(targetMember.id)) || targetMember.roles.cache.has(myGroup.roleId);
                if (!isMemberInGroup) {
                    await interaction.followUp({ content: `هذا العضو ليس من ضمن بالفعل الى جروبك`, ephemeral: true });
                    continue;
                }

                if (role) await targetMember.roles.remove(role).catch(() => {});
                if (myGroup.members && myGroup.members.includes(targetMember.id)) {
                    myGroup.members = myGroup.members.filter(mId => mId !== targetMember.id);
                }
                kickedAny = true;
            }
            saveDb();

            if (kickedAny) {
                return interaction.followUp({ content: `تم الطرد`, ephemeral: true });
            }
        });
        return;
    }

    if (selectedValue === 'btn_delete_group') {
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
        return interaction.followUp({ content: 'تم حذف القروب بنجاح', ephemeral: true });
    }
});

client.login(process.env.TOKEN);
