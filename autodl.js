const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "autodl",
    aliases: ["dl", "download"],
    version: "1.0",
    author: "Mueid Mursalin Rifat",
    countDown: 10,
    role: 0,
    shortDescription: { en: "📥 Download videos" },
    longDescription: { en: "Download videos from YouTube, TikTok, Instagram, Facebook, and 30+ more platforms" },
    category: "media",
    guide: {
      en: "Just type: {pn} <URL>\n\n" +
           "Or just paste a URL in chat!\n\n" +
           "📱 Supports: YouTube, TikTok, Instagram, Facebook, Twitter/X, Reddit, Vimeo, Dailymotion, Pinterest, Twitch, LinkedIn, Snapchat, Likee, ShareChat, Moj, Roposo, Chingari, Mitron, MxTakaTak, Triller, Kwai, Threads, Telegram, Discord, Rumble, BitChute, Odysee, LBRY, Kick, Trovo"
    }
  },

  // This runs when user types .autodl
  onStart: async function ({ api, event, args, message }) {
    // Combine all args to get full message
    const fullMessage = args.join(" ");
    
    // Try to find URL in the message
    let url = null;
    const urls = extractUrls(fullMessage);
    
    if (urls && urls.length > 0) {
      url = urls[0];
    }
    
    // If no URL found, check if it's a reply
    if (!url && event.messageReply) {
      const replyText = event.messageReply.body || "";
      const replyUrls = extractUrls(replyText);
      if (replyUrls && replyUrls.length > 0) {
        url = replyUrls[0];
      }
    }
    
    // If still no URL, show help
    if (!url) {
      return message.reply(
        `📥 𝗔𝘂𝘁𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿\n━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 Usage: ${this.config.name} <URL>\n\n` +
        `📍 Examples:\n` +
        `• ${this.config.name} https://youtube.com/watch?v=...\n` +
        `• ${this.config.name} https://tiktok.com/@user/video/...\n` +
        `• Reply to a message with ${this.config.name}\n\n` +
        `📱 30+ Platforms Supported\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👨‍💻 Mueid Mursalin Rifat`
      );
    }

    // Check quality in message
    let quality = "best";
    const qualityMatch = fullMessage.match(/\b(best|720|480|360)\b/i);
    if (qualityMatch) {
      quality = qualityMatch[0].toLowerCase();
    }

    return processDownload(api, event, message, url, quality);
  }
};

