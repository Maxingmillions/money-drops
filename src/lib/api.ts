import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getSession, type Session } from "./session";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new ApiError(401, "Sign in required");
  return s;
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  return schema.parse(raw);
}

/** Wrap a route handler so thrown ApiError / ZodError become JSON responses. */
export function handler<Ctx>(
  fn: (req: Request, ctx: Ctx) => Promise<Response>,
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        return json({ error: "Invalid request", issues: e.issues }, { status: 400 });
      }
      console.error(e);
      return json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}
