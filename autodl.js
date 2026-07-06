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
    shortDescription: { en: "📥 Download videos from multiple platforms" },
    longDescription: { en: "Auto-detect and download videos from YouTube, TikTok, Instagram, Facebook, Twitter, Reddit, and 30+ more platforms" },
    category: "media",
    guide: {
      en: "{pn} [URL] [quality]\n\n" +
           "📌 Quality: best, 720, 480, 360 (default: best)\n\n" +
           "📍 Examples:\n" +
           "• {pn} https://youtube.com/watch?v=...\n" +
           "• {pn} https://tiktok.com/@user/video/... 720\n" +
           "• Reply to a message with {pn}\n\n" +
           "📱 30+ Platforms Supported"
    }
  },

  onStart: async function ({ api, event, args, message }) {
    // Auto detect URL from message
    let url = null;
    let quality = "best";
    
    // Check all arguments for URLs
    const allText = args.join(" ");
    const urlMatches = extractUrls(allText);
    
    if (urlMatches && urlMatches.length > 0) {
      url = urlMatches[0];
    }
    
    // If no URL found in args, check message reply
    if (!url && event.messageReply) {
      const replyText = event.messageReply.body || "";
      const replyMatches = extractUrls(replyText);
      if (replyMatches && replyMatches.length > 0) {
        url = replyMatches[0];
      }
    }
    
    // Check for quality in args
    if (args.length > 0) {
      const lastArg = args[args.length - 1];
      if (["best", "720", "480", "360"].includes(lastArg)) {
        quality = lastArg;
      }
    }
    
    // If still no URL, show help
    if (!url) {
      return message.reply(
        `📥 𝗔𝘂𝘁𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿\n━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 Usage: ${this.config.name} [URL] [quality]\n\n` +
        `📝 Quality: best, 720, 480, 360\n\n` +
        `📍 Examples:\n` +
        `• ${this.config.name} https://youtube.com/watch?v=...\n` +
        `• ${this.config.name} https://tiktok.com/@user/video/... 720\n` +
        `• Reply to a message with ${this.config.name}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 30+ Platforms Supported:\n` +
        `YouTube, TikTok, Instagram, Facebook, Twitter/X, Reddit, Vimeo, Dailymotion, Pinterest, Twitch, LinkedIn, Snapchat, Likee, ShareChat, Moj, Roposo, Chingari, Mitron, MxTakaTak, Triller, Kwai, Threads, Telegram, Discord, Rumble, BitChute, Odysee, LBRY, Kick, Trovo\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👨‍💻 Mueid Mursalin Rifat`
      );
    }

    // Detect platform from URL
    const platform = detectPlatform(url);

    try {
      // Send processing message
      const waitMsg = await message.reply(
        `📥 Downloading...\n` +
        `🔗 ${url}\n` +
        `📱 Platform: ${platform}\n` +
        `📊 Quality: ${quality}`
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
        await api.unsendMessage(waitMsg.messageID);
        return message.reply(
          `❌ 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗙𝗮𝗶𝗹𝗲𝗱\n━━━━━━━━━━━━━━━━━━━━\n` +
          `⚠️ Could not download from this URL.\n\n` +
          `💡 Make sure:\n` +
          `• The URL is correct\n` +
          `• The video is accessible\n` +
          `• The platform is supported\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👨‍💻 Mueid Mursalin Rifat`
        );
      }

      // Extract download URL
      let downloadUrl = data.download?.url;
      
      if (downloadUrl && downloadUrl.startsWith("/")) {
        downloadUrl = `https://shadowx-downloader.vercel.app${downloadUrl}`;
      }
      
      if (!downloadUrl) {
        await api.unsendMessage(waitMsg.messageID);
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
      await api.unsendMessage(waitMsg.messageID);

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
      
      try {
        if (waitMsg) await api.unsendMessage(waitMsg.messageID);
      } catch(e) {}
      
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

// Extract URLs with comprehensive patterns
function extractUrls(text) {
  if (!text) return [];
  
  // Comprehensive URL patterns for all platforms
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
    /(?:https?:\/\/)?(?:www\.)?reddit\.com\/r\/\w+\/comments\/\w+\/[^\/]+\/?(?:\?utm_source=[^&]+&utm_medium=[^&]+&utm_campaign=[^&]+)?/gi,
    /(?:https?:\/\/)?redd\.it\/[a-zA-Z0-9]+/gi,
    
    // Vimeo
    /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/\d+/gi,
    /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/\d+\/[a-zA-Z0-9_\-]+/gi,
    
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
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/feed\/update\/[a-zA-Z0-9_-]+/gi,
    
    // Snapchat
    /(?:https?:\/\/)?(?:www\.)?snapchat\.com\/add\/[a-zA-Z0-9]+/gi,
    /(?:https?:\/\/)?(?:www\.)?snapchat\.com\/discover\/[a-zA-Z0-9_-]+/gi,
    
    // Likee
    /(?:https?:\/\/)?(?:www\.)?likee\.video\/[a-zA-Z0-9_-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?likee\.com\/[a-zA-Z0-9_-]+/gi,
    
    // ShareChat
    /(?:https?:\/\/)?(?:www\.)?sharechat\.com\/[a-zA-Z0-9_-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?sharechat\.com\/posts\/[a-zA-Z0-9_-]+/gi,
    
    // Telegram
    /(?:https?:\/\/)?t\.me\/[a-zA-Z0-9_]+\/\d+/gi,
    /(?:https?:\/\/)?telegram\.org\/[a-zA-Z0-9_-]+/gi,
    
    // Discord
    /(?:https?:\/\/)?(?:www\.)?discord\.com\/channels\/\d+\/\d+\/\d+/gi,
    /(?:https?:\/\/)?(?:www\.)?discord\.gg\/[a-zA-Z0-9_-]+/gi,
    
    // Rumble
    /(?:https?:\/\/)?(?:www\.)?rumble\.com\/v\/[a-zA-Z0-9_-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?rumble\.com\/embed\/[a-zA-Z0-9_-]+/gi,
    
    // BitChute
    /(?:https?:\/\/)?(?:www\.)?bitchute\.com\/video\/[a-zA-Z0-9_-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?bitchute\.com\/embed\/[a-zA-Z0-9_-]+/gi,
    
    // Odysee
    /(?:https?:\/\/)?(?:www\.)?odysee\.com\/@[a-zA-Z0-9_.]+\/[a-zA-Z0-9_-]+/gi,
    /(?:https?:\/\/)?(?:odysee\.com|odysee\.tv)\/[a-zA-Z0-9_-]+/gi,
    
    // LBRY
    /(?:https?:\/\/)?(?:www\.)?lbry\.tv\/@[a-zA-Z0-9_.]+\/[a-zA-Z0-9_-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?lbry\.tv\/[a-zA-Z0-9_-]+/gi,
    
    // Kick
    /(?:https?:\/\/)?(?:www\.)?kick\.com\/[a-zA-Z0-9]+\/videos\/[a-zA-Z0-9_-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?kick\.com\/videos\/[a-zA-Z0-9_-]+/gi,
    
    // Trovo
    /(?:https?:\/\/)?(?:www\.)?trovo\.live\/[a-zA-Z0-9_]+\/[a-zA-Z0-9_-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?trovo\.live\/video\/[a-zA-Z0-9_-]+/gi,
    
    // General URL (fallback)
    /(?:https?:\/\/)[^\s]+/gi
  ];
  
  const allMatches = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Clean up the URL (remove trailing punctuation)
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
    { name: "YouTube", patterns: ["youtube.com", "youtu.be", "youtube"] },
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
