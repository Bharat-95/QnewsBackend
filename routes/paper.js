const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const table = "E-paper";  
const upload = multer();

router.post("/", upload.fields([{ name: "file" }, { name: "thumbnail" }]), async (req, res) => {
  try {
    const { date, month, year } = req.body;
    const files = req.files;

    // Validate inputs
    if (!files || !files.file || !files.thumbnail) {
      return res.status(400).json({ message: "Both file and thumbnail are required" });
    }

    if (!date || !month || !year) {
      return res.status(400).json({ message: "Date, Month, and Year are required" });
    }

    const paperFile = files.file[0]; // Paper file
    const thumbnailFile = files.thumbnail[0]; // Thumbnail file

    // Upload paper to S3
    const paperUploadResult = await s3
      .upload({
        Bucket: "qnewsimages", // Your S3 bucket name
        Key: `papers/${uuidv4()}.pdf`, // Unique key for the paper file
        Body: paperFile.buffer,
        ContentType: paperFile.mimetype, // Ensure correct MIME type
      })
      .promise();

    // Upload thumbnail to S3
    const thumbnailUploadResult = await s3
      .upload({
        Bucket: "qnewsimages", // Your S3 bucket name
        Key: `thumbnails/${uuidv4()}.jpg`, // Unique key for the thumbnail
        Body: thumbnailFile.buffer,
        ContentType: thumbnailFile.mimetype, // Ensure correct MIME type
      })
      .promise();

    // Create a unique ID for the paper
    const paperId = uuidv4();

    // Metadata to store in DynamoDB
    const item = {
      paperId,
      fileUrl: paperUploadResult.Location, // S3 URL of the paper
      thumbnailUrl: thumbnailUploadResult.Location, // S3 URL of the thumbnail
      date,
      month,
      year,
      status: "Pending", // Default status
      createdAt: new Date().toISOString(), // Timestamp of creation
    };

    // Store metadata in DynamoDB
    await dynamoDB.put({ TableName: table, Item: item }).promise();

    res.status(200).json({ success: true, message: "Paper and thumbnail added successfully", paperId });
  } catch (error) {
    console.error("Error uploading paper and thumbnail:", error);
    res.status(500).json({ message: "Error adding paper and thumbnail", error });
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
