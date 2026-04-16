/**
 * June X Ultra by Supreme — Session ID Generator Telegram Bot
 *
 * Commands:
 *   /start   — Welcome + inline menu
 *   /pair <phone> — Start pairing
 *   /cancel  — Cancel ongoing session
 *   /stats   — Show bot statistics
 *   /help    — Help & usage guide
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const pino = require('pino');
const moment = require('moment-timezone');
const lolcatjs = require('lolcatjs');
const { makeid } = require('./id');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require('@whiskeysockets/baileys');

// ─── Config ────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌  TELEGRAM_BOT_TOKEN is not set in .env');
    process.exit(1);
}

// Channel the user must join — bot must be admin of this channel
const REQUIRED_CHANNEL = '@trashcoresystem';
const CHANNEL_LINK = 'https://t.me/trashcoresystem';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ─── Stats (persisted to stats.json) ──────────────────────────────────────
const STATS_FILE = './stats.json';

function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
        }
    } catch (_) {}
    return {
        totalUsers: 0,
        uniqueUsers: [],
        totalRequested: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        startedAt: Date.now()
    };
}

function saveStats(s) {
    try { fs.writeFileSync(STATS_FILE, JSON.stringify(s, null, 2)); } catch (_) {}
}

const stats = loadStats();

function trackUser(chatId) {
    const id = String(chatId);
    if (!stats.uniqueUsers.includes(id)) {
        stats.uniqueUsers.push(id);
        stats.totalUsers = stats.uniqueUsers.length;
        saveStats(stats);
    }
}

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

// ─── Active sessions map ───────────────────────────────────────────────────
const activeSessions = new Map();

// ─── Pairing console logger ───────────────────────────────────────────────
function logPairing(status, num) {
    const TZ = 'Asia/Makassar';
    const dayz = moment(Date.now()).tz(TZ).locale('en').format('dddd');
    const timez = moment(Date.now()).tz(TZ).locale('en').format('HH:mm:ss z');
    const datez = moment(Date.now()).tz(TZ).format('DD/MM/YYYY');

    lolcatjs.fromString(`┏━━━━━━━━━━━━━『  JUNE X ULTRA  』━━━━━━━━━━━━━─`);
    lolcatjs.fromString(`»  Status: ${status}`);
    lolcatjs.fromString(`»  Time: ${dayz}, ${timez}`);
    lolcatjs.fromString(`»  Date: ${datez}`);
    lolcatjs.fromString(`»  Number: +${num}`);
    lolcatjs.fromString('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━─ ⳹\n');
}

// ─── Channel membership check ─────────────────────────────────────────────
async function isChannelMember(userId) {
    try {
        const member = await bot.getChatMember(REQUIRED_CHANNEL, userId);
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (_) {
        return true;
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function removeFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    fs.rmSync(filePath, { recursive: true, force: true });
}

async function sendCodeBlock(chatId, text) {
    await bot.sendMessage(chatId, `\`\`\`\n${text}\n\`\`\``, { parse_mode: 'Markdown' });
}

function joinGateKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '📢 Join Channel', url: CHANNEL_LINK }],
            [{ text: '✅ I have joined — Continue', callback_data: 'check_membership' }]
        ]
    };
}

function mainMenuKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: 'Get Session', callback_data: 'menu_pair' },
                { text: 'Stats',       callback_data: 'menu_stats' }
            ],
            [
                { text: 'Help',   callback_data: 'menu_help' },
                { text: 'Cancel', callback_data: 'menu_cancel' }
            ]
        ]
    };
}

function copyKeyboard(textToCopy) {
    return {
        inline_keyboard: [
            [{ text: '📋 Tap to Copy', copy_text: { text: textToCopy } }]
        ]
    };
}

function buildJoinMessage(firstName) {
    return (
        `╔════════════════════◇\n` +
        `║  🔷 *JUNE X ULTRA *\n` +
        `╠════════════════════◇\n` +
        `║ 👋 Hey *${firstName}!*\n` +
        `║\n` +
        `║ 🔒 To use this bot you must\n` +
        `║ join our channel first.\n` +
        `║\n` +
        `║ 1️⃣ Tap *Join Channel*\n` +
        `║ 2️⃣ Tap *I have joined — Continue*\n` +
        `╚════════════════════╝`
    );
}

function buildWelcomeMessage(firstName) {
    return (
        `╔════════════════════◇\n` +
        `║  🔷 *JUNE X ULTRA *\n` +
        `╠════════════════════◇\n` +
        `║ 👋 Hey *${firstName}!*\n` +
        `║ Generate WhatsApp Session IDs\n` +
        `║ fast & securely via Telegram.\n` +
        `╠════════════════════◇\n` +
        `║ 👥 Users served:   *${stats.totalUsers}*\n` +
        `║ ✅ Sessions made:  *${stats.totalSuccessful}*\n` +
        `╚════════════════════╝\n\n` +
        `Choose an option below 👇`
    );
}

function buildStatsMessage() {
    const uptime = formatUptime(Date.now() - stats.startedAt);
    const successRate = stats.totalRequested > 0
        ? ((stats.totalSuccessful / stats.totalRequested) * 100).toFixed(1)
        : '0.0';
    return (
        `╔════════════════════◇\n` +
        `║  *JUNE X ULTRA — BOT STATS*\n` +
        `╠════════════════════◇\n` +
        `║ ∭ Total Users:         *${stats.totalUsers}*\n` +
        `║ ∭ Active Sessions:     *${activeSessions.size}*\n` +
        `║ ∭ Sessions Requested:  *${stats.totalRequested}*\n` +
        `║ ∭ Successful:          *${stats.totalSuccessful}*\n` +
        `║ ∭ Failed:              *${stats.totalFailed}*\n` +
        `║ ∭ Success Rate:        *${successRate}%*\n` +
        `║ ∭ Uptime:              *${uptime}*\n` +
        `╚════════════════════╝`
    );
}

function buildHelpMessage() {
    return (
        `╔════════════════════◇\n` +
        `║  ❓ *HOW TO USE*\n` +
        `╠════════════════════◇\n` +
        `║ 1️⃣  Tap *Get Session* or send:\n` +
        `║     \`/pair 2547XXXXXXXX\`\n` +
        `║\n` +
        `║ 2️⃣  You'll receive a pairing code\n` +
        `║     like \`ABCD-EFGH\`\n` +
        `║\n` +
        `║ 3️⃣  In WhatsApp:\n` +
        `║     Linked Devices → Link a Device\n` +
        `║     → Link with phone number\n` +
        `║     → Enter the code\n` +
        `║\n` +
        `║ 4️⃣  SESSION_ID sent to WhatsApp ✅\n` +
        `╠════════════════════◇\n` +
        `║ 📌 *Commands:*\n` +
        `║  /pair <number> — Start pairing\n` +
        `║  /cancel — Cancel active session\n` +
        `║  /stats  — View bot statistics\n` +
        `║  /help   — Show this guide\n` +
        `╚════════════════════╝`
    );
}

// Send join gate to any unverified user
async function sendJoinGate(chatId, firstName) {
    return bot.sendMessage(chatId, buildJoinMessage(firstName || 'there'), {
        parse_mode: 'Markdown',
        reply_markup: joinGateKeyboard()
    });
}

async function requireMember(chatId, userId, firstName) {
    const ok = await isChannelMember(userId);
    if (!ok) await sendJoinGate(chatId, firstName);
    return ok;
}

// ─── /start ────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from?.first_name || 'there';

    if (!await requireMember(chatId, userId, firstName)) return;

    trackUser(chatId);
    bot.sendMessage(chatId, buildWelcomeMessage(firstName), {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard()
    });
});

// ─── /stats ────────────────────────────────────────────────────────────────
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    if (!await requireMember(chatId, msg.from.id, msg.from?.first_name)) return;
    trackUser(chatId);
    bot.sendMessage(chatId, buildStatsMessage(), {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard()
    });
});

// ─── /help ─────────────────────────────────────────────────────────────────
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    if (!await requireMember(chatId, msg.from.id, msg.from?.first_name)) return;
    trackUser(chatId);
    bot.sendMessage(chatId, buildHelpMessage(), {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard()
    });
});

// ─── /cancel ───────────────────────────────────────────────────────────────
bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    if (!await requireMember(chatId, msg.from.id, msg.from?.first_name)) return;
    const session = activeSessions.get(chatId);
    if (!session) return bot.sendMessage(chatId, '⚠️ No active pairing session to cancel.');
    try { if (session.sock) await session.sock.end(); } catch (_) {}
    removeFile(`./temp/${session.id}`);
    activeSessions.delete(chatId);
    bot.sendMessage(chatId, '🛑 Pairing session cancelled.', { reply_markup: mainMenuKeyboard() });
});

// ─── Inline button callbacks ───────────────────────────────────────────────
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const firstName = query.from?.first_name || 'there';
    await bot.answerCallbackQuery(query.id);

    // ── Membership confirmation ───────────────────────────────────────────
    if (query.data === 'check_membership') {
        const isMember = await isChannelMember(userId);
        if (!isMember) {
            return bot.sendMessage(chatId,
                `❌ *Not joined yet!*\n\nPlease join the channel first, then tap *I have joined* again.`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: joinGateKeyboard()
                }
            );
        }
        trackUser(chatId);
        return bot.sendMessage(chatId, buildWelcomeMessage(firstName), {
            parse_mode: 'Markdown',
            reply_markup: mainMenuKeyboard()
        });
    }

    // ── All other buttons require membership ──────────────────────────────
    if (!await requireMember(chatId, userId, firstName)) return;

    if (query.data === 'menu_stats') {
        return bot.sendMessage(chatId, buildStatsMessage(), {
            parse_mode: 'Markdown', reply_markup: mainMenuKeyboard()
        });
    }
    if (query.data === 'menu_help') {
        return bot.sendMessage(chatId, buildHelpMessage(), {
            parse_mode: 'Markdown', reply_markup: mainMenuKeyboard()
        });
    }
    if (query.data === 'menu_cancel') {
        const session = activeSessions.get(chatId);
        if (!session) return bot.sendMessage(chatId, '⚠️ No active pairing session to cancel.');
        try { if (session.sock) await session.sock.end(); } catch (_) {}
        removeFile(`./temp/${session.id}`);
        activeSessions.delete(chatId);
        return bot.sendMessage(chatId, '🛑 Session cancelled.', { reply_markup: mainMenuKeyboard() });
    }
    if (query.data === 'menu_pair') {
        return bot.sendMessage(chatId,
            `📱 Send your number with country code:\n\n\`/pair 2547XXXXXXXX\``,
            { parse_mode: 'Markdown' }
        );
    }
});

// ─── /pair ─────────────────────────────────────────────────────────────────
bot.onText(/\/pair(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const rawNumber = (match[1] || '').trim();

    if (!await requireMember(chatId, userId, msg.from?.first_name)) return;
    trackUser(chatId);

    if (!rawNumber) {
        return bot.sendMessage(chatId,
            '❌ Please provide your phone number.\n\nExample: `/pair 2547XXXXXXXX`',
            { parse_mode: 'Markdown' }
        );
    }

    const num = rawNumber.replace(/[^0-9]/g, '');
    if (num.length < 7 || num.length > 15) {
        return bot.sendMessage(chatId,
            '❌ Invalid phone number. Include country code, e.g. `2547XXXXXXXX`',
            { parse_mode: 'Markdown' }
        );
    }

    if (activeSessions.has(chatId)) {
        return bot.sendMessage(chatId,
            '⚠️ You already have an active pairing session.\n\nUse /cancel to stop it first.'
        );
    }

    stats.totalRequested++;
    saveStats(stats);

    await bot.sendMessage(chatId, `⏳ Starting pairing for *+${num}*…`, { parse_mode: 'Markdown' });

    const id = makeid();
    const sessionEntry = { id, sock: null, retries: 0 };
    activeSessions.set(chatId, sessionEntry);

    async function startPairing() {
        const { state, saveCreds } = await useMultiFileAuthState(`./temp/${id}`);
        const { version } = await fetchLatestBaileysVersion();
        let connectionClosed = false;

        try {
            const sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: 'silent' }).child({ level: 'silent' })
                    )
                },
                version,
                printQRInTerminal: false,
                logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
                browser: ['Ubuntu', 'Opera', '100.0.4815.0'],
                shouldSyncHistoryMessage: false,
                syncFullHistory: false,
                markOnlineOnConnect: false
            });

            sessionEntry.sock = sock;

            if (!sock.authState.creds.registered) {
                await delay(1500);
                const code = await sock.requestPairingCode(num);

                logPairing('Pairing Started ⏳', num);

                await bot.sendMessage(chatId, `✅ *Your WhatsApp Pairing Code:*`, { parse_mode: 'Markdown' });

                const formatted = code.length === 8
                    ? `${code.slice(0, 4)}-${code.slice(4)}`
                    : code;
                await sendCodeBlock(chatId, formatted);

                await bot.sendMessage(chatId,
                    `📱 Open WhatsApp → *Linked Devices* → *Link a Device*\n→ *Link with phone number* → Enter the code above\n\n⏳ Waiting for you to pair…`,
                    { parse_mode: 'Markdown' }
                );
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                if (connectionClosed) return;

                if (connection === 'open') {
                    connectionClosed = true;
                    await delay(5000);

                    logPairing('Paired Successfully ✅', num);

                    try {
                        let sessionId;
                        try {
                            const credsJson = JSON.stringify(sock.authState.creds);
                            const b64data = Buffer.from(credsJson).toString('base64');
                            sessionId = 'Ultra-X:~' + b64data;
                        } catch (_) {
                            const data = fs.readFileSync(`./temp/${id}/creds.json`);
                            const b64data = Buffer.from(data).toString('base64');
                            sessionId = 'Ultra-X:~' + b64data;
                        }

                        // Send session ID to WhatsApp
                        await sock.sendMessage(sock.user.id, { text: sessionId });

                        // Notify on Telegram with tap-to-copy button
                        await bot.sendMessage(chatId,
                            `🎉 *Pairing Successful!*\n\n` +
                            `✅ Your SESSION\\_ID has been sent to your *WhatsApp*.\n\n` +
                            `╔════════════════════◇\n` +
                            `║ 🔷 *June X Ultra by Supreme*\n` +
                            `║ Copy it from WhatsApp & paste\n` +
                            `║ as SESSION_ID in your deployment\n` +
                            `╚════════════════════╝`,
                            { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() }
                        );

                        // Send SESSION_ID to Telegram with tap-to-copy button
                        await bot.sendMessage(chatId,
                            `📋 *Your SESSION\\_ID* \\(tap the button below to copy\\):`,
                            {
                                parse_mode: 'MarkdownV2',
                                reply_markup: copyKeyboard(sessionId)
                            }
                        );

                        // Also send as a code block for easy copying
                        await sendCodeBlock(chatId, sessionId);

                        stats.totalSuccessful++;
                        saveStats(stats);

                    } catch (err) {
                        console.error('Error sending session:', err);
                        stats.totalFailed++;
                        saveStats(stats);
                        await bot.sendMessage(chatId,
                            '❌ Pairing succeeded but failed to retrieve session ID. Please try /pair again.'
                        );
                    } finally {
                        activeSessions.delete(chatId);
                        try {
                            if (sock.ws) sock.ws.close();
                            await sock.end();
                        } catch (_) {}
                        removeFile(`./temp/${id}`);
                    }

                } else if (connection === 'close' && !connectionClosed) {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

                    if (!isLoggedOut && sessionEntry.retries < 3) {
                        sessionEntry.retries++;
                        await delay(10000);
                        startPairing();
                    } else {
                        connectionClosed = true;
                        activeSessions.delete(chatId);
                        removeFile(`./temp/${id}`);
                        if (!isLoggedOut) {
                            logPairing('Pairing Failed ❌', num);
                            stats.totalFailed++;
                            saveStats(stats);
                            await bot.sendMessage(chatId,
                                '❌ Connection failed after multiple retries. Please use /pair again.',
                                { reply_markup: mainMenuKeyboard() }
                            );
                        }
                    }
                }
            });

        } catch (err) {
            console.error('Pairing error:', err);
            connectionClosed = true;
            activeSessions.delete(chatId);
            removeFile(`./temp/${id}`);
            logPairing('Pairing Failed ❌', num);
            stats.totalFailed++;
            saveStats(stats);
            await bot.sendMessage(chatId,
                '❌ Service unavailable. Please try again with /pair.',
                { reply_markup: mainMenuKeyboard() }
            );
        }
    }

    await startPairing();
});

// ─── Global error guards ───────────────────────────────────────────────────
process.on('unhandledRejection', (err) => console.error('UNHANDLED REJECTION:', err));
process.on('uncaughtException',  (err) => console.error('UNCAUGHT EXCEPTION:', err));

console.log('🤖 June X Ultra by Supreme — Telegram pairing bot is running…');
