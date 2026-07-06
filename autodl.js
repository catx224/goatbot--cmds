const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "autodl",
    aliases: ["dl", "download"],
    version: "1.0",
    author: "Mueid Mursalin Rifat",
    countDown: 5,
    role: 0,
    shortDescription: { en: "📥 Download videos" },
    longDescription: { en: "Download videos from YouTube, TikTok, Instagram, Facebook, and 30+ more platforms" },
    category: "media",
    guide: {
      en: "Just paste a video link in chat! Or use: {pn} <URL>"
    }
  },

  // This runs when user types .autodl
  onStart: async function ({ api, event, args, message }) {
    const url = args[0];
    if (!url) {
      return message.reply(
        `📥 𝗔𝘂𝘁𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿\n━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Just paste a video link in chat!\n\n` +
        `📱 Supports: YouTube, TikTok, Instagram, Facebook, Twitter/X, Reddit, Vimeo, Dailymotion, Pinterest, Twitch, LinkedIn, Snapchat, Likee, ShareChat, Telegram, Discord, Rumble, and more!\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👨‍💻 Mueid Mursalin Rifat`
      );
    }
    return await this.handleDownload(url, api, event, message);
  },

  // This runs for EVERY message (auto-detect)
  onChat: async function ({ api, event, message }) {
    const { body, senderID } = event;
    
    // Skip if message is from bot or empty
    if (!body || senderID === api.getCurrentUserID()) return;

    // Find URL in message
    const linkRegEx = /(https?:\/\/[^\s]+)/g;
    const match = body.match(linkRegEx);

    if (match) {
      const url = match[0];
      
      // List of supported platforms
      const sites = [
        "tiktok.com", "vm.tiktok", "vt.tiktok",
        "facebook.com", "fb.watch", "fb.com",
        "instagram.com", "instagr.am", "reels",
        "youtube.com", "youtu.be",
        "pinterest.com", "pin.it",
        "twitter.com", "x.com", "t.co",
        "reddit.com", "redd.it",
        "vimeo.com",
        "dailymotion.com", "dai.ly",
        "twitch.tv", "clips.twitch",
        "linkedin.com",
        "snapchat.com",
        "likee.video", "likee.com",
        "sharechat.com",
        "t.me", "telegram.org",
        "discord.com", "discord.gg",
        "rumble.com",
        "bitchute.com",
        "odysee.com", "odysee.tv",
        "lbry.tv",
        "kick.com",
        "trovo.live"
      ];
      
      // Check if URL is from a supported platform
      if (sites.some(s => url.includes(s))) {
        return await this.handleDownload(url, api, event, message);
      }
    }
  },

  // Main download function
  handleDownload: async function (url, api, event, message) {
    const { messageID, threadID } = event;
    const start = Date.now();
    let waitMsg = null;

    try {
      // Send reaction
      if (api.setMessageReaction) {
        api.setMessageReaction("⌛", messageID, () => {}, true);
      }

      // Detect platform
      const platform = detectPlatform(url);

      // Send processing message
      waitMsg = await message.reply(
        `📥 Downloading...\n📱 Platform: ${platform}\n⏳ Please wait...`
      );

      // Build API URL
      const apiUrl = `https://shadowx-downloader.vercel.app/dl?url=${encodeURIComponent(url)}&key=shadowx`;
      console.log("Downloading from:", apiUrl);

      const response = await axios.get(apiUrl, { timeout: 30000 });
      const data = response.data;

      if (!data.success) {
        if (waitMsg) await api.unsendMessage(waitMsg.messageID).catch(() => {});
        if (api.setMessageReaction) api.setMessageReaction("❌", messageID, () => {}, true);
        return message.reply(`❌ Failed to download from ${platform}.\n💡 Make sure the URL is correct.`);
      }

      // Extract download URL
      let downloadUrl = data.download?.url;
      
      if (downloadUrl && downloadUrl.startsWith("/")) {
        downloadUrl = `https://shadowx-downloader.vercel.app${downloadUrl}`;
      }
      
      if (!downloadUrl) {
        if (waitMsg) await api.unsendMessage(waitMsg.messageID).catch(() => {});
        if (api.setMessageReaction) api.setMessageReaction("❌", messageID, () => {}, true);
        return message.reply("❌ No download URL found.");
      }

      console.log("Download URL:", downloadUrl);

      // Get file extension
      const filename = data.download?.filename || "video.mp4";
      const ext = filename.includes(".mp4") ? "mp4" : 
                  filename.includes(".mp3") ? "mp3" : 
                  filename.includes(".mpg") ? "mpg" : "mp4";
      
      const tempPath = path.join(__dirname, `autodl_${Date.now()}.${ext}`);

      // Download the file
      const fileResponse = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        timeout: 120000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const writer = fs.createWriteStream(tempPath);
      fileResponse.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        fileResponse.data.on('error', reject);
      });

      // Delete waiting message
      if (waitMsg) await api.unsendMessage(waitMsg.messageID).catch(() => {});

      // Get file size
      const stats = fs.statSync(tempPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      // Calculate time
      const time = ((Date.now() - start) / 1000).toFixed(2);

      // Build success message
      const title = data.title || "Video";
      const uploader = data.uploader || "Unknown";
      const duration = data.duration || "Unknown";
      const views = data.view_count ? formatViews(data.view_count) : "Unknown";
      const platformName = data.download?.platform || platform || "Unknown";
      const qualityUsed = data.download?.quality || "best";

      const messageBody = 
`✅ 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹!
━━━━━━━━━━━━━━━━━━━━━━━━
📹 Title: ${title.slice(0, 60)}${title.length > 60 ? "..." : ""}
👤 Uploader: ${uploader}
⏱️ Duration: ${duration}
👁️ Views: ${views}
📊 Quality: ${qualityUsed}
📦 Size: ${fileSizeMB} MB
📱 Platform: ${platformName}
⏱️ Time: ${time}s
━━━━━━━━━━━━━━━━━━━━━━━━
🔖 Author: Mueid Mursalin Rifat`;

      // Send video
      await message.reply({
        body: messageBody,
        attachment: fs.createReadStream(tempPath)
      });

      // Success reaction
      if (api.setMessageReaction) {
        api.setMessageReaction("✅", messageID, () => {}, true);
      }

      // Clean up
      setTimeout(() => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }, 10000);

    } catch (error) {
      console.error("Download error:", error);
      
      if (waitMsg) {
        try { await api.unsendMessage(waitMsg.messageID); } catch(e) {}
      }
      
      if (api.setMessageReaction) {
        api.setMessageReaction("❌", messageID, () => {}, true);
      }
      
      let errorMsg = `❌ 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗙𝗮𝗶𝗹𝗲𝗱\n━━━━━━━━━━━━━━━━━━━━\n`;
      
      if (error.code === 'ECONNABORTED') {
        errorMsg += `⏰ Request timeout.\n💡 The file might be too large.\n`;
      } else if (error.response?.status === 404) {
        errorMsg += `🔗 URL not found.\n💡 Check if the video exists.\n`;
      } else if (error.response?.status === 413) {
        errorMsg += `📦 File too large.\n💡 Try a lower quality.\n`;
      } else {
        errorMsg += `🔧 ${error.message}\n`;
      }
      
      errorMsg += `\n━━━━━━━━━━━━━━━━━━━━\n👨‍💻 Mueid Mursalin Rifat`;
      
      message.reply(errorMsg);
    }
  }
};

