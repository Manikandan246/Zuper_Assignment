import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROOFING_KEYTERMS = [
  "ridge cap",
  "ridge vent",
  "vent boot",
  "pipe boot",
  "pipe collar",
  "step flashing",
  "valley flashing",
  "drip edge",
  "ice and water shield",
  "decking",
  "soffit",
  "fascia",
  "granule loss",
  "underlayment",
  "shingle",
  "asphalt 3-tab",
  "architectural shingle",
];

type DeepgramWord = {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  confidence: number;
};

type DeepgramResponse = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript: string;
        words?: DeepgramWord[];
      }>;
    }>;
  };
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DEEPGRAM_API_KEY not configured" }, { status: 500 });
  }

  const formData = await req.formData();
  const audio = formData.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "audio file is required" }, { status: 400 });
  }

  const arrayBuffer = await audio.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    language: "en",
  });
  for (const term of ROOFING_KEYTERMS) {
    params.append("keyterm", term);
  }

  const t0 = Date.now();
  const dgRes = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": audio.type || "audio/webm",
    },
    body: buffer,
  });
  const latencyMs = Date.now() - t0;

  if (!dgRes.ok) {
    const body = await dgRes.text();
    return NextResponse.json({ error: `Deepgram ${dgRes.status}: ${body}` }, { status: 502 });
  }

  const data = (await dgRes.json()) as DeepgramResponse;
  const alt = data.results?.channels?.[0]?.alternatives?.[0];
  const transcript = alt?.transcript ?? "";
  const wordConfidences = (alt?.words ?? []).map((w) => ({
    word: w.punctuated_word ?? w.word,
    start: w.start,
    end: w.end,
    confidence: w.confidence,
  }));

  return NextResponse.json({
    transcript,
    wordConfidences,
    sttProvider: "deepgram",
    sttModel: "nova-3",
    latencyMs,
    audioSizeBytes: buffer.byteLength,
  });
}
