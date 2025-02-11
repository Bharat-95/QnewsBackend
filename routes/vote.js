import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "your-region" });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "Voted"; // Your DynamoDB table name

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { name, phone, vote } = req.body;

  if (!name || !phone || !vote) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Check for duplicate phone number
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
}
