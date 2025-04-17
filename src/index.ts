import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Get } from "endpoints/get";
import { Post } from "endpoints/post";

const app = new Hono();

const openapi = fromHono(app, {
	docs_url: "/",
});

openapi.get("/api/get", Get);
openapi.post("/api/post", Post);

export default app;
