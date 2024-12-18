const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const table = "Youtube";
const upload = multer();

router.post("/", upload.single("thumbnail"), async (req, res) => {
    try {
      const { URL, titleEn, titleTe, category } = req.body;
      const thumbnail = req.file; // Get the uploaded file

      console.log(req.body)
    
      if (!URL || !titleEn || !titleTe || !thumbnail || !category) {
        return res.status(400).json({ message: "All fields are required" });
      }
  
      // Upload the thumbnail to S3
      const s3Params = await s3.upload({
        Bucket: "qnewsimages",
        Key: `video-images/${uuidv4()}.jpg`,
        Body: thumbnail.buffer,  // Use thumbnail.buffer
        ContentType: thumbnail.mimetype,  // Use thumbnail.mimetype
      }).promise();
  
      // Prepare data for DynamoDB
      const videoId = uuidv4();
      const item = {
        videoId,
        URL,
        titleEn,
        titleTe,
        category,
        thumbnail: s3Params.Location, // Save the thumbnail URL
        status: "Pending",
        createdAt: new Date().toISOString(),
      };
  
      await dynamoDB.put({ TableName: table, Item: item }).promise();
    
      // Send response
      res.status(200).json({
        success: true,
        message: "Video added successfully",
        videoId,  // Return the videoId in the response
      });
    } catch (error) {
      console.error("Error uploading video:", error);
      res.status(500).json({ message: "Error uploading video", error });
    }
  });
  


  router.put('/:videoId', async (req, res) => {
    const { videoId } = req.params;
    const fieldsToUpdate = req.body;
  
    try {
      if (Object.keys(fieldsToUpdate).length === 0) {
        return res.status(400).json({ message: "No fields provided for update" });
      }
  
      // Remove videoId from the fieldsToUpdate object (since it cannot be updated)
      delete fieldsToUpdate.videoId;
  
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};
  
      // Prepare the update expression only for non-key attributes
      Object.entries(fieldsToUpdate).forEach(([key, value]) => {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      });
  
      const params = {
        TableName: table,
        Key: { videoId }, // videoId is used as the partition key
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
      console.error("Error updating news", error);
      res.status(500).json({
        success: false,
        message: "Error updating news",
        error: error.message || "Internal Server Error",
      });
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
