const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const table = "NewsEn";
const upload = multer();

const errorResponse = (res, message, error) => {
  console.error(message, error);
  return res.status(500).json({
    success: false,
    message,
    error: error?.message || "Internal server error",
  });
};


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


router.post("/", upload.single("image"), async (req, res) => {
  try {
    const {
      headlineEn,
      headlineTe,
      newsEn,
      newsTe,
      category,
      isMain,
      isSub1,
      isSub2,
      employeeId,
      tag,
    } = req.body;

    console.log(req.body)

    const image = req.file;

    if (!image) return res.status(400).json({ message: "Image is required" });
    if (!headlineEn ||!headlineTe || !newsEn || !newsTe || !category || !isMain || !employeeId || !tag) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const imageUploadResult = await s3
      .upload({
        Bucket: "qnewsimages",
        Key: `news-images/${uuidv4()}.jpg`,
        Body: image.buffer,
        ContentType: image.mimetype,
      })
      .promise();

    const newsId = uuidv4();
    const item = {
      newsId,
      headlineEn,
      headlineTe,
      newsEn,
      newsTe,
      category,
      isMain,
      isSub1,
      isSub2,
      employeeId,
      tag,
      image: imageUploadResult.Location,
      status: "Pending",
      createdAt: new Date().toISOString(),
      likes: 0, 
      comments: [], 
      ratings: {
        total: 0,
        count: 0, 
      },
    };

    await dynamoDB.put({ TableName: table, Item: item }).promise();

    res.status(200).json({ success: true, message: "News added successfully", newsId });
  } catch (error) {
    errorResponse(res, "Error adding news", error);
  }
});


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
      // Exclude "newsId" from being updated
      if (key === "newsId") {
        return;
      }
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    });

    if (updateExpression.length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update" });
    }

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

router.put("/:newsId/like", async (req, res) => {
  const { newsId, userEmail } = req.body;

  try {
    const updateParams = {
      TableName: table,
      Key: { newsId },
      UpdateExpression:
        "SET #likes = if_not_exists(#likes, :start) + :inc, #likedBy = list_append(if_not_exists(#likedBy, :emptyList), :user)",
      ExpressionAttributeNames: {
        "#likes": "likes",
        "#likedBy": "likedBy",
      },
      ExpressionAttributeValues: {
        ":start": 0,
        ":inc": 1,
        ":emptyList": [],
        ":user": [userEmail],
      },
      ConditionExpression: "not contains(#likedBy, :user)", // Prevent duplicate likes
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDB.update(updateParams).promise();

    res.status(200).json({
      success: true,
      message: "Post liked successfully",
      updatedItem: result.Attributes,
    });
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({
      success: false,
      message: "Error liking post",
      error: error.message || error,
    });
  }
});


router.get("/:newsId", async (req, res) => {
  const { newsId } = req.params;
  const { userEmail } = req.query;

  try {
    const params = {
      TableName: table,
      Key: { newsId },
    };

    const result = await dynamoDB.get(params).promise();

    if (!result.Item) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const hasLiked = result.Item.likedBy?.includes(userEmail) || false;

    res.status(200).json({
      success: true,
      data: {
        ...result.Item,
        hasLiked,
      },
    });
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ success: false, message: "Error fetching post" });
  }
});




