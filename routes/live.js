const express = require("express");
const axios = require("axios");
const xml2js = require("xml2js");

const router = express.Router();

// YouTube Channel ID for specific channel
const CHANNEL_ID = "UCUVJf9GvRRxUDauQi-qCcfQ";

// Function to fetch videos from a YouTube channel RSS feed
const fetchLiveVideosFromChannel = async () => {
  try {
    const response = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`);
    const parser = new xml2js.Parser();
    const xmlData = response.data;

    return new Promise((resolve, reject) => {
      parser.parseString(xmlData, (err, result) => {
        if (err) {
          reject('Error parsing XML');
        } else {
          const entries = result.feed.entry || [];
          
          const liveVideos = entries
            .map(entry => {
              const title = entry.title[0];
              const videoId = entry['yt:videoId'][0];
              if (title.includes("Live") || entry['yt:liveBroadcastContent'][0] === "live") {
                return {
                  videoId: videoId,
                  title: title,
                  published: entry.published[0],
                  link: entry.link[0].$.href,
                  thumbnail: entry['media:thumbnail'][0].$.url,
                };
              }
              return null;
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
    const liveVideos = await fetchLiveVideosFromChannel();
    res.status(200).json({
      success: true,
      message: "Live videos fetched successfully",
      data: liveVideos,
    });
  } catch (error) {
    console.error("Error fetching live videos:", error);
    res.status(500).json({ message: "Error fetching live videos", error });
  }
});

module.exports = router;
