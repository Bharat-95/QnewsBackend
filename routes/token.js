const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();

// Initialize DynamoDB document client
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Route to save user token
router.post('/register-token', async (req, res) => {
  const { pushToken, subscriptionId } = req.body; // Extract token and subscription ID from request body
  console.log(pushToken, subscriptionId);

  if (!pushToken || !subscriptionId) {
    return res.status(400).json({ message: 'pushToken and subscriptionId are required.' });
  }

  const params = {
    TableName: 'UserTokens', // Your DynamoDB table name
    Item: {
      Key: 'Qnews', // Fixed partition key
      subscriptionId, // Unique identifier for the subscription
      pushToken, // The device token (OneSignal ID)
      createdAt: new Date().toISOString(), // Timestamp
    },
    ConditionExpression: 'attribute_not_exists(subscriptionId)', // Prevent duplicate tokens
  };

  try {
    // Store the token in DynamoDB
    await dynamoDB.put(params).promise();
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

// Route to fetch all tokens (for sending notifications)
router.get('/get-tokens', async (req, res) => {
  const params = {
    TableName: 'UserTokens', // Your DynamoDB table name
    KeyConditionExpression: 'partitionKey = :partitionKey', // Query by partition key
    ExpressionAttributeValues: {
      ':partitionKey': 'Qnews', // Fixed partition key
    },
  };

  try {
    const result = await dynamoDB.query(params).promise();
    const tokens = result.Items.map((item) => item.pushToken); // Extract only the tokens
    res.status(200).json({ tokens });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({ message: 'Error fetching tokens.', error });
  }
});

module.exports = router;