router.put("/:newsId/comment", async (req, res) => {
  const { userEmail, firstName, lastName, comment } = req.body;
  const { newsId } = req.params;

  if (!comment) {
    return res.status(400).json({ message: "UserId and comment are required" });
  }

  try {
    const commentObj = {
      commentId: uuidv4(),
      userEmail,
      firstName,
      lastName,
      comment,
      createdAt: new Date().toISOString(),
      likedBy: [], 
      likes: 0,
    };

    const params = {
      TableName: table,
      Key: { newsId },
      UpdateExpression: "SET #comments = list_append(if_not_exists(#comments, :empty), :newComment)",
      ExpressionAttributeNames: { "#comments": "comments" },
      ExpressionAttributeValues: { ":empty": [], ":newComment": [commentObj] },
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDB.update(params).promise();

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      updatedItem: result.Attributes,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error adding comment", error });
  }
});


router.put("/:newsId/comment/like", async (req, res) => {
  const { commentId, userEmail } = req.body;
  const { newsId } = req.params;

  if (!commentId || !userEmail) {
    return res.status(400).json({ message: "commentId and userEmail are required" });
  }

  try {
    const params = {
      TableName: table,
      Key: { newsId },
    };

    const result = await dynamoDB.get(params).promise();

    if (!result.Item || !result.Item.comments) {
      return res.status(404).json({ message: "Comments not found for this news article" });
    }

    const commentIndex = result.Item.comments.findIndex(c => c.commentId === commentId);

    if (commentIndex === -1) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const comment = result.Item.comments[commentIndex];

    if (comment.likedBy && comment.likedBy.includes(userEmail)) {
      return res.status(400).json({ message: "User has already liked this comment" });
    }

    const updatedLikes = (comment.likes || 0) + 1;
    const updatedLikedBy = comment.likedBy ? [...comment.likedBy, userEmail] : [userEmail];

    const updateParams = {
      TableName: table,
      Key: { newsId },
      UpdateExpression: "SET #comments[" + commentIndex + "].likes = :updatedLikes, #comments[" + commentIndex + "].likedBy = :updatedLikedBy",
      ExpressionAttributeNames: {
        "#comments": "comments",
      },
      ExpressionAttributeValues: {
        ":updatedLikes": updatedLikes,
        ":updatedLikedBy": updatedLikedBy,
      },
      ReturnValues: "ALL_NEW",
    };

    await dynamoDB.update(updateParams).promise();

    return res.status(200).json({ message: "Comment liked successfully" });
  } catch (error) {
    console.log("Error liking comment:", error);
    return res.status(500).json({ message: "Error liking comment", error });
  }
});


router.put("/:newsId/comment/unlike", async (req, res) => {
  const { commentId, userEmail } = req.body;
  const { newsId } = req.params;

  if (!commentId || !userEmail) {
    return res.status(400).json({ message: "commentId and userEmail are required" });
  }

  try {
    const params = {
      TableName: table,
      Key: { newsId },
    };

    const result = await dynamoDB.get(params).promise();

    if (!result.Item || !result.Item.comments) {
      return res.status(404).json({ message: "Comments not found for this news article" });
    }

    const commentIndex = result.Item.comments.findIndex(c => c.commentId === commentId);

    if (commentIndex === -1) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const comment = result.Item.comments[commentIndex];

    if (!comment.likedBy || !comment.likedBy.includes(userEmail)) {
      return res.status(400).json({ message: "User has not liked this comment yet" });
    }

    const updatedLikes = (comment.likes || 0) - 1;
    const updatedLikedBy = comment.likedBy.filter(email => email !== userEmail);

    const updateParams = {
      TableName: table,
      Key: { newsId },
      UpdateExpression: "SET #comments[" + commentIndex + "].likes = :updatedLikes, #comments[" + commentIndex + "].likedBy = :updatedLikedBy",
      ExpressionAttributeNames: {
        "#comments": "comments",
      },
      ExpressionAttributeValues: {
        ":updatedLikes": updatedLikes,
        ":updatedLikedBy": updatedLikedBy,
      },
      ReturnValues: "ALL_NEW",
    };

    await dynamoDB.update(updateParams).promise();

    return res.status(200).json({ message: "Comment unliked successfully" });
  } catch (error) {
    console.log("Error unliking comment:", error);
    return res.status(500).json({ message: "Error unliking comment", error });
  }
});




router.put("/:newsId/reply", async (req, res) => {
  const { userEmail, firstName, lastName, reply, commentId } = req.body;
  const { newsId } = req.params;

  try {

    const params = {
      TableName: "NewsEn", 
      Key: { newsId },
    };

    const result = await dynamoDB.get(params).promise();

    if (!result.Item) {
      return res.status(404).json({ message: "Post not found" });
    }

  
    const comment = result.Item.comments.find(c => c.commentId === commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (!comment.replies) {
      comment.replies = [];
    }

    const newReply = {
      userEmail,
      firstName,
      lastName,
      reply,
      createdAt: new Date().toISOString(),
    };

  
    comment.replies.push(newReply);


    const updateParams = {
      TableName: "NewsEn",
      Key: { newsId },
      UpdateExpression: "SET #comments = :comments",
      ExpressionAttributeNames: {
        "#comments": "comments",
      },
      ExpressionAttributeValues: {
        ":comments": result.Item.comments,  
      },
      ReturnValues: "ALL_NEW",
    };

    await dynamoDB.update(updateParams).promise();

    res.status(200).json({ reply: newReply });
  } catch (error) {
    console.error("Error replying to comment:", error);
    res.status(500).json({ message: "Error replying to comment", error: error.message });
  }
});



router.put("/:newsId/rate", async (req, res) => {
  const { newsId } = req.params;
  const { userEmail, rating } = req.body;

  console.log(req.body);

  if (!userEmail || !rating || rating < 1 || rating > 5) {
    return res
      .status(400)
      .json({ message: "Valid userId and rating (1-5) are required" });
  }

  try {
    const params = {
      TableName: table,
      Key: { newsId },
      UpdateExpression: `
        SET #ratings.#total = if_not_exists(#ratings.#total, :start) + :newRating,
            #ratings.#count = if_not_exists(#ratings.#count, :start) + :inc
      `,
      ExpressionAttributeNames: {
        "#ratings": "ratings",
        "#total": "total",   
        "#count": "count",   
      },
      ExpressionAttributeValues: {
        ":start": 0,
        ":newRating": rating,
        ":inc": 1,
      },
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDB.update(params).promise();

    const newAverageRating = result.Attributes.ratings.total / result.Attributes.ratings.count;


    res.status(200).json({
      success: true,
      message: "Rating added successfully",
      newAverageRating,
      updatedItem: result.Attributes,
    });
  } catch (error) {
    res.status(500).json({ error: "Error adding rating", details: error });
  }
});


router.put("/:newsId/unlike", async (req, res) => {
  const { newsId, userEmail } = req.body;

  try {
    const getParams = {
      TableName: table,
      Key: { newsId },
    };

    const post = await dynamoDB.get(getParams).promise();

    if (!post.Item) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const { likedBy = [], likes = 0 } = post.Item;

    if (!likedBy.includes(userEmail)) {
      return res.status(400).json({
        success: false,
        message: "User has not liked this post",
      });
    }

    const updatedLikedBy = likedBy.filter((email) => email !== userEmail);

    const updateParams = {
      TableName: table,
      Key: { newsId },
      UpdateExpression: "SET #likes = :likes, #likedBy = :updatedLikedBy",
      ExpressionAttributeNames: {
        "#likes": "likes",
        "#likedBy": "likedBy",
      },
      ExpressionAttributeValues: {
        ":likes": Math.max(likes - 1, 0),
        ":updatedLikedBy": updatedLikedBy,
      },
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDB.update(updateParams).promise();

    res.status(200).json({
      success: true,
      message: "Post unliked successfully",
      updatedItem: result.Attributes,
    });
  } catch (error) {
    console.error("Error unliking post:", error);
    res.status(500).json({
      success: false,
      message: "Error unliking post",
      error: error.message || error,
    });
  }
});


router.get("/:newsId/related", async (req, res) => {
  const { newsId } = req.params;

  try {
    // Fetch the current news post to get its category and tag
    const params = {
      TableName: table,
      Key: { newsId },
    };
    const data = await dynamoDB.get(params).promise();

    if (!data.Item) {
      return res.status(404).json({ success: false, message: "News not found" });
    }

    const { category, tag } = data.Item;

    // Fetch related news based on category or tag (use Query if possible)
    const filterParams = {
      TableName: table,
      FilterExpression: "category = :category OR tag = :tag",
      ExpressionAttributeValues: {
        ":category": category,
        ":tag": tag,
      },
    };

    // Fetch related news, excluding the current newsId
    const relatedNewsData = await dynamoDB.scan(filterParams).promise();
    const relatedNews = relatedNewsData.Items.filter(item => item.newsId !== newsId);

    if (relatedNews.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No related news found",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Related news fetched successfully",
      data: relatedNews,
    });
  } catch (error) {
    console.error("Error fetching related news:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching related news",
      error: error.message,
    });
  }
});




module.exports = router;
