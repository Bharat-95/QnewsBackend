const jwt = require('jsonwebtoken');

const getUserFromToken = (token) => {
  if (!token) {
    throw new Error('Authorization token required');
  }

  const decodedToken = jwt.verify(token, 'your_jwt_secret');
  return decodedToken; // Assuming the token contains userId and role information
};

module.exports = { getUserFromToken };
