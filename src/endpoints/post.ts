import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import OpenAI from "openai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

class PostBody {
  file: File;
}

export const Post = new Elysia()
  .decorate('body', new PostBody())
  .post('api/post', async ({ body }) => {
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
    console.log('Presigned URL:', url);

    // Download the file from the presigned URL then convert to base64
    const fetchResponse = await fetch(url);
    const reader = fetchResponse.body?.getReader();
    const chunks: Uint8Array[] = [];
    if (reader) {
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (value) chunks.push(value);
        done = readerDone;
      }
    }
    const arrayBuffer = chunks.reduce((acc, chunk) => {
      const temp = new Uint8Array(acc.byteLength + chunk.byteLength);
      temp.set(new Uint8Array(acc), 0);
      temp.set(chunk, acc.byteLength);
      return temp.buffer;
    }, new ArrayBuffer(0));
    const base64Image = arrayBufferToBase64(arrayBuffer);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'you are a food identifier bot. you must accurately identify the food on the image sent by the user. You must also identify filipino dishes accurately.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: `data:${file.type};base64,${base64Image}`,
              detail: 'high',
            },
            {
              type: 'input_text',
              text: 'what is this?',
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'food_schema',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              isFood: {
                type: 'boolean',
                description: 'Whether the image is food or not.',
              },
              foodItems: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    food: {
                      type: 'string',
                      description: 'Food item name.',
                    },
                    description: {
                      type: 'string',
                      description: 'Description of the food item.',
                    },
                    confidence: {
                      type: 'number',
                      description: 'Confidence level of the identification.',
                    },
                    otherPossibleMatches: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          food: {
                            type: 'string',
                            description: 'Possible food item name that might match the current food item.',
                          },
                          description: {
                            type: 'string',
                            description: 'Description of the possible food item.',
                          },
                          confidence: {
                            type: 'number',
                            description: 'Confidence level of the identification.',
                          },
                        },
                        required: ['food', 'description', 'confidence'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['food', 'description', 'confidence', 'otherPossibleMatches'],
                  additionalProperties: false,
                },
              },
            },
            required: ['isFood', 'foodItems'],
            additionalProperties: false,
          },
        },
      },
      reasoning: {},
      tools: [],
      temperature: 1,
      max_output_tokens: 2048,
      top_p: 1,
      store: true,
    });

    return {
      success: true,
      result: {
        key,
        body: JSON.parse(response.output_text),
        inputToken: response.usage.input_tokens,
        outputToken: response.usage.output_tokens,
        totalToken: response.usage.total_tokens,
      },
    };
  }, {
    body: t.Object({
      file: t.File({
        maxSize: 1024 * 1024 * 5, // Max filesize of 5MB
        format: 'image/*'
      }),
    })
  });
