const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = 'Users';

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


module.exports = router;
