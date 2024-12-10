const AWS = require('aws-sdk');
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');


AWS.config.update({ region: 'ap-south-1' }); 

const poolData = {
  UserPoolId: 'ap-south-1_wl9u0zEIm',
  ClientId: '31o7p0re9vrlff8hjhtm8b3klg',
};

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

module.exports = { AWS, AmazonCognitoIdentity, userPool };
