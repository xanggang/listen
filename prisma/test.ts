import { PrismaClient } from './generated/prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

export interface Env {
  DB: D1Database;
}

async function testFun(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const adapter = new PrismaD1(env.DB);
  const prisma = new PrismaClient({ adapter });

  const users = await prisma.user.findMany();
  const result = JSON.stringify(users);
  ctx.waitUntil(prisma.$disconnect()); // or just await prisma.$disconnect()
  console.log(result)
  return new Response(result);
}

async function fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  console.log(env)
  const adapter = new PrismaD1(env.DB);
  const prisma = new PrismaClient({ adapter });

  const users = await prisma.user.findMany();
  const result = JSON.stringify(users);
  ctx.waitUntil(prisma.$disconnect()); // or just await prisma.$disconnect()
  console.log(result)
  return new Response(result);
}

export {
  fetch,
  testFun
}
