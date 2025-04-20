import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import OpenAI from "openai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// export class Post extends OpenAPIRoute {
//   schema = {
//     tags: ["Upload"],
//     summary: "Upload an image to R2",
//     request: {
//       body: {
//         content: {
//           "multipart/form-data": {
//             schema: z.object({
//               file: z.instanceof(File),
//             }),
//           },
//         },
//       },
//     },
//     responses: {
// 		"200": {
// 			description: "Image uploaded successfully",
// 			content: {
// 				"application/json": {
// 					schema: z.object({
// 						success: z.boolean(),
// 						result: z.object({
// 							key: z.string(),
// 						}),
// 					}),
// 				},
// 			},
// 		},
// 		"400": {
// 			description: "Bad request",
// 			content: {
// 				"application/json": {
// 					schema: z.object({
// 						success: z.boolean(),
// 						error: z.string(),
// 					}),
// 				},
// 			},
// 		},
// 		"500": {
// 			description: "Internal server error",
// 			content: {
// 				"application/json": {
// 					schema: z.object({
// 						success: z.boolean(),
// 						error: z.string(),
// 					}),
// 				},
// 			},	
// 		},
//     },
//   };

//   arrayBufferToBase64(buffer: any) {
//     let binary = '';
//     const bytes = new Uint8Array(buffer);
//     const len = bytes.byteLength;
//     for (let i = 0; i < len; i++) {
//       binary += String.fromCharCode(bytes[i]);
//     }
//     return btoa(binary);
//   }

//   async handle(c) {
//     let openai = new OpenAI({
//       apiKey: c.env.OPENAI_KEY,
//     });

//     const formData = await c.req.parseBody();
//     const file = formData["file"];

//     if (!(file instanceof File)) {
//       return c.json({ success: false, error: "No file uploaded" }, 400);
//     }

//     const key = `${nanoid()}.${file.name.split(".").pop()}`;
//     await c.env.UPLOADS_BUCKET.put(key, file.stream(), {
//       httpMetadata: {
//         contentType: file.type,
//       },
//     });

//     const object = await c.env.UPLOADS_BUCKET.get(key);
//     if (!object || !object.body) {
//       return c.json({ success: false, error: "Image not found" }, 404);
//     }

//     const arrayBuffer = await new Response(object.body).arrayBuffer();
//     const base64Image = this.arrayBufferToBase64(arrayBuffer);

//     // Call OpenAI API to read the image and generate a response
//     const response = await openai.responses.create({
//       model: "gpt-4.1-mini",
//       input: [
//         {
//           "role": "system",
//           "content": [
//             {
//               "type": "input_text",
//               "text": "you are a food identifier bot. you must accurately identify the food on the image sent by the user. You must also identify filipino dishes accurately."
//             }
//           ]
//         },
//         {
//           "role": "user",
//           "content": [
//             {
//               "type": "input_image",
//               "image_url": `data:${file.type};base64,${base64Image}`, // The image key from R2
//               "detail": "high"
//             },
//             {
//               "type": "input_text",
//               "text": "what is this?"
//             }
//           ]
//         }
//       ],
//       text: {
//         "format": {
//           "type": "json_schema",
//           "name": "food_schema",
//           "strict": true,
//           "schema": {
//             "type": "object",
//             "properties": {
//               "isFood": {
//                 "type": "boolean",
//                 "description": "Whether the image is food or not."
//               },
//               "foodItems": {
//                 "type": "array",
//                 "items": {
//                   "type": "object",
//                   "properties": {
//                     "food": {
//                       "type": "string",
//                       "description": "Food item name."
//                     },
//                     "description": {
//                       "type": "string",
//                       "description": "Description of the food item."
//                     },
//                     "confidence": {
//                       "type": "number",
//                       "description": "Confidence level of the identification."
//                     },
//                     "otherPossibleMatches": {
//                       "type": "array",
//                       "items": {
//                         "type": "object",
//                         "properties": {
//                           "food": {
//                             "type": "string",
//                             "description": "Possible food item name that might match the current food item."
//                           },
//                           "description": {
//                             "type": "string",
//                             "description": "Description of the possible food item."
//                           },
//                           "confidence": {
//                             "type": "number",
//                             "description": "Confidence level of the identification."
//                           }
//                         },
//                         "required": [
//                           "food",
//                           "description",
//                           "confidence"
//                         ],
//                         "additionalProperties": false
//                       }
//                     }
//                   },
//                   "required": [
//                     "food",
//                     "description",
//                     "confidence",
//                     "otherPossibleMatches"
//                   ],
//                   "additionalProperties": false
//                 },
//               },
//             },
//             "required": [
//               "isFood",
//               "foodItems"
//             ],
//             "additionalProperties": false
//           }
//         }
//       },
//       reasoning: {},
//       tools: [],
//       temperature: 1,
//       max_output_tokens: 2048,
//       top_p: 1,
//       store: true
//     });

//     return c.json({
//       success: true,
//       result: {
//         key,
//         body: JSON.parse(response.output_text),
//         inputToken: response.usage.input_tokens,
//         outputToken: response.usage.output_tokens,
//         totalToken: response.usage.total_tokens,
//       }
//     });
//   }
// }

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

    const arrayBuffer = await new Response(url).arrayBuffer();
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
        maxSize: 1024 * 1024 * 5, // 5MB
        format: 'image/*'
      }),
    })
  });
