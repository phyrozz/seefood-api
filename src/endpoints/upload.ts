import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";

class UploadBody {
  file: File;
}

export const upload = new Elysia()
  .decorate('body', new UploadBody())
  .post('/api/upload', async ({ body }) => {
    const file = body.file;

    if (!(file instanceof File)) {
      return { success: false, error: 'No file uploaded' };
    }

    const key = `${nanoid()}.${file.name.split('.').pop()}`;
  
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.BUCKET_URL,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    

    const command = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return {
      success: true,
      result: {
        url,
        key,
      },
    };
  });