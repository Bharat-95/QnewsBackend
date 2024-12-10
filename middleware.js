const jwt = require('jsonwebtoken');
const axios = require('axios');
const { AWS } = require('./cognito');

const COGNITO_JWK_URL = 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_zRRA0uUPZ/.well-known/jwks.json';

const verifyToken = async (token) => {
  try {
    const response = await axios.get(COGNITO_JWK_URL);
    const jwks = response.data.keys;
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded) throw new Error('Invalid token');

    const key = jwks.find(k => k.kid === decoded.header.kid);
    if (!key) throw new Error('Public key not found');
    
    const publicKey = jwt.jwkToPem(key);
    return jwt.verify(token, publicKey);
  } catch (err) {
    throw new Error('Token verification failed');
  }
};

const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; 
    if (!token) return res.status(401).send({ message: 'Unauthorized' });
  
    try {
      await verifyToken(token);
      next();
    } catch (err) {
      res.status(401).send({ message: 'Invalid or expired token' });
    }
  };
  
module.exports = authenticate;
