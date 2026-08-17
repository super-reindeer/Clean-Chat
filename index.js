require("dotenv").config();

// ==========================================
// RENDER WEB SERVER
// ==========================================
// Render Web Services expect an HTTP port.
// This tiny server keeps the Discord bot compatible
// with Render while the Discord Gateway stays connected.
const http = require("http");

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("CleanChat is online!");
}).listen(PORT, () => {
    console.log(`Web server listening on port ${PORT}`);
});

const {
    Client,
    GatewayIntentBits
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ==========================================
// WORDS TO CENSOR
// ==========================================

const blockedWords = [
    "fuck",
    "shit",
    "bitch",
    "asshole"
];

// ==========================================
// CENSOR FUNCTION
// ==========================================

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function censorText(text) {
    let result = text;

    for (const word of blockedWords) {
        const letters = word
            .split("")
            .map(escapeRegExp);

        const pattern = letters.join("[\\s._\\-*~`]*");

        const regex = new RegExp(`\\b${pattern}\\b`, "gi");

        // Escaped asterisks so Discord displays ****
        result = result.replace(regex, "\\*\\*\\*\\*");
    }

    return result;
}

// ==========================================
// WEBHOOK CACHE
// ==========================================

// One webhook per channel instead of creating
// and deleting one for every censored message.
const webhooks = new Map();

async function getWebhook(channel) {
    if (webhooks.has(channel.id)) {
        return webhooks.get(channel.id);
    }

    const webhook = await channel.createWebhook({
        name: "CleanChat",
        reason: "CleanChat censorship system"
    });

    webhooks.set(channel.id, webhook);

    return webhook;
}

// ==========================================
// BOT READY
// ==========================================

client.once("clientReady", () => {
    console.log(`CleanChat is online as ${client.user.tag}`);
});

// ==========================================
// MESSAGE FILTER
// ==========================================

client.on("messageCreate", async (message) => {

    // Ignore bots
    if (message.author.bot) return;

    // Ignore DMs
    if (!message.guild) return;

    const censoredText = censorText(message.content);

    // Nothing to censor
    if (censoredText === message.content) return;

    try {

        // Get/reuse webhook BEFORE deleting the message.
        // This means we don't have to wait for webhook
        // creation after the original message disappears.
        const webhook = await getWebhook(message.channel);

        // Delete original
        await message.delete();

        // Immediately repost
        await webhook.send({
            content: censoredText || "\\*\\*\\*\\*",

            username:
                message.member?.displayName ||
                message.author.globalName ||
                message.author.username,

            avatarURL: message.author.displayAvatarURL({
                extension: "png",
                size: 256
            }),

            allowedMentions: {
                parse: []
            }
        });

    } catch (error) {

        console.error("CENSOR ERROR:");
        console.error(error);

    }
});

// ==========================================
// LOGIN
// ==========================================

client.login(process.env.DISCORD_TOKEN);