// Detect platform from URL
function detectPlatform(url) {
  const urlLower = url.toLowerCase();
  
  const platforms = [
    { name: "YouTube", patterns: ["youtube.com", "youtu.be"] },
    { name: "TikTok", patterns: ["tiktok.com", "vm.tiktok", "vt.tiktok"] },
    { name: "Instagram", patterns: ["instagram.com", "instagr.am"] },
    { name: "Facebook", patterns: ["facebook.com", "fb.watch", "fb.com"] },
    { name: "Twitter/X", patterns: ["twitter.com", "x.com", "t.co"] },
    { name: "Reddit", patterns: ["reddit.com", "redd.it"] },
    { name: "Vimeo", patterns: ["vimeo.com"] },
    { name: "Dailymotion", patterns: ["dailymotion.com", "dai.ly"] },
    { name: "Pinterest", patterns: ["pinterest.com", "pin.it"] },
    { name: "Twitch", patterns: ["twitch.tv", "clips.twitch"] },
    { name: "LinkedIn", patterns: ["linkedin.com"] },
    { name: "Snapchat", patterns: ["snapchat.com"] },
    { name: "Likee", patterns: ["likee.video", "likee.com"] },
    { name: "ShareChat", patterns: ["sharechat.com"] },
    { name: "Telegram", patterns: ["t.me", "telegram.org"] },
    { name: "Discord", patterns: ["discord.com", "discord.gg"] },
    { name: "Rumble", patterns: ["rumble.com"] },
    { name: "BitChute", patterns: ["bitchute.com"] },
    { name: "Odysee", patterns: ["odysee.com", "odysee.tv"] },
    { name: "LBRY", patterns: ["lbry.tv"] },
    { name: "Kick", patterns: ["kick.com"] },
    { name: "Trovo", patterns: ["trovo.live"] }
  ];
  
  for (const platform of platforms) {
    for (const pattern of platform.patterns) {
      if (urlLower.includes(pattern)) {
        return platform.name;
      }
    }
  }
  
  return "Unknown";
}

function formatViews(views) {
  if (!views) return "0";
  if (typeof views === 'string') {
    if (views.includes('M')) return views;
    if (views.includes('K')) return views;
    if (views.includes('B')) return views;
    return views;
  }
  if (views >= 1e9) return (views / 1e9).toFixed(1) + "B";
  if (views >= 1e6) return (views / 1e6).toFixed(1) + "M";
  if (views >= 1e3) return (views / 1e3).toFixed(1) + "K";
  return views.toString();
}
