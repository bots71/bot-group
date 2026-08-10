const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ChannelType, 
    PermissionsBitField 
} = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// الأئمة والمعرفات المطلوبة
const CHANNELS = {
    TOP_GROUPS: "1535491143897325578",
    LEADER_PANEL: "1535491487763136542",
    COLOR_ROOM: "1535406298781192292"
};

const DB_FILE = './groups_db.json';

// قاعدة بيانات محلية لتخزين القروبات، الأعضاء، الـ XP، والليدر
let db = {
    groups: {} // { groupId: { name, leaderId, members: [], xp: 0, colorRoleId, voiceXp: 0, textCount: 0 } }
};

function loadDb() {
    if (fs.existsSync(DB_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        } catch (e) {
            db = { groups: {} };
        }
    }
}

function saveDb() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 4));
}

client.on('ready', async () => {
    loadDb();
    console.log(`Logged in as ${client.user.tag}! Groups Bot is Online.`);
});

// نظام احتساب الـ XP للرسائل والكتابة
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // البحث عما إذا كان العضو ينتمي لقروب لاحتساب الكلمات والـ XP (كل كلمة = 2 XP)
    let userGroup = Object.values(db.groups.groups || db.groups).find(g => g.leaderId === message.author.id || g.members.includes(message.author.id));
    
    if (userGroup) {
        const wordsCount = message.content.trim().split(/\s+/).length;
        const earnedXp = wordsCount * 2;
        userGroup.xp += earnedXp;
        userGroup.textCount = (userGroup.textCount || 0) + wordsCount;

        // كل 5000 XP تلقائياً يزيد القروب 1000 XP إضافية
        if (userGroup.xp >= 5000) {
            let increments = Math.floor(userGroup.xp / 5000);
            userGroup.xp += increments * 1000;
            // خصم المضاعف الحسابي لكي لا يتكرر بلا نهاية فورياً
            userGroup.xp = userGroup.xp % 5000; 
        }
        saveDb();
    }
});