// Main download processing function
async function processDownload(api, event, message, url, quality) {
  const threadID = event.threadID;
  let waitMsg = null;
  
  try {
    // Detect platform
    const platform = detectPlatform(url);
    
    // Send processing message
    waitMsg = await message.reply(
      `📥 Downloading video...\n📱 Platform: ${platform}\n📊 Quality: ${quality}`
    );

    // Build API URL
    let apiUrl = `https://shadowx-downloader.vercel.app/dl?url=${encodeURIComponent(url)}&key=shadowx`;
    if (quality !== "best") {
      apiUrl += `&quality=${quality}`;
    }

    console.log("Downloading from:", apiUrl);

    const response = await axios.get(apiUrl, { timeout: 30000 });
    const data = response.data;

    if (!data.success) {
      if (waitMsg) await api.unsendMessage(waitMsg.messageID).catch(() => {});
      return message.reply(
        `❌ Failed to download from ${platform}.\n💡 Make sure the URL is correct.`
      );
    }

    // Extract download URL
    let downloadUrl = data.download?.url;
    
    if (downloadUrl && downloadUrl.startsWith("/")) {
      downloadUrl = `https://shadowx-downloader.vercel.app${downloadUrl}`;
    }
    
    if (!downloadUrl) {
      if (waitMsg) await api.unsendMessage(waitMsg.messageID).catch(() => {});
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

    // Build success message
    const title = data.title || "Video";
    const uploader = data.uploader || "Unknown";
    const duration = data.duration || "Unknown";
    const views = data.view_count ? formatViews(data.view_count) : "Unknown";
    const platformName = data.download?.platform || platform || "Unknown";
    const qualityUsed = data.download?.quality || quality;

    const messageBody = 
`✅ 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹!
━━━━━━━━━━━━━━━━━━━━━━━━
📹 Title: ${title}
👤 Uploader: ${uploader}
⏱️ Duration: ${duration}
👁️ Views: ${views}
📊 Quality: ${qualityUsed}
📦 Size: ${fileSizeMB} MB
📱 Platform: ${platformName}
━━━━━━━━━━━━━━━━━━━━━━━━
🔖 Author: Mueid Mursalin Rifat`;

    // Send video
    await message.reply({
      body: messageBody,
      attachment: fs.createReadStream(tempPath)
    });

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

// Extract URLs from text
function extractUrls(text) {
  if (!text) return [];
  
  const patterns = [
    // YouTube
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/|user\/|channel\/|playlist\?list=)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S*)?/gi,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}/gi,
    /(?:https?:\/\/)?youtu\.be\/[a-zA-Z0-9_-]{11}/gi,
    
    // TikTok
    /(?:https?:\/\/)?(?:www\.|vm\.|vt\.)?tiktok\.com\/(?:@[a-zA-Z0-9_.]+\/video\/|v\/|embed\/|t\/)[a-zA-Z0-9]+/gi,
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+\/video\/\d+/gi,
    /(?:https?:\/\/)?vm\.tiktok\.com\/[a-zA-Z0-9]+\/?/gi,
    /(?:https?:\/\/)?vt\.tiktok\.com\/[a-zA-Z0-9]+\/?/gi,
    
    // Facebook
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/(?:watch\/\?v=|watch\?v=|reel\/|video\.php\?v=|photo\.php\?v=|story\.php\?id=|permalink\.php\?story_fbid=|plugins\/video\.php\?href=)\S+/gi,
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/[a-zA-Z0-9.]+\/videos\/\d+/gi,
    /(?:https?:\/\/)?(?:www\.|m\.)?fb\.watch\/[a-zA-Z0-9]+/gi,
    /(?:https?:\/\/)?fb\.watch\/[a-zA-Z0-9]+/gi,
    
    // Instagram
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|p|tv|stories)\/[a-zA-Z0-9_-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/[a-zA-Z0-9_-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reel\/[a-zA-Z0-9_-]+/gi,
    
    // Twitter/X
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/\d+/gi,
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/\d+\?s=\d+/gi,
    /(?:https?:\/\/)?t\.co\/[a-zA-Z0-9]+/gi,
    
    // Reddit
    /(?:https?:\/\/)?(?:www\.)?reddit\.com\/r\/\w+\/comments\/\w+\/[^\/]+\//gi,
    /(?:https?:\/\/)?redd\.it\/[a-zA-Z0-9]+/gi,
    
    // Vimeo
    /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/\d+/gi,
    
    // Dailymotion
    /(?:https?:\/\/)?(?:www\.)?dailymotion\.com\/video\/[a-zA-Z0-9]+/gi,
    /(?:https?:\/\/)?(?:www\.)?dai\.ly\/[a-zA-Z0-9]+/gi,
    
    // Pinterest
    /(?:https?:\/\/)?(?:www\.)?pinterest\.com\/pin\/\d+/gi,
    /(?:https?:\/\/)?(?:www\.)?pin\.it\/[a-zA-Z0-9]+/gi,
    
    // Twitch
    /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/\w+\/clip\/[a-zA-Z0-9_-]+/gi,
    /(?:https?:\/\/)?(?:clips\.)?twitch\.tv\/[a-zA-Z0-9_-]+/gi,
    
    // LinkedIn
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/posts\/[a-zA-Z0-9_-]+/gi,
    
    // Snapchat
    /(?:https?:\/\/)?(?:www\.)?snapchat\.com\/add\/[a-zA-Z0-9]+/gi,
    
    // Likee
    /(?:https?:\/\/)?(?:www\.)?likee\.video\/[a-zA-Z0-9_-]+/gi,
    
    // ShareChat
    /(?:https?:\/\/)?(?:www\.)?sharechat\.com\/[a-zA-Z0-9_-]+/gi,
    
    // Telegram
    /(?:https?:\/\/)?t\.me\/[a-zA-Z0-9_]+\/\d+/gi,
    
    // Discord
    /(?:https?:\/\/)?(?:www\.)?discord\.com\/channels\/\d+\/\d+\/\d+/gi,
    /(?:https?:\/\/)?(?:www\.)?discord\.gg\/[a-zA-Z0-9_-]+/gi,
    
    // Rumble
    /(?:https?:\/\/)?(?:www\.)?rumble\.com\/v\/[a-zA-Z0-9_-]+/gi,
    
    // BitChute
    /(?:https?:\/\/)?(?:www\.)?bitchute\.com\/video\/[a-zA-Z0-9_-]+/gi,
    
    // Odysee
    /(?:https?:\/\/)?(?:www\.)?odysee\.com\/@[a-zA-Z0-9_.]+\/[a-zA-Z0-9_-]+/gi,
    
    // LBRY
    /(?:https?:\/\/)?(?:www\.)?lbry\.tv\/@[a-zA-Z0-9_.]+\/[a-zA-Z0-9_-]+/gi,
    
    // Kick
    /(?:https?:\/\/)?(?:www\.)?kick\.com\/[a-zA-Z0-9]+\/videos\/[a-zA-Z0-9_-]+/gi,
    
    // Trovo
    /(?:https?:\/\/)?(?:www\.)?trovo\.live\/[a-zA-Z0-9_]+\/[a-zA-Z0-9_-]+/gi,
    
    // General URL (fallback)
    /(?:https?:\/\/)[^\s]+/gi
  ];
  
  const allMatches = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const cleanUrl = match.replace(/[.,;:!?]$/, '');
        if (!allMatches.includes(cleanUrl)) {
          allMatches.push(cleanUrl);
        }
      }
    }
  }
  
  return allMatches;
}

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
