// ElevenLabs gives the tree a voice: it reads its own poem aloud.
// Requires ELEVENLABS_API_KEY; the client only offers the button when the
// poem endpoint is alive, so the static deploy never breaks.

import { NextRequest, NextResponse } from "next/server";

// default: "Rachel" — calm, narrative
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

export async function POST(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const text = String((body as { text?: unknown })?.text ?? "")
    .trim()
    .slice(0, 400); // poems are 3 short lines; keep the free tier safe
  if (!text) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: { stability: 0.45, similarity_boost: 0.7, style: 0.35 },
        }),
      }
    );
    if (!r.ok) {
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }
    const audio = await r.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, s-maxage=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