// لوحة تحكم الليدر والأزرار التفاعلية
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const guild = interaction.guild;
    const member = interaction.member;
    const userId = member.id;

    // العثور على قروب المستخدم (سواء كان ليدر أو عضو)
    let allGroups = db.groups.groups || db.groups;
    let myGroupKey = Object.keys(allGroups).find(k => allGroups[k].leaderId === userId || allGroups[k].members.includes(userId));
    let myGroup = myGroupKey ? allGroups[myGroupKey] : null;
    let isLeader = myGroup && myGroup.leaderId === userId;

    const customId = interaction.customId;

    // 1. زر تغيير لون رول القروب (Role Color)
    if (customId === 'btn_role_color') {
        if (!isLeader) {
            return interaction.reply({ content: 'الصلاحيات غير مخصصة لك.', ephemeral: true });
        }
        await interaction.reply({ 
            content: `حدد لونك من هنا <#${CHANNELS.COLOR_ROOM}>`, 
            ephemeral: true 
        });
    }

    // 2. زر تعديل اسم رول القروب (Edit Role)
    if (customId === 'btn_edit_role') {
        if (!isLeader) {
            return interaction.reply({ content: 'الصلاحيات غير مخصصة لك.', ephemeral: true });
        }
        await interaction.reply({ content: 'اكتب اسم القروب الجديد:', ephemeral: true });

        const filter = m => m.author.id === userId;
        const channel = interaction.channel;
        const collector = channel.createMessageCollector({ filter, time: 15000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            const newName = msg.content;
            myGroup.name = newName;
            saveDb();

            // تحديث اسم الرول في الديسكورد إذا وجد
            if (myGroup.roleId) {
                const role = guild.roles.cache.get(myGroup.roleId);
                if (role) await role.setName(newName).catch(() => {});
            }

            await interaction.editReply({ content: `تم تحديث اسم القروب إلى: **${newName}** وإغلاق الشات فوراً.`, components: [] }).catch(() => {});
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ content: 'انتهى الوقت ولم تقم بإدخال اسم جديد.', components: [] }).catch(() => {});
            }
        });
    }

    // 3. زر دعوة عضو أو أكثر للقروب (Invite Member)
    if (customId === 'btn_invite_member') {
        if (!isLeader) {
            return interaction.reply({ content: 'الصلاحيات غير مخصصة لك.', ephemeral: true });
        }
        await interaction.reply({ 
            content: 'منشن العضو أو اكتب يوزره لدعوته للقروب:', 
            ephemeral: true 
        });

        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            const targetMember = msg.mentions.members.first() || guild.members.cache.find(m => m.user.tag === msg.content || m.id === msg.content);

            if (!targetMember) {
                return interaction.followUp({ content: 'لم يتم العثور على العضو المطلوب.', ephemeral: true });
            }

            // إرسال رسالة خاصة للعضو المدعو مع أزرار قبول أو رفض
            const inviteRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`accept_invite_${myGroupKey}`).setLabel('قبول').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`decline_invite_${myGroupKey}`).setLabel('رفض').setStyle(ButtonStyle.Danger)
            );

            try {
                await targetMember.send({
                    content: `دعوك للانضمام لقروبة (${myGroup.name})`,
                    components: [inviteRow]
                });
                await interaction.followUp({ content: `تم إرسال دعوة الانضمام إلى العضو ${targetMember.user.tag} بنجاح.`, ephemeral: true });
            } catch (err) {
                await interaction.followUp({ content: 'تعذر إرسال رسالة خاصة لهذا العضو.', ephemeral: true });
            }
        });
    }

    // قبول الدعوة عبر الخاص
    if (customId.startsWith('accept_invite_')) {
        const groupKey = customId.replace('accept_invite_', '');
        const targetGroup = allGroups[groupKey];
        if (targetGroup) {
            if (!targetGroup.members.includes(userId)) {
                targetGroup.members.push(userId);
                saveDb();
                // إعطاء رول القروب إذا وجد
                if (targetGroup.roleId) {
                    const r = guild.roles.cache.get(targetGroup.roleId);
                    if (r) await member.roles.add(r).catch(() => {});
                }
            }
            await interaction.update({ content: 'تم انضمامك للقروب بنجاح!', components: [] });
        }
    }

    // رفض الدعوة عبر الخاص
    if (customId.startsWith('decline_invite_')) {
        const groupKey = customId.replace('decline_invite_', '');
        const targetGroup = allGroups[groupKey];
        if (targetGroup) {
            // إرسال رسالة لليدر بأن الشخص رفض الدعوة
            const leaderUser = await client.users.fetch(targetGroup.leaderId).catch(() => null);
            if (leaderUser) {
                await leaderUser.send(`الشخص رفض الدعوة فقط`).catch(() => {});
            }
        }
        await interaction.update({ content: 'تم رفض الدعوة.', components: [] });
    }

    // 4. زر طرد عضو من القروب (Kick Member)
    if (customId === 'btn_kick_member') {
        if (!isLeader) {
            return interaction.reply({ content: 'الصلاحيات غير مخصصة لك.', ephemeral: true });
        }
        await interaction.reply({ content: 'منشن الأعضاء أو العضو الذي تريد طردهم:', ephemeral: true });

        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });

        collector.on('collect', async (msg) => {
            await msg.delete().catch(() => {});
            const kickedMembers = msg.mentions.members;

            if (kickedMembers.size === 0) {
                return interaction.followUp({ content: 'لم تقم بمنشن أي عضو.', ephemeral: true });
            }

            kickedMembers.forEach(km => {
                myGroup.members = myGroup.members.filter(id => id !== km.id);
                if (myGroup.roleId) {
                    km.roles.remove(myGroup.roleId).catch(() => {});
                }
            });
            saveDb();

            await interaction.followUp({ content: 'تم طرد الأعضاء المحددين من القروب بنجاح وانشال منهم رول القروب.', ephemeral: true });
        });
    }

    // 5. زر عرض إحصائيات القروب (My Stats)
    if (customId === 'btn_my_stats') {
        if (!myGroup) {
            return interaction.reply({ content: 'القائمة غير مخصصة لك، لست في أي قروب.', ephemeral: true });
        }

        const statsText = `
-1- أعضاء القروب: ${myGroup.members.length + 1} أعضاء
-2- كم كلمة باليوم: ${myGroup.textCount || 0} كلمة
-3- كم اكس بي القروب: ${myGroup.xp || 0} XP
-4- تفاعل الفويسات الصوتية واكس بي الفويس: ${myGroup.voiceXp || 0} XP
        `.trim();

        await interaction.reply({ content: statsText, ephemeral: true });
    }

    // 6. زر الخروج من القروب / حذف القروب (Leave / Delete Group)
    if (customId === 'btn_leave_group') {
        if (!myGroup) {
            return interaction.reply({ content: 'القائمة غير مخصصة لك.', ephemeral: true });
        }

        if (isLeader) {
            // حذف القروب كاملاً لليدر
            delete allGroups[myGroupKey];
            saveDb();
            await interaction.reply({ content: 'تم حذف القروب بنجاح.', ephemeral: true });
        } else {
            // الخروج للأعضاء فقط
            myGroup.members = myGroup.members.filter(id => id !== userId);
            if (myGroup.roleId) {
                member.roles.remove(myGroup.roleId).catch(() => {});
            }
            saveDb();
            await interaction.reply({ content: 'تم خروجك من القروب بنجاح.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
