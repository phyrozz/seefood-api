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
      endpoint: 'https://9df9fc38b820f31738a67e2abf240d01.r2.cloudflarestorage.com/seefood-uploads',
      credentials: {
        accessKeyId: '',
        secretAccessKey: '',
      },
    });

    const command = new PutObjectCommand({
      Bucket: 'seefood-uploads',
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  });