import { Elysia } from 'elysia';
import { Get } from './endpoints/get';
import { Post } from './endpoints/post';
import { upload } from 'endpoints/upload';

export const app = new Elysia({ aot: false })
  .use(Get)
  .use(Post)
  .use(upload);
