const express = require("express");
const axios = require("axios");
const xml2js = require("xml2js");
const AWS = require("aws-sdk");
const router = express.Router();

// YouTube Channel IDs
const CHANNEL_IDS = [
  "UCI-7hequY2IuQjpuj6g9BlA", // Channel 1
  "UCbivggwUD5UjHhYmkha8DdQ", // Channel 2
  "UCUVJf9GvRRxUDauQi-qCcfQ", // Channel 3
  "UCvOTCRd0GKMSGeKww86Qw5Q", // Channel 4
];

// Initialize DynamoDB document client
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const tableName = "SentVideos"; // Table to track sent video notifications

// Function to fetch videos from a YouTube channel RSS feed
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
              if (title.includes("Shorts") || title.includes("#")) return null;
              return {
                videoId: entry["yt:videoId"][0],
                title: title,
                published: entry.published[0],
                link: entry.link[0].$.href,
              };
            })
            .filter((video) => video !== null); // Remove null entries
          resolve(filteredVideos);
        }
      });
    });
  } catch (error) {
    console.error(`Error fetching videos for channel ${channelId}:`, error);
    throw new Error("Failed to fetch videos");
  }
};

// Check if a video is already sent
const isVideoSent = async (videoId) => {
  const params = {
    TableName: tableName,
    Key: { videoId },
  };

  try {
    const result = await dynamoDB.get(params).promise();
    return !!result.Item; // Return true if video exists
  } catch (error) {
    console.error("Error checking video ID:", error);
    return false;
  }
};

// Save video to SentVideos table
const saveVideoToSentVideos = async (videoId) => {
  const params = {
    TableName: tableName,
    Item: {
      videoId,
      sentAt: new Date().toISOString(),
    },
  };

  try {
    await dynamoDB.put(params).promise();
  } catch (error) {
    console.error("Error saving video ID:", error);
  }
};

// Send OneSignal Notification
const sendOneSignalNotification = async (title, link) => {
  const payload = {
    app_id: "dc0dc5b0-259d-4e15-a368-cabe512df1b8", // Replace with your OneSignal App ID
    headings: { en: "New Video Alert!" },
    contents: { en: `${title}: ${link}` },
    included_segments: ["Subscribed Users"], // Adjust to target specific users
  };

  try {
    await axios.post("https://onesignal.com/api/v1/notifications", payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "os_v2_app_3qg4lmbftvhbli3izk7fclprxb2lpcvyaunuprub6syjnkidcwnsyvcg5bp2tt6j6edu7h73wxbun5xifjw5w3zpftkzcq7ydceagyq", // Replace with your OneSignal API Key
      },
    });
    console.log(`Notification sent for video: ${title}`);
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};

// Fetch videos from all channels and send notifications for new videos
router.get("/", async (req, res) => {
  try {
    const allVideos = [];

    for (const channelId of CHANNEL_IDS) {
      const videosFromChannel = await fetchVideosFromChannel(channelId);
      allVideos.push(...videosFromChannel);
    }

    const sortedVideos = allVideos.sort((a, b) => new Date(b.published) - new Date(a.published));
    const latestVideos = sortedVideos.slice(0, 20);

    for (const video of latestVideos) {
      const alreadySent = await isVideoSent(video.videoId);
      if (!alreadySent) {
        await sendOneSignalNotification(video.title, video.link); // Send notification
        await saveVideoToSentVideos(video.videoId); // Save to SentVideos
      }
    }

    res.status(200).json({
      success: true,
      message: "Videos fetched and notifications sent successfully",
      data: latestVideos,
    });
  } catch (error) {
    console.error("Error processing videos:", error);
    res.status(500).json({ message: "Error processing videos", error });
  }
});

module.exports = router;
