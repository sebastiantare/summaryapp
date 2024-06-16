import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configure S3 Client
const client = new S3Client({});

const uploadImage = async (filePath) => {
  try {
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName, // File name you want to save as in S3
      Body: fileContent,
      ContentType: 'image/jpeg', // Adjust based on the file type
    };

    const command = new PutObjectCommand(params);

    const response = await client.send(command);
    console.log(response.Location);

  } catch (error) {
    console.error('Error uploading file:', error);
  }
};

// Replace 'your-image-path.jpg' with the actual file path
const filePath = 'adblocker.png';
uploadImage(filePath);
