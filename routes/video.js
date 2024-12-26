const express = require("express");
const axios = require("axios");
const xml2js = require("xml2js");

const router = express.Router();

// YouTube Channel IDs
const CHANNEL_IDS = [
  "UCI-7hequY2IuQjpuj6g9BlA", // Channel 1
  "UCbivggwUD5UjHhYmkha8DdQ", // Channel 2
  "UCUVJf9GvRRxUDauQi-qCcfQ", // Channel 3
  "UCvOTCRd0GKMSGeKww86Qw5Q", // Channel 4
];

// Function to fetch videos from a YouTube channel RSS feed
const fetchVideosFromChannel = async (channelId) => {
  try {
    const response = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    const parser = new xml2js.Parser();
    const xmlData = response.data;

    return new Promise((resolve, reject) => {
      parser.parseString(xmlData, (err, result) => {
        if (err) {
          reject('Error parsing XML');
        } else {
          const entries = result.feed.entry || [];
          const videos = entries.map(entry => {
            return {
              videoId: entry['yt:videoId'][0],
              title: entry.title[0],
              published: entry.published[0],
              link: entry.link[0].$.href,
            };
          });
          resolve(videos);
        }
      });
    });
  } catch (error) {
    console.error(`Error fetching videos for channel ${channelId}:`, error);
    throw new Error('Failed to fetch videos');
  }
};

// Fetch videos from all channels and return them in a response
router.get("/", async (req, res) => {
  try {
    const allVideos = [];

    // Fetch videos from each channel
    for (const channelId of CHANNEL_IDS) {
      const videosFromChannel = await fetchVideosFromChannel(channelId);
      allVideos.push(...videosFromChannel);
    }

    // Sort videos by publish date (descending order)
    const sortedVideos = allVideos.sort((a, b) => new Date(b.published) - new Date(a.published));

    console.log(sortedVideos);

    // Return the top 20 most recent videos
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
