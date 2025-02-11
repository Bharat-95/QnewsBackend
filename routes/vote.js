require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

const app = express();
const PORT = process.env.PORT || 5000;
const router = express.Router();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// AWS DynamoDB Configuration
const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "Voted"; // Your DynamoDB table name

// POST API to Submit Vote
router.post("/", async (req, res) => {
  const { name, phone, vote } = req.body;

  if (!name || !phone || !vote) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Check if the phone number already exists
    const existingVote = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { phone },
      })
    );

    if (existingVote.Item) {
      return res.status(400).json({ message: "ఫోన్ నెంబర్ ఇప్పటికే వాడబడింది!" });
    }

    // Save vote in DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { phone, name, vote },
      })
    );

    return res.status(200).json({ message: "Vote submitted successfully!" });
  } catch (error) {
    console.error("DynamoDB error:", error);
    return res.status(500).json({ message: "Server error, please try again" });
  }
});


module.exports = router;