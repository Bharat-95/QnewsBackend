const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();

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
    pushToken,
    subscriptionId,
    createdAt: new Date().toISOString(),
  }
  
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


module.exports = router;
