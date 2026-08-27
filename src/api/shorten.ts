import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

function generateSlug(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let slug = "";
  for (let i = 0; i < length; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(455).json({ error: "Method not allowed" });
  }

  try {
    const { payload } = req.body;
    if (!payload || typeof payload !== "string") {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const slug = generateSlug(6);

    // Store in KV with a 90-day expiration (or persist indefinitely)
    await kv.set(`qr:${slug}`, payload, { ex: 60 * 60 * 24 * 90 });

    return res.status(200).json({ slug });
  } catch (error) {
    console.error("Shortener Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}