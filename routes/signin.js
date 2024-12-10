const express = require('express');
const AWS = require('aws-sdk');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = 'Users';

router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body)

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await dynamoDB
      .get({
        TableName: USERS_TABLE,
        Key: { qnews: email },
      })
      .promise();

    const user = result.Item;

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the user is blocked
    if (user.status === 'Blocked') {
      return res.status(403).json({ message: 'Your account has been blocked. Please contact support.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { email: user.qnews, role: user.role },
      'your_jwt_secret', 
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        email: user.qnews,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
