const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const schedule = require("node-schedule"); // For scheduling notifications

const router = express.Router();
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const table = "NewsEn";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const errorResponse = (res, message, error) => {
  console.error(message, error);
  return res.status(500).json({
    success: false,
    message,
    error: error?.message || "Internal server error",
  });
};

// ✅ Fetch all news
router.get("/", async (req, res) => {
  try {
    let allItems = [];
    let lastEvaluatedKey = null;

    do {
      const params = {
        TableName: table,
        ExclusiveStartKey: lastEvaluatedKey,
        ConsistentRead: true,
      };

      const data = await dynamoDB.scan(params).promise();
      allItems = allItems.concat(data.Items);
      lastEvaluatedKey = data.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    res.status(200).json({
      success: true,
      message: "Fetched news successfully",
      data: allItems,
    });
  } catch (error) {
    errorResponse(res, "Error fetching news", error);
  }
});

// ✅ Function to send notifications for approved news
const sendNewsNotifications = async () => {
  try {
    const params = {
      TableName: table,
      FilterExpression: "#status = :approved",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":approved": "Approved",
      },
    };

    const data = await dynamoDB.scan(params).promise();

    if (!data.Items || data.Items.length === 0) {
      console.log("No approved news available for notification.");
      return;
    }

    // Get the latest approved news (most recent)
    const latestNews = data.Items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    const notificationPayload = {
      app_id: "dc0dc5b0-259d-4e15-a368-cabe512df1b8",
      headings: { en: "Latest News", te: latestNews.headlineTe },
      contents: { en: latestNews.headlineEn, te: latestNews.headlineTe },
      included_segments: ["All"],
      data: {
        newsId: latestNews.newsId,
        headlineEn: latestNews.headlineEn,
        headlineTe: latestNews.headlineTe,
        image: latestNews.image,
      },
      small_icon: latestNews.image,
      big_picture: latestNews.image,
      ios_attachments: { id1: latestNews.image },
      android_channel_id: "1b44f8cc-89b4-4006-bc9b-56d12ef6dd5e",
      buttons: [{ id: "view", text: "Read More", icon: "ic_menu_view" }],
    };

    console.log("Sending notification:", notificationPayload);

    const response = await axios.post(
      "https://onesignal.com/api/v1/notifications",
      notificationPayload,
      {
        headers: {
          Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Notification Sent Successfully:", response.data);
  } catch (error) {
    console.error("Error sending notifications:", error.message);
  }
};

// ✅ Schedule notifications every 30 minutes
schedule.scheduleJob("*/30 * * * *", sendNewsNotifications);

// ✅ Manual route to trigger notifications
router.get("/send-notifications", async (req, res) => {
  try {
    await sendNewsNotifications();
    res.status(200).json({ success: true, message: "Notifications sent successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error sending notifications", error });
  }
});

// ✅ Fetch a single news item by ID
router.get("/:newsId", async (req, res) => {
  const { newsId } = req.params;

  try {
    const params = { TableName: table, Key: { newsId } };
    const data = await dynamoDB.get(params).promise();

    if (!data.Item) {
      return res.status(404).json({ success: false, message: "News not found" });
    }

    res.status(200).json({
      success: true,
      message: "News fetched successfully",
      data: data.Item,
    });
  } catch (error) {
    errorResponse(res, "Error fetching news by ID", error);
  }
});

// ✅ Add new news (POST)
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { headlineEn, headlineTe, newsEn, newsTe, category, employeeId } = req.body;
    const image = req.file;

    if (!image || !headlineEn || !headlineTe || !newsEn || !newsTe || !category || !employeeId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const imageUploadResult = await s3.upload({
      Bucket: "qnewsimages",
      Key: `news-images/${uuidv4()}.jpg`,
      Body: image.buffer,
      ContentType: image.mimetype,
    }).promise();

    if (!imageUploadResult) return;

    const newsId = uuidv4();
    const item = {
      newsId,
      headlineEn,
      headlineTe,
      newsEn,
      newsTe,
      category,
      employeeId,
      image: imageUploadResult.Location,
      status: "Pending",
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: [],
      ratings: { total: 0, count: 0 },
    };

    await dynamoDB.put({ TableName: table, Item: item }).promise();

    res.status(200).json({
      success: true,
      message: "News added successfully",
      newsId,
    });
  } catch (error) {
    errorResponse(res, "Error adding news", error);
  }
});

// ✅ Update news (PUT)
router.put("/:newsId", async (req, res) => {
  const { newsId } = req.params;
  const fieldsToUpdate = req.body;

  try {
    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({ message: "No fields provided for update" });
    }

    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.entries(fieldsToUpdate).forEach(([key, value]) => {
      if (key === "newsId") return;
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    });

    const params = {
      TableName: table,
      Key: { newsId },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDB.update(params).promise();

    res.status(200).json({
      success: true,
      message: "News updated successfully",
      updatedItem: result.Attributes,
    });
  } catch (error) {
    errorResponse(res, "Error updating news", error);
  }
});

module.exports = router;
