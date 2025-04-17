import { OpenAPIRoute } from "chanfana";
import { z } from "zod";

export class Get extends OpenAPIRoute {
  schema = {
      tags: ["Get", "Health Check"],
      summary: "Health check endpoint for the API.",
      request: { },
      responses: {
        "200": {
          description: "Response from the API",
          content: {
            "application/json": {
              schema: z.object({
                success: z.boolean(),
                result: z.object({}),
              }),
            },
          },
        },
      },
    };

  async handle(c) {
    return c.json({
        success: true,
        result: {
            message: "Hello world!",
        },
    });
  }
}