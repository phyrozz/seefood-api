import { Elysia } from 'elysia';

export const Get = new Elysia().get('api/get', () => {
  return {
    success: true,
    result: {
      message: 'API is running!'
    },
  };
});