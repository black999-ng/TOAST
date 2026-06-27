import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import roasts from "@/data/roasts.json";
import compliments from "@/data/compliments.json";

const QUEUE_KEY = "toast:queue";

// ── Vercel KV helpers ──────────────────────────────────────────────────────

async function ensureSeeded() {
  try {
    const len = await kv.llen(QUEUE_KEY);
    if (len === 0) await kv.rpush(QUEUE_KEY, ...roasts);
  } catch {}
}

async function peekFront(): Promise<string> {
  try {
    await ensureSeeded();
    const roast = await kv.lindex(QUEUE_KEY, 0);
    return roast ?? roasts[Math.floor(Math.random() * roasts.length)];
  } catch {
    return roasts[Math.floor(Math.random() * roasts.length)];
  }
}

async function rotateQueue(userRoast: string) {
  try {
    await ensureSeeded();
    await kv.rpush(QUEUE_KEY, userRoast);
    await kv.lpop(QUEUE_KEY);
  } catch {}
}

// ── Gemini roast generator ─────────────────────────────────────────────────

async function generateRoast(
  name: string,
  answers: Record<string, string>
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No GEMINI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
    generationConfig: {
      temperature: 2.0,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 400,
    },
  });

  const answersText = Object.entries(answers)
    .map(([q, a]) => `- ${q}: ${a}`)
    .join("\n");

  const prompt = `You are the most brutal, unfiltered Nigerian roast machine to ever exist. Your job is to personally destroy ${name} with words alone.

Use heavy Nigerian Pidgin English mixed with Yoruba, Igbo, and Hausa slang. Be completely savage. Reference their village, their ancestors, their hairline, their destiny, their future, their smell, their grades, their village people — anything goes.

${name} answered these questions:
${answersText}

Use their actual answers to make the roast deeply personal. If they said their spirit animal is a lion, tell them even the lion is embarrassed. If they rated their intelligence 9/10, drag them for it. Weaponize every single answer against them.

Write ONE devastating roast paragraph. 4-6 sentences. No emojis. No mercy. No filter. Full chaos. End with something that makes ${name} want to close their laptop and go pray.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  if (!text) throw new Error("Empty response");
  return text;
}

async function generateCompliment(): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No GEMINI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { temperature: 1.0, maxOutputTokens: 200 },
  });

  const result = await model.generateContent(
    `You are the universe itself speaking to someone extraordinary. 
Write a deeply sincere, soul-stirring compliment. Not cheesy. Not a motivational poster. REAL. 
Like you actually see this person and you are in awe of them.
3-4 sentences max. No emojis. Start with the word "You." then continue.
Make them feel like the chosen one.`
  );

  const text = result.response.text().trim();
  if (!text) throw new Error("Empty response");
  return text;
}

// ── Route handlers ─────────────────────────────────────────────────────────

export async function GET() {
  const roast = await peekFront();
  return NextResponse.json({ roast });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // HIM. easter egg
  if (body.action === "him") {
    let compliment: string;
    try {
      compliment = await generateCompliment();
    } catch {
      compliment = compliments[Math.floor(Math.random() * compliments.length)];
    }
    return NextResponse.json({ compliment });
  }

  // Generate roast
  if (body.action === "roast") {
    const { name, answers } = body;
    let roastText: string;
    try {
      roastText = await generateRoast(name ?? "this person", answers ?? {});
    } catch {
      // Fallback to JSON roasts
      roastText = roasts[Math.floor(Math.random() * roasts.length)];
    }
    return NextResponse.json({ roast: roastText });
  }

  // Submit user's roast into the chain
  if (body.action === "submit" && body.roast?.trim()) {
    await rotateQueue(body.roast.trim());
  }

  return NextResponse.json({ ok: true });
}
