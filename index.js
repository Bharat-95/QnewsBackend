const express = require('express');
const cors = require('cors');
require('dotenv').config(); 
const AWS = require('aws-sdk');


AWS.config.update({
  accessKeyId: "AKIAXWMA6BMGA22NZWUT",
  secretAccessKey: "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",
  region: "ap-south-1",
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
app.use(cors());


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
