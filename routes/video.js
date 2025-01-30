const express = require("express");
const axios = require("axios");
const xml2js = require("xml2js");
const cron = require("node-cron");

const router = express.Router();

// OneSignal API Key & App ID
const ONESIGNAL_APP_ID = "dc0dc5b0-259d-4e15-a368-cabe512df1b8";
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

// YouTube Channel IDs
const CHANNEL_IDS = [
  "UCI-7hequY2IuQjpuj6g9BlA",
  "UCbivggwUD5UjHhYmkha8DdQ",
  "UCUVJf9GvRRxUDauQi-qCcfQ",
  "UCvOTCRd0GKMSGeKww86Qw5Q",
];

// Store last video ID for each channel
let lastVideoIds = {};

// Fetch latest videos from a YouTube channel
const fetchVideosFromChannel = async (channelId) => {
  try {
    const response = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    const parser = new xml2js.Parser();
    const xmlData = response.data;

    return new Promise((resolve, reject) => {
      parser.parseString(xmlData, (err, result) => {
        if (err) {
          reject("Error parsing XML");
        } else {
          const entries = result.feed.entry || [];

          const filteredVideos = entries
            .map((entry) => {
              const title = entry.title[0];
              if (title.includes("Shorts") || title.includes("#")) return null; // Exclude Shorts and Hashtags
              
              return {
                videoId: entry["yt:videoId"][0],
                title,
                published: entry.published[0],
                link: entry.link[0].$.href,
                thumbnail: entry["media:group"][0]["media:thumbnail"][0].$.url, // Fetch thumbnail
              };
            })
            .filter((video) => video !== null);

          resolve(filteredVideos);
        }
      });
    });
  } catch (error) {
    console.error(`Error fetching videos for channel ${channelId}:`, error);
    return [];
  }
};

// Send OneSignal Notification
const sendNotification = async (video) => {
  try {
    const payload = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: "New Video Alert!" },
      contents: { en: video.title },
      included_segments: ["All"],
      url: video.link, // Clicking notification redirects to video
      big_picture: video.thumbnail, // Large notification image
      android_channel_id: "1b44f8cc-89b4-4006-bc9b-56d12ef6dd5e", // Android channel
    };

    const response = await axios.post("https://onesignal.com/api/v1/notifications", payload, {
      headers: {
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Notification Sent:", response.data);
  } catch (error) {
    console.error("❌ Error sending notification:", error.response?.data || error.message);
  }
};

// Check for new videos every 10 minutes
cron.schedule("*/10 * * * *", async () => {
  console.log("🔍 Checking for new YouTube videos...");
  for (const channelId of CHANNEL_IDS) {
    const videos = await fetchVideosFromChannel(channelId);
    if (videos.length === 0) continue;

    const latestVideo = videos[0]; // Newest video

    if (lastVideoIds[channelId] !== latestVideo.videoId) {
      console.log(`🚀 New video detected: ${latestVideo.title}`);
      lastVideoIds[channelId] = latestVideo.videoId; // Update latest video
      await sendNotification(latestVideo); // Send notification
    }
  }
});

router.get("/", async (req, res) => {
  try {
    let allVideos = [];
    for (const channelId of CHANNEL_IDS) {
      const videosFromChannel = await fetchVideosFromChannel(channelId);
      allVideos.push(...videosFromChannel);
    }

    // Sort videos by publish date (descending order)
    const sortedVideos = allVideos.sort((a, b) => new Date(b.published) - new Date(a.published));

    res.status(200).json({
      success: true,
      message: "Videos fetched successfully",
      data: sortedVideos.slice(0, 20),
    });
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({ message: "Error fetching videos", error });
  }
});

module.exports = router;
