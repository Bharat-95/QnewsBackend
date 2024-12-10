const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const table = "E-paper";  
const upload = multer();

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const {
      date,
      month,
      year,
    } = req.body;

    const file = req.file; 

    if (!file) return res.status(400).json({ message: "File is required" });
    if (!date || !month || !year) {
      return res.status(400).json({ message: "Date, Month, and Year are required" });
    }

    // Upload the paper file (PDF, DOCX, etc.) to the S3 bucket
    const fileUploadResult = await s3
      .upload({
        Bucket: "qnewsimages", // Your new S3 bucket name
        Key: `papers/${uuidv4()}.pdf`, // Store the paper in the papers directory with a unique key
        Body: file.buffer,
        ContentType: file.mimetype,  // Ensure correct MIME type
      })
      .promise();

    const paperId = uuidv4();  // Unique identifier for the paper
    const item = {
      paperId,
      fileUrl: fileUploadResult.Location,  // Store the file URL from S3
      date,
      month,
      year,
      status: "Pending", // Default status
      createdAt: new Date().toISOString(),  // Store creation timestamp
    };

    // Store metadata in the DynamoDB E-paper table
    await dynamoDB.put({ TableName: table, Item: item }).promise();

    res.status(200).json({ success: true, message: "Paper added successfully", paperId });
  } catch (error) {
    console.error("Error uploading paper:", error);
    res.status(500).json({ message: "Error adding paper", error });
  }
});


router.get("/", async (req, res) => {
    try {
      const params = { TableName: table };
      const data = await dynamoDB.scan(params).promise();
  
      res.status(200).json({
        success: true,
        message: "Fetched news successfully",
        data: data.Items,
      });
    } catch (error) {
      errorResponse(res, "Error fetching news", error);
    }
  });

  

module.exports = router;
