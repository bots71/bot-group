const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder,
    StringSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
    AttachmentBuilder
} = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
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

async function generateTopBoardImage(sortedGroups) {
    const canvas = createCanvas(1200, 675);
    const ctx = canvas.getContext('2d');

    // خلفية لوحة الترتيب الاحترافية
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // عنوان اللوحة والإحصائيات العامة
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('MYTH', 120, 75);

    ctx.fillStyle = '#8b9bb4';
    ctx.font = '16px sans-serif';
    ctx.fillText('Performance board / activity • voice • events', 120, 105);

    let totalXpAll = sortedGroups.reduce((acc, g) => acc + (g.xp || 0), 0);

    // مربعات الإحصائيات العلوية
    function drawStatBox(x, y, w, h, title, val) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#8b9bb4';
        ctx.font = '12px sans-serif';
        ctx.fillText(title, x + 20, y + 25);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(val, x + 20, y + 52);
    }

    drawStatBox(520, 45, 95, 70, 'GROUPS', sortedGroups.length);
    drawStatBox(630, 45, 120, 70, 'TOTAL XP', totalXpAll.toLocaleString());
    drawStatBox(765, 45, 105, 70, 'EVENT WINS', '0');

    let dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    drawStatBox(885, 45, 150, 70, 'UPDATED', dateStr);

    // المركز الأول (#1)
    ctx.fillStyle = 'rgba(255, 180, 100, 0.05)';
    ctx.strokeStyle = 'rgba(255, 180, 100, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(45, 150, 410, 475, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('#1', 75, 190);

    ctx.fillStyle = '#8b9bb4';
    ctx.font = '12px sans-serif';
    ctx.fillText('CURRENT CHAMPION', 115, 190);

    let topGroup = sortedGroups[0];
    if (topGroup) {
        // رسم صورة الليدر أو القروب دائرية
        ctx.save();
        ctx.beginPath();
        ctx.arc(130, 290, 50, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        try {
            const avatarImg = await loadImage(topGroup.leaderAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png');
            ctx.drawImage(avatarImg, 80, 240, 100, 100);
        } catch (e) {
            ctx.fillStyle = '#333';
            ctx.fillRect(80, 240, 100, 100);
        }
        ctx.restore();

        // إطار دائرى متوهج للمركز الأول
        ctx.strokeStyle = '#ffb464';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(130, 290, 50, 0, Math.PI * 2, true);
        ctx.stroke();

        // اسم القروب واسم الليدر
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText(topGroup.name || 'USER', 200, 280);

        ctx.fillStyle = '#8b9bb4';
        ctx.font = '14px sans-serif';
        ctx.fillText(`Leader • ${topGroup.leaderName || 'user'}`, 200, 315);

        // إحصائيات المركز الأول
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.roundRect(65, 375, 200, 65, 10);
        ctx.roundRect(280, 375, 155, 65, 10);
        ctx.fill();

        ctx.fillStyle = '#8b9bb4';
        ctx.font = '11px sans-serif';
        ctx.fillText('TOTAL EXPERIENCE', 80, 400);
        ctx.fillText('EVENT WINS', 295, 400);

        ctx.fillStyle = '#ffb464';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText((topGroup.xp || 0).toLocaleString(), 80, 430);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('0', 295, 430);

        // شريط التقدم
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(65, 495, 370, 8, 4);
        ctx.fill();

        ctx.fillStyle = '#ffb464';
        ctx.beginPath();
        ctx.roundRect(65, 495, 370, 8, 4);
        ctx.fill();

        ctx.fillStyle = '#8b9bb4';
        ctx.font = '12px sans-serif';
        ctx.fillText('Leading the board', 65, 535);
        ctx.fillText('Defend the crown.', 320, 535);
    }

    // المراكز من #2 إلى #7
    let cardPositions = [
        { x: 480, y: 150 },
        { x: 840, y: 150 },
        { x: 480, y: 275 },
        { x: 840, y: 275 },
        { x: 480, y: 400 },
        { x: 840, y: 400 }
    ];

    for (let i = 1; i <= 6; i++) {
        let g = sortedGroups[i];
        let pos = cardPositions[i - 1];
        if (!pos) break;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(pos.x, pos.y, 335, 105, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`#${i + 1}`, pos.x + 20, pos.y + 28);

        if (g) {
            // صورة مصغرة دائرية
            ctx.save();
            ctx.beginPath();
            ctx.arc(pos.x + 50, pos.y + 65, 20, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            try {
                let av = await loadImage(g.leaderAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png');
                ctx.drawImage(av, pos.x + 30, pos.y + 45, 40, 40);
            } catch (e) {
                ctx.fillStyle = '#333';
                ctx.fillRect(pos.x + 30, pos.y + 45, 40, 40);
            }
            ctx.restore();

            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pos.x + 50, pos.y + 65, 20, 0, Math.PI * 2, true);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(g.name || 'USER', pos.x + 85, pos.y + 55);

            ctx.fillStyle = '#8b9bb4';
            ctx.font = '12px sans-serif';
            ctx.fillText(`Leader • ${g.leaderName || 'user'}`, pos.x + 85, pos.y + 78);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${(g.xp || 0).toLocaleString()} XP`, pos.x + 315, pos.y + 55);

            ctx.fillStyle = '#8b9bb4';
            ctx.font = '11px sans-serif';
            ctx.fillText('0 WINS', pos.x + 315, pos.y + 78);
            ctx.textAlign = 'left';
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText('USER', pos.x + 85, pos.y + 55);

            ctx.fillStyle = '#8b9bb4';
            ctx.font = '12px sans-serif';
            ctx.fillText('Leader • user', pos.x + 85, pos.y + 78);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('0 XP', pos.x + 315, pos.y + 55);

            ctx.fillStyle = '#8b9bb4';
            ctx.font = '11px sans-serif';
            ctx.fillText('0 WINS', pos.x + 315, pos.y + 78);
            ctx.textAlign = 'left';
        }
    }

    return canvas.toBuffer('image/png');
}

async function updateTopGroupsBoard() {
    try {
        const channel = await client.channels.fetch(CHANNELS.TOP_GROUPS).catch(() => null);
        if (!channel) return;

        let groupsObj = db.groups.groups || db.groups;
        let sortedGroups = Object.values(groupsObj).sort((a, b) => (b.xp || 0) - (a.xp || 0));

        const buffer = await generateTopBoardImage(sortedGroups);
        const attachment = new AttachmentBuilder(buffer, { name: 'top-groups.png' });

        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        if (messages) {
            const botMessages = messages.filter(m => m.author.id === client.user.id);
            for (const [id, msg] of botMessages) {
                await msg.delete().catch(() => {});
            }
        }

        await channel.send({ files: [attachment] });
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

    if (message.content.startsWith('delete group')) {
        if (!hasAllowedRole) return;
        const targetMember = message.mentions.members.first();
        if (!targetMember) {
            return message.channel.send({ content: 'منشن ليدر القروب المراد حذفه.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
        }

        let groupsObj = db.groups.groups || db.groups;
        let foundKey = Object.keys(groupsObj).find(k => groupsObj[k].leaderId === targetMember.id);
        if (!foundKey) {
            return message.channel.send({ content: 'هذا الشخص ليس لديه قروب.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
        }

        let myGroup = groupsObj[foundKey];
        try {
            let guild = message.guild;
            let tChan = guild.channels.cache.get(myGroup.textChannelId);
            let vChan = guild.channels.cache.get(myGroup.voiceChannelId);
            let role = guild.roles.cache.get(myGroup.roleId);
            if (tChan) await tChan.delete().catch(() => {});
            if (vChan) await vChan.delete().catch(() => {});
            if (role) await role.delete().catch(() => {});
        } catch (e) {}

        delete groupsObj[foundKey];
        saveDb();
        await message.channel.send({ content: 'تم حذف القروب بنجاح.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
        return;
    }

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
        const replyMsg = await message.reply({ content: 'منشن الشخص الذي تريده أن يصبح ليدر للجروب:', ephemeral: true }).catch(() => null);

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
            let existingGroupsCount = Object.values(groupsObj).filter(g => g.leaderId === targetOwner.id || (g.members && g.members.includes(targetOwner.id))).length;
            if (existingGroupsCount >= 2) {
                return message.channel.send({ content: 'هذا الشخص معه جروبين لازم يحذفه عشان يقدر يدخل' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }

            const namePrompt = await message.channel.send({ content: 'اكتب اسم الجروب:' });
            const nameCollector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            nameCollector.on('collect', async (nameMsg) => {
                await nameMsg.delete().catch(() => {});
                await namePrompt.delete().catch(() => {});

                const groupName = nameMsg.content.trim();
                
                let isColorRoleName = false;
                const lowerName = groupName.toLowerCase();
                for (let i = 0; i <= 11; i++) {
                    if (lowerName === String(i) || lowerName === `${i}`) {
                        isColorRoleName = true;
                        break;
                    }
                }
                if (lowerName === '10 10' || lowerName === '10-10' || lowerName === '999') {
                    isColorRoleName = true;
                }

                if (isColorRoleName) {
                    return message.channel.send({ content: 'الاسم محجوز، اختر اسم غيره.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
                }

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

                    groupsObj[groupKey] = {
                        name: groupName,
                        roleId: groupRole.id,
                        leaderId: targetOwner.id,
                        leaderName: targetOwner.user.username,
                        leaderAvatar: targetOwner.user.displayAvatarURL({ extension: 'png', size: 256 }),
                        members: [],
                        xp: 0,
                        textCount: 0,
                        textChannelId: textChannel.id,
                        voiceChannelId: voiceChannel.id,
                        createdAt: Date.now()
                    };
                    saveDb();

                    await message.channel.send({ content: `تم إنشاء القروب بنجاح لليدر <@${targetOwner.id}>!` }).then(m => setTimeout(() => m.delete().catch(()=>{}), 10000));
                } catch (err) {
                    console.error(err);
                }
            });
        });
        return;
    }

    if (message.channel.type === ChannelType.GuildText) {
        let groupsObj = db.groups.groups || db.groups;
        let userGroupKey = Object.keys(groupsObj).find(k => groupsObj[k].leaderId === message.author.id || (groupsObj[k].members && groupsObj[k].members.includes(message.author.id)));
        
        if (userGroupKey) {
            let userGroup = groupsObj[userGroupKey];
            const earnedXp = 2;
            userGroup.xp = (userGroup.xp || 0) + earnedXp;
            userGroup.textCount = (userGroup.textCount || 0) + 1;
            saveDb();
        }
    }
});

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
    await interaction.update({ components: [row] }).catch(() => {});

    if (selectedValue === 'btn_role_color') {
        if (!isLeader) {
            const replyMsg = await interaction.followUp({ content: 'الصلاحيات غير مخصصة لك (هذا الخيار لليدر فقط).', ephemeral: true });
            setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
            return;
        }
        
        try {
            await interaction.channel.permissionOverwrites.edit(userId, { SendMessages: true });
        } catch (e) {}

        const replyMsg = await interaction.followUp({ content: `حدد لونك من هنا <#${CHANNELS.COLOR_ROOM}>`, ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 5000);

        const colorRoomChannel = guild.channels.cache.get(CHANNELS.COLOR_ROOM);
        if (colorRoomChannel) {
            const colorFilter = m => m.author.id === userId;
            const colorCollector = colorRoomChannel.createMessageCollector({ filter: colorFilter, time: 30000, max: 1 });

            colorCollector.on('collect', async (colorMsg) => {
                try {
                    await colorMsg.delete().catch(() => {});
                } catch (e) {}

                let poRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'po' || r.name.toLowerCase() === 'بو');
                if (poRole && myGroup && myGroup.roleId) {
                    try {
                        const groupRole = guild.roles.cache.get(myGroup.roleId);
                        if (groupRole) {
                            await groupRole.setColor(poRole.color).catch(() => {});
                        }
                    } catch (e) {}
                }
            });
        }

        setTimeout(async () => {
            try {
                await interaction.channel.permissionOverwrites.edit(userId, { SendMessages: null });
            } catch (e) {}
        }, 15000);
        return;
    }

    if (selectedValue === 'btn_edit_role') {
        if (!isLeader) {
            const replyMsg = await interaction.followUp({ content: 'الصلاحيات غير مخصصة لك (هذا الخيار لليدر فقط).', ephemeral: true });
            setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
            return;
        }
        
        try {
            await interaction.channel.permissionOverwrites.edit(userId, { SendMessages: true });
        } catch (e) {}

        const replyMsg = await interaction.followUp({ content: 'اكتب اسم القروب الجديد:', ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 3000);

        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 15000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            const newName = msg.content.trim();
            
            let isColorRoleName = false;
            const lowerName = newName.toLowerCase();
            for (let i = 0; i <= 11; i++) {
                if (lowerName === String(i) || lowerName === `${i}`) {
                    isColorRoleName = true;
                    break;
                }
            }
            if (lowerName === '10 10' || lowerName === '10-10' || lowerName === '999') {
                isColorRoleName = true;
            }

            if (isColorRoleName) {
                const failMsg = await interaction.channel.send({ content: 'الاسم محجوز، اختر اسم غيره.' });
                setTimeout(() => failMsg.delete().catch(() => {}), 5000);
                return;
            }

            myGroup.name = newName;
            
            try {
                let tChan = guild.channels.cache.get(myGroup.textChannelId);
                let vChan = guild.channels.cache.get(myGroup.voiceChannelId);
                let role = guild.roles.cache.get(myGroup.roleId);
                if (tChan) await tChan.setName(newName).catch(()=>{});
                if (vChan) await vChan.setName(newName).catch(()=>{});
                if (role) await role.setName(newName).catch(()=>{});
                await interaction.channel.permissionOverwrites.edit(userId, { SendMessages: null });
            } catch (e) {}

            saveDb();
            const successMsg = await interaction.channel.send({ content: `تم تحديث اسم القروب إلى: **${newName}**` }).catch(() => {});
            if (successMsg) setTimeout(() => successMsg.delete().catch(() => {}), 5000);
        });
    }

    if (selectedValue === 'btn_invite_member') {
        if (!isLeader) {
            const replyMsg = await interaction.followUp({ content: 'الصلاحيات غير مخصصة لك (هذا الخيار لليدر فقط).', ephemeral: true });
            setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
            return;
        }
        
        try {
            await interaction.channel.permissionOverwrites.edit(userId, { SendMessages: true });
        } catch (e) {}

        const replyMsg = await interaction.followUp({ content: 'منشن الأعضاء المراد دعوتهم:', ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 3000);

        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            try {
                await interaction.channel.permissionOverwrites.edit(userId, { SendMessages: null });
            } catch (e) {}

            const targetMembers = msg.mentions.members;
            if (!targetMembers || targetMembers.size === 0) {
                const failMsg = await interaction.channel.send({ content: 'لم يتم العثور على أعضاء.' });
                setTimeout(() => failMsg.delete().catch(() => {}), 5000);
                return;
            }

            for (const [targetId, targetMember] of targetMembers) {
                let existingGroupsCount = Object.values(groupsObj).filter(g => g.leaderId === targetId || (g.members && g.members.includes(targetId))).length;
                if (existingGroupsCount >= 2) {
                    const failMsg = await interaction.followUp({ content: 'هذا الشخص داخل جروبين', ephemeral: true });
                    setTimeout(() => failMsg.delete().catch(() => {}), 5000);
                    continue;
                }

                const inviteRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`accept_invite_${myGroupKey}`).setLabel('قبول').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`decline_invite_${myGroupKey}`).setLabel('رفض').setStyle(ButtonStyle.Danger)
                );

                try {
                    await targetMember.send({ content: `دعوك للانضمام لقروب (${myGroup.name})`, components: [inviteRow] });
                } catch (e) {}
            }

            const successMsg = await interaction.channel.send({ content: 'تم إرسال الدعوات بنجاح.' });
            setTimeout(() => successMsg.delete().catch(() => {}), 5000);
        });
    }

    if (selectedValue === 'btn_kick_member') {
        if (!isLeader) {
            const replyMsg = await interaction.followUp({ content: 'الصلاحيات غير مخصصة لك (هذا الخيار لليدر فقط).', ephemeral: true });
            setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
            return;
        }
        
        try {
            await interaction.channel.permissionOverwrites.edit(userId, { SendMessages: true });
        } catch (e) {}

        const replyMsg = await interaction.followUp({ content: 'منشن العضو أو اكتب اليوزر المراد طرده:', ephemeral: true });
        setTimeout(() => replyMsg.delete().catch(() => {}), 3000);

        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            try {
                await interaction.channel.permissionOverwrites.edit(userId, { SendMessages: null });
            } catch (e) {}

            const targetMember = msg.mentions.members.first() || guild.members.cache.find(m => m.user.username === msg.content.trim() || m.user.tag === msg.content.trim() || m.id === msg.content.trim());

            if (!targetMember) {
                const errorMsg = await interaction.user.send({ content: 'المينشن واليوزر غير صحيح' }).catch(() => null);
                if (!errorMsg) {
                    const fallbackMsg = await interaction.channel.send({ content: `<@${userId}> المينشن واليوزر غير صحيح` });
                    setTimeout(() => fallbackMsg.delete().catch(() => {}), 5000);
                }
                return;
            }

            myGroup.members = myGroup.members.filter(id => id !== targetMember.id);
            
            try {
                if (myGroup.roleId) {
                    await targetMember.roles.remove(myGroup.roleId).catch(() => {});
                }
            } catch (e) {}

            saveDb();
            const successMsg = await interaction.channel.send({ content: 'تم طرد العضو المحدد بنجاح.' });
            setTimeout(() => successMsg.delete().catch(() => {}), 5000);
        });
    }

    if (selectedValue === 'btn_my_stats') {
        if (!myGroup) {
            const replyMsg = await interaction.followUp({ content: 'القائمة غير مخصصة لك.', ephemeral: true });
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

    if (selectedValue === 'btn_leave_group') {
        if (!myGroup) {
            const replyMsg = await interaction.followUp({ content: 'القائمة غير مخصصة لك.', ephemeral: true });
            setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
            return;
        }
        if (isLeader) {
            try {
                let tChan = guild.channels.cache.get(myGroup.textChannelId);
                let vChan = guild.channels.cache.get(myGroup.voiceChannelId);
                let role = guild.roles.cache.get(myGroup.roleId);
                if (tChan) await tChan.delete().catch(() => {});
                if (vChan) await vChan.delete().catch(() => {});
                if (role) await role.delete().catch(() => {});
            } catch (e) {}

            delete groupsObj[myGroupKey];
            saveDb();
            const replyMsg = await interaction.followUp({ content: 'تم حذف القروب بنجاح.', ephemeral: true });
            setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
            return;
        } else {
            myGroup.members = myGroup.members.filter(id => id !== userId);
            try {
                if (myGroup.roleId) {
                    let memberObj = await guild.members.fetch(userId).catch(() => null);
                    if (memberObj) await memberObj.roles.remove(myGroup.roleId).catch(() => {});
                }
            } catch (e) {}

            saveDb();
            const replyMsg = await interaction.followUp({ content: 'تم خروجك من القروب.', ephemeral: true });
            setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
            return;
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
                    let memberObj = await guild.members.fetch(userId).catch(() => null);
                    if (memberObj && targetGroup.roleId) {
                        await memberObj.roles.add(targetGroup.roleId).catch(() => {});
                    }
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
