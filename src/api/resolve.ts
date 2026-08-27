import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { s } = req.query;

  if (!s || typeof s !== "string") {
    return res.status(400).json({ error: "Missing slug parameter" });
  }

  try {
    const payload = await kv.get<string>(`qr:${s}`);
    if (!payload) {
      return res.status(404).json({ error: "Short link not found" });
    }

    return res.status(200).json({ payload });
  } catch (error) {
    console.error("Resolve Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}