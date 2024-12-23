const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = 'Users';
const otpStore = {};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'qgroupmedia1@gmail.com',
    pass: 'Bhavya@@2009',
  },
});

router.get('/', async (req, res) => {
  try {
    const params = {
      TableName: USERS_TABLE,
    };

    const data = await dynamoDB.scan(params).promise();
    res.status(200).json({
      success: true,
      message: 'Fetched users successfully',
      data: data.Items,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message,
    });
  }
});


router.put('/:qnews', async (req, res) => {
  const { qnews } = req.params;
  const { firstName, lastName, phoneNumber, role, status } = req.body;

  try {
    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    if (firstName) {
      updateExpression.push('firstName = :firstName');
      expressionAttributeValues[':firstName'] = firstName;
    }

    if (lastName) {
      updateExpression.push('lastName = :lastName');
      expressionAttributeValues[':lastName'] = lastName;
    }

    if (phoneNumber) {
      updateExpression.push('phoneNumber = :phoneNumber');
      expressionAttributeValues[':phoneNumber'] = phoneNumber;
    }

    if (role) {
      updateExpression.push('#rl = :role');
      expressionAttributeValues[':role'] = role;
      expressionAttributeNames['#rl'] = 'role';
    }

    if (status) {
      updateExpression.push('#st = :status');
      expressionAttributeValues[':status'] = status;
      expressionAttributeNames['#st'] = 'status';
    }

    if (updateExpression.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided to update',
      });
    }

    const params = {
      TableName: USERS_TABLE,
      Key: { qnews },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length
        ? expressionAttributeNames
        : undefined,
      ReturnValues: 'ALL_NEW',
    };

    const data = await dynamoDB.update(params).promise();

    res.status(200).json({
      success: true,
      message: `User with qnews ${qnews} updated successfully`,
      data: data.Attributes,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message,
    });
  }
});



router.delete('/:qnews', async (req, res) => {
    const { qnews } = req.params;
  
    try {
      const params = {
        TableName: USERS_TABLE,
        Key: {
          qnews,
        },
      };
  
      const data = await dynamoDB.delete(params).promise();
  
      res.status(200).json({
        success: true,
        message: `User with email ${qnews} deleted successfully`,
        data: data,
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting user',
        error: error.message,
      });
    }
  });


  router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log(email);
  
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
  
    const params = {
      TableName: USERS_TABLE,
      Key: {
        qnews: email,
      },
    };
  
    try {
      const data = await dynamoDB.get(params).promise();
      if (!data.Item) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      const otp = crypto.randomInt(100000, 999999).toString();
      otpStore[email] = otp; // Store OTP for later verification
  
      const mailOptions = {
        from: 'qgroupmedia1@gmail.com',
        to: email,
        subject: 'Password Reset OTP',
        text: `Your OTP for resetting your password is: ${otp}`,
      };
  
      await transporter.sendMail(mailOptions);
  
      res.status(200).json({
        success: true,
        message: 'OTP sent to your email address.',
      });
    } catch (error) {
      console.error('Error sending OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Error sending OTP',
        error: error.message,
      });
    }
  });


router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required' });
  }


  if (otpStore[email] !== otp) {
    return res.status(400).json({ success: false, message: 'Invalid OTP' });
  }


  res.status(200).json({
    success: true,
    message: 'OTP verified successfully. You can now reset your password.',
  });
});



router.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email and new password are required' });
  }


  const hashedPassword = await bcrypt.hash(newPassword, 10);


  const params = {
    TableName: USERS_TABLE,
    Key: {
      qnews: email,
    },
    UpdateExpression: 'SET password = :password',
    ExpressionAttributeValues: {
      ':password': hashedPassword,
    },
    ReturnValues: 'ALL_NEW',
  };

  try {
    const data = await dynamoDB.update(params).promise();

    delete otpStore[email];

    res.status(200).json({
      success: true,
      message: 'Password reset successfully.',
      data: data.Attributes,
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message,
    });
  }
});


module.exports = router;
