import {
  S3Client,
    CreateBucketCommand,
    GetBucketPolicyStatusCommand,
    GetBucketPolicyCommand,
  S3ServiceException
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

export async function createBucket() {
    const client = new S3Client({region:"ap-south-1", credentials:{
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
    }});
    const bucketName = `test-bucket-${Date.now()}`;
    try {
        await client.send(
            new CreateBucketCommand({
                Bucket: bucketName,
            }),
        );
        console.log(`Bucket ${bucketName} created successfully`);
    } catch (error) {
        console.error(`Error creating bucket ${bucketName}:`, error);
    }
}

export async function getBucketPolicyStatus(bucketName) {
    const client = new S3Client({region:"ap-south-1", credentials:{
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
    }});
    try {
        const data = await client.send(
            new GetBucketPolicyCommand({
                Bucket: bucketName
            }),
        );
        console.log(`Bucket policy status for ${bucketName}:`, data);
    } catch (caught) {
    if (
      caught instanceof S3ServiceException &&
      caught.name === "NoSuchBucket"
    ) {
      console.error(
        `Error from S3 while getting policy from ${bucketName}. The bucket doesn't exist.`,
      );
    } else if (caught instanceof S3ServiceException) {
      console.error(
        `Error from S3 while getting policy from ${bucketName}.  ${caught.name}: ${caught.message}`,
      );
    } else {
      throw caught;
    }
  }
}

getBucketPolicyStatus("test-bucket-1772566859966");
