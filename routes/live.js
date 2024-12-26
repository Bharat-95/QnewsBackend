const express = require("express");
const axios = require("axios");
const xml2js = require("xml2js");

const router = express.Router();

// YouTube Channel ID for specific channel
const CHANNEL_ID = "UCztpsdYM52VdE3zXOuGGi0g";

// Function to fetch live videos from a YouTube channel RSS feed
const fetchLiveVideosFromChannel = async () => {
  try {
    console.log(`Fetching live videos from channel ID: ${CHANNEL_ID}`);
    const response = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`);
    const parser = new xml2js.Parser();
    const xmlData = response.data;

    return new Promise((resolve, reject) => {
      parser.parseString(xmlData, (err, result) => {
        if (err) {
          console.error("Error parsing XML:", err);
          reject('Error parsing XML');
        } else {
          const entries = result.feed.entry || [];
          
          // Filter out live videos based on the title or other metadata indicating live stream
          const liveVideos = entries
            .map(entry => {
              const title = entry.title ? entry.title[0] : null;
              const videoId = entry['yt:videoId'] ? entry['yt:videoId'][0] : null;
              const thumbnail = entry['media:thumbnail'] ? entry['media:thumbnail'][0].$.url : null;
              const liveBroadcastContent = entry['yt:liveBroadcastContent'] ? entry['yt:liveBroadcastContent'][0] : null;

              console.log("live:", liveBroadcastContent)
              
              // Check if it's a live video based on the title or liveBroadcastContent field
              if (videoId && (title && (title.includes("Live") || liveBroadcastContent === "live"))) {
                return {
                  videoId: videoId,
                  title: title,
                  published: entry.published ? entry.published[0] : null,
                  link: entry.link ? entry.link[0].$.href : null,
                  thumbnail: thumbnail,
                };
              }
              return null; // Return null if it's not a live video
            })
            .filter(video => video !== null); // Remove null entries (non-live videos)

          resolve(liveVideos);
        }
      });
    });
  } catch (error) {
    console.error(`Error fetching live videos for channel ${CHANNEL_ID}:`, error);
    throw new Error('Failed to fetch live videos');
  }
};

// New route to fetch live videos
router.get("/", async (req, res) => {
  try {
    console.log("Fetching live videos...");
    const liveVideos = await fetchLiveVideosFromChannel();
    res.status(200).json({
      success: true,
      message: "Live videos fetched successfully",
      data: liveVideos,
    });
  } catch (error) {
    console.error("Error fetching live videos:", error);
    res.status(500).json({ message: "Error fetching live videos", error: error.message });
  }
});

module.exports = router;
