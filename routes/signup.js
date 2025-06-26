const express = require("express");
const AWS = require("aws-sdk");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const router = express.Router();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = "Users";

router.post("/signup", async (req, res) => {
  try {
    const { email, password, firstName, lastName, phoneNumber, role } =
      req.body;

    let assignedRole = role || "User";

    if (!email || !password || !firstName || !lastName ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Please enter a valid email address" });
    }
if (phoneNumber) {
  const phoneRegex = /^\+\d{1,3}\s?\d{10}$/;
  if (!phoneRegex.test(phoneNumber)) {
    return res.status(400).json({
      message:
        "Phone number must include a valid country code and 10-digit number (e.g., +91 7993291554)",
    });
  }
}


    const passwordRegex =
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters, including a number, a lowercase letter, an uppercase letter, and a special character",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await dynamoDB
      .query({
        TableName: USERS_TABLE,
        KeyConditionExpression: "qnews = :email",
        ExpressionAttributeValues: {
          ":email": email,
        },
      })
      .promise();

    if (existingUser.Items.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const newUser = {
      qnews: email,
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber: phoneNumber ||  null,
      role: assignedRole,
      status: "Active",
      createdAt: new Date().toISOString(),
    };

    await dynamoDB
      .put({
        TableName: USERS_TABLE,
        Item: newUser,
      })
      .promise();

    const token = jwt.sign(
      { email: newUser.qnews, role: newUser.role },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "1h" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        email: newUser.qnews,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
