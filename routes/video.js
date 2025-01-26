const express = require("express");
const axios = require("axios");
const xml2js = require("xml2js");
const { Expo } = require('expo-server-sdk');
const AWS = require('aws-sdk');

const router = express.Router();

// YouTube Channel IDs
const CHANNEL_IDS = [
  "UCI-7hequY2IuQjpuj6g9BlA", // Channel 1
  "UCbivggwUD5UjHhYmkha8DdQ", // Channel 2
  "UCUVJf9GvRRxUDauQi-qCcfQ", // Channel 3
  "UCvOTCRd0GKMSGeKww86Qw5Q", // Channel 4
];

const expo = new Expo();

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
          
          // Filter out videos with "Shorts" or "#" in the title
          const filteredVideos = entries
            .map(entry => {
              const title = entry.title[0];
              // Exclude videos with "Shorts" or "#" in the title
              if (title.includes("Shorts") || title.includes("#")) {
                return null; // Return null for these videos, which will be filtered out later
              }
              return {
                videoId: entry['yt:videoId'][0],
                title: title,
                published: entry.published[0],
                link: entry.link[0].$.href,
              };
            })
            .filter(video => video !== null); // Remove the null entries (videos that were excluded)

          resolve(filteredVideos);
        }
      });
    });
  } catch (error) {
    console.error(`Error fetching videos for channel ${channelId}:`, error);
    throw new Error('Failed to fetch videos');
  }
};

// Function to send push notifications using Expo
const sendPushNotification = async (pushTokens, title, body) => {
  const messages = pushTokens.map(token => ({
    to: token,
    sound: 'default',
    title: title,
    body: body,
    data: { withSome: 'data' },
  }));

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (let chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    console.log('Push notifications sent:', tickets);
    return tickets;
  } catch (error) {
    console.error('Error sending push notifications:', error);
    throw new Error('Error sending push notifications');
  }
};

// Function to fetch all user tokens from DynamoDB
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const getAllUserTokens = async () => {
  const params = {
    TableName: 'UserTokens', // Replace with your table name
  };

  try {
    const result = await dynamoDB.scan(params).promise();
    return result.Items.map(item => item.token); // Return array of push tokens
  } catch (error) {
    console.error('Error fetching user tokens:', error);
    return [];
  }
};

// Fetch videos from all channels and send push notifications
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

    // Limit to top 20 most recent videos
    const recentVideos = sortedVideos.slice(0, 20);

    // Assuming you have a way to store and retrieve user tokens from DynamoDB
    const usersTokens = await getAllUserTokens(); // This should fetch all registered user push tokens

    // Send push notifications for new videos
    for (const video of recentVideos) {
      const title = `New YouTube Video: ${video.title}`;
      const body = `Check out the latest video: ${video.link}`;
      await sendPushNotification(usersTokens, title, body);
    }

    res.status(200).json({
      success: true,
      message: "Videos fetched successfully and notifications sent.",
      data: recentVideos,
    });
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({ message: "Error fetching videos", error });
  }
});

module.exports = router;
