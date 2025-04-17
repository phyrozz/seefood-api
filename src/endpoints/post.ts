import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { nanoid } from "nanoid";
import OpenAI from "openai";

export class Post extends OpenAPIRoute {
  schema = {
    tags: ["Upload"],
    summary: "Upload an image to R2",
    request: {
      body: {
        content: {
          "multipart/form-data": {
            schema: z.object({
              file: z.instanceof(File),
            }),
          },
        },
      },
    },
    responses: {
		"200": {
			description: "Image uploaded successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						result: z.object({
							key: z.string(),
						}),
					}),
				},
			},
		},
		"400": {
			description: "Bad request",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.string(),
					}),
				},
			},
		},
		"500": {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.string(),
					}),
				},
			},	
		},
    },
  };

  arrayBufferToBase64(buffer: any) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async handle(c) {
    let openai = new OpenAI({
      apiKey: c.env.OPENAI_KEY,
    });

    const formData = await c.req.parseBody();
    const file = formData["file"];

    if (!(file instanceof File)) {
      return c.json({ success: false, error: "No file uploaded" }, 400);
    }

    const key = `${nanoid()}.${file.name.split(".").pop()}`;
    await c.env.UPLOADS_BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const object = await c.env.UPLOADS_BUCKET.get(key);
    if (!object || !object.body) {
      return c.json({ success: false, error: "Image not found" }, 404);
    }

    const arrayBuffer = await new Response(object.body).arrayBuffer();
    const base64Image = this.arrayBufferToBase64(arrayBuffer);

    // Call OpenAI API to read the image and generate a response
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          "role": "system",
          "content": [
            {
              "type": "input_text",
              "text": "you are a food identifier bot. you must accurately identify the food on the image sent by the user."
            }
          ]
        },
        {
          "role": "user",
          "content": [
            {
              "type": "input_image",
              "image_url": `data:${file.type};base64,${base64Image}`, // The image key from R2
              "detail": "high"
            },
            {
              "type": "input_text",
              "text": "what is this?"
            }
          ]
        }
      ],
      text: {
        "format": {
          "type": "json_schema",
          "name": "food_schema",
          "strict": true,
          "schema": {
            "type": "object",
            "properties": {
              "isFood": {
                "type": "boolean",
                "description": "Whether the image is food or not."
              },
              "foodItems": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "food": {
                      "type": "string",
                      "description": "Food item name."
                    },
                    "description": {
                      "type": "string",
                      "description": "Description of the food item."
                    },
                    "confidence": {
                      "type": "number",
                      "description": "Confidence level of the identification."
                    }
                  },
                  "required": [
                    "food",
                    "description",
                    "confidence"
                  ],
                  "additionalProperties": false
                },
              },
            },
            "required": [
              "isFood",
              "foodItems"
            ],
            "additionalProperties": false
          }
        }
      },
      reasoning: {},
      tools: [],
      temperature: 1,
      max_output_tokens: 2048,
      top_p: 1,
      store: true
    });

    return c.json({
      success: true,
      result: {
        key,
        body: JSON.parse(response.output_text)
      }
    });
  }
}
