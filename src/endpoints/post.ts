import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { nanoid } from "nanoid";

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

  async handle(c) {
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

    return c.json({
      success: true,
      result: {
        key,
      },
    });
  }
}
