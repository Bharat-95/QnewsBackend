const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const axios = require('axios');
const schedule = require("node-schedule");
const cron = require("node-cron");

const router = express.Router();
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const table = "Voted";

// AWS DynamoDB Configuration


router.post("/", async (req, res) => {
    const { name, phone, vote } = req.body;
    console.log("Received Vote:", req.body);
  
    // ✅ Validate Input
    if (!name || !phone || !vote) {
      return res.status(400).json({ message: "❌ అన్ని వివరాలను నమోదు చేయండి." });
    }
  
    try {
      // ✅ Check if Phone Number Already Voted
      const existingVote = await dynamoDB
        .get({
          TableName: table,
          Key: { phone },
        })
        .promise();
  
      if (existingVote.Item) {
        return res.status(400).json({ message: "📌 ఫోన్ నంబర్ నుండి ఇప్పటికే ఓటు వేశారు!" });
      }
  
      // ✅ Prepare Vote Data for Insertion
      const voteId = uuidv4(); // Generate a Unique ID
      const item = {
        voteId,
        name,
        phone,
        vote,
        timestamp: new Date().toISOString(), // Store Submission Time
      };
  
      // ✅ Save Vote to DynamoDB
      await dynamoDB
        .put({
          TableName: table,
          Item: item,
        })
        .promise();
  
      return res.status(200).json({ message: "✅ ధన్యవాదాలు! మీ ఓటు నమోదైంది." });
    } catch (error) {
      console.error("DynamoDB error:", error);
      return res.status(500).json({ message: "❌ సర్వర్ సమస్య, దయచేసి మళ్లీ ప్రయత్నించండి." });
    }
  });

module.exports = router;