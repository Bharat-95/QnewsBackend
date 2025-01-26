const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();
const axios = require('axios'); 

// Initialize DynamoDB document client
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const table = "UserTokens";
// Route to save user token
router.post('/register-token', async (req, res) => {
  const { pushToken, subscriptionId } = req.body; // Extract token and subscription ID from request body
  console.log(pushToken, subscriptionId);

  if (!pushToken || !subscriptionId) {
    return res.status(400).json({ message: 'pushToken and subscriptionId are required.' });
  }

  const item = {
    Qnews: subscriptionId, 
    pushToken,
    createdAt: new Date().toISOString(),
  };
  
  try {
    // Store the token in DynamoDB
    await dynamoDB.put(
      {
        TableName: table,
        Item: item,
        ConditionExpression: 'attribute_not_exists(subscriptionId)', 
      }
    ).promise();
    res.status(200).json({ message: 'Token saved successfully.' });
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      res.status(409).json({ message: 'Token already exists.' });
    } else {
      console.error('Error saving token:', error);
      res.status(500).json({ message: 'Error saving token.', error });
    }
  }
});

router.get('/get-tokens', async (req, res) => {
  try {
    const params = {
      TableName: table,
    };

    const result = await dynamoDB.scan(params).promise(); // Scan to fetch all items
    const tokens = result.Items.map((item) => item.pushToken); // Extract push tokens

    res.status(200).json({ tokens });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({ message: 'Error fetching tokens.', error });
  }
});

router.post('/send-notification', async (req, res) => {
  const { title, link } = req.body;

  if (!title || !link) {
    return res.status(400).json({ message: "Title and link are required." });
  }

  try {
    // Fetch tokens from DynamoDB
    const params = { TableName: table };
    const result = await dynamoDB.scan(params).promise();
    const tokens = result.Items.map((item) => item.pushToken);

    if (!tokens || tokens.length === 0) {
      return res.status(400).json({ message: "No valid player IDs found." });
    }

    // OneSignal payload
    const payload = {
      app_id: "dc0dc5b0-259d-4e15-a368-cabe512df1b8", // Replace with your OneSignal App ID
      include_player_ids: tokens,
      headings: { en: "New Video Alert!" },
      contents: { en: `Watch now: ${link}` },
    };

    // Send notification
    const response = await axios.post("https://onesignal.com/api/v1/notifications", payload, {
      headers: {
        Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`, // Correct format
        "Content-Type": "application/json",
      },
    });

    console.log("Notification sent successfully:", response.data);
    res.status(200).json({ message: "Notification sent successfully." });
  } catch (error) {
    console.error("OneSignal error:", error.response?.data || error.message);
    res.status(500).json({ message: "Error sending notification.", error: error.response?.data || error.message });
  }
});





module.exports = router;
