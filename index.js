const express = require('express');
const cors = require('cors');
require('dotenv').config(); 
const AWS = require('aws-sdk');


AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const signupRoutes = require('./routes/signup');
const signinRoutes = require('./routes/signin');
const userRoutes =  require('./routes/users');
const newsRoutes = require('./routes/newsEn')
const videoRoutes = require('./routes/video')
const paperRoutes = require('./routes/paper')

const app = express();
const port = 4000;


app.use(express.json());

const corsOptions = {
  origin: 'https://main.d3gbdabqclhexj.amplifyapp.com', // Replace with your Amplify frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], 
};
app.use(cors(corsOptions));



app.use('/auth', signupRoutes);
app.use('/auth', signinRoutes);
app.use('/users', userRoutes);
app.use('/newsEn', newsRoutes);
app.use('/video', videoRoutes);
app.use('/paper', paperRoutes);


app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
