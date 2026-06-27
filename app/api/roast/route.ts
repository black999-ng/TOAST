import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import roasts from "@/data/roasts.json";
import compliments from "@/data/compliments.json";

const QUEUE_KEY = "toast:queue";
const API_KEY_INDEX_KEY = "toast:gemini-api-key-index";

// ── Vercel KV helpers ──────────────────────────────────────────────────────

async function ensureSeeded() {
  try {
    const len = await kv.llen(QUEUE_KEY);
    if (len === 0) await kv.rpush(QUEUE_KEY, ...roasts);
  } catch {}
}

function getApiKeysFromEnv(): string[] {
  const numberedKeys = Object.entries(process.env)
    .filter(([key]) => /^GEMINI\d+$/.test(key))
    .sort((a, b) => {
      const aNum = Number(a[0].replace(/^GEMINI/, ""));
      const bNum = Number(b[0].replace(/^GEMINI/, ""));
      return aNum - bNum;
    })
    .map(([, value]) => value?.trim() ?? "")
    .filter(Boolean);

  if (numberedKeys.length) {
    console.log("[API Keys] Source: GEMINI1/2/3... vars");
    console.log("[API Keys] Count:", numberedKeys.length);
    console.log("[API Keys] Previews:", numberedKeys.map((k) => k.slice(0, 8) + "..."));
    return numberedKeys;
  }

  const rawValue =
    process.env.GEMINI_API_KEYS?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!rawValue) {
    console.log("[API Keys] ERROR: No API keys found in environment");
    return [];
  }
  const fallbackKeys = rawValue
    .split(/[\s,;]+/)
    .map((key) => key.trim())
    .filter(Boolean);
  console.log("[API Keys] Source: GEMINI_API_KEYS/GEMINI_API_KEY var");
  console.log("[API Keys] Count:", fallbackKeys.length);
  console.log("[API Keys] Previews:", fallbackKeys.map((k) => k.slice(0, 8) + "..."));
  return fallbackKeys;
}

async function selectApiKeyIndex(): Promise<{ key: string; index: number; keys: string[] }> {
  const keys = getApiKeysFromEnv();
  if (!keys.length) throw new Error("No GEMINI API key(s) configured");
  if (keys.length === 1) return { key: keys[0], index: 0, keys };

  try {
    const index = Number(await kv.incr(API_KEY_INDEX_KEY));
    const pos = Number.isFinite(index) && index > 0 ? (index - 1) % keys.length : 0;
    return { key: keys[pos], index: pos, keys };
  } catch {
    return { key: keys[0], index: 0, keys };
  }
}

function isInvalidKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /API_KEY_INVALID|API_KEY_NOT_VALID|key not valid|invalid.*key/i.test(message);
}

async function attemptWithApiKeys<T>(fn: (apiKey: string) => Promise<T>): Promise<T> {
  const { index, keys } = await selectApiKeyIndex();
  const orderedKeys = [...keys.slice(index), ...keys.slice(0, index)];
  let lastError: unknown;

  for (const apiKey of orderedKeys) {
    try {
      return await fn(apiKey);
    } catch (error) {
      lastError = error;
      if (!isInvalidKeyError(error)) throw error;
    }
  }

  throw lastError;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
  });
  return await Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
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
  return attemptWithApiKeys(async (apiKey) => {
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
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
        maxOutputTokens: 2000,
      },
    });

    const [strength, flaw, misunderstood, achievement, aspiration] = [
      "What is your greatest strength as a person?",
      "What is one flaw or weakness you know you need to work on?",
      "When people misunderstand you, what do they usually get wrong?",
      "What achievement are you most proud of so far?",
      "What kind of person do you aspire to become in the next five years?",
    ].map((q) => answers[q] ?? "nothing");

    const prompt = `You are the most vicious, unhinged Nigerian roast comedian alive. Your only job is to drag ${name} to filth using their own words against them. No mercy. No filter. Pure destruction.

Here is the ammunition ${name} handed you:

1. They claim their greatest strength is: "${strength}"
2. They admitted their flaw is: "${flaw}"
3. They think people misunderstand them by: "${misunderstood}"
4. Their proudest achievement is: "${achievement}"
5. In 5 years they want to be: "${aspiration}"

Now write ONE savage roast paragraph (5-7 sentences) that:
- Opens by mocking their so-called strength ("${strength}") — flip it, expose it as a joke
- Digs into their admitted flaw ("${flaw}") like it defines their entire existence
- Clowns their achievement ("${achievement}") as if it is the saddest thing ever heard
- Destroys their 5-year aspiration ("${aspiration}") by pointing out they can not even handle today
- Closes with one final sentence so devastating that ${name} wants to log off permanently

Rules:
- Use heavy Nigerian Pidgin and street slang throughout (omo, e be things, your village, wetin, abeg, dis one, na you, etc.)
- Reference their actual answers word-for-word at least 3 times — do not paraphrase, quote them directly and mock them
- Zero emojis. Zero encouragement. Zero softening.
- This is a roast, not a therapy session. Be brutal.
- keep it concise of about 30 words max it should be a single paragraph.`;

    const result = await withTimeout(model.generateContent(prompt), 20000);
    const text = result.response.text().trim();
    if (!text) throw new Error("Empty response");
    return text;
  });
}

async function generateCompliment(): Promise<string> {
  return attemptWithApiKeys(async (apiKey) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: { temperature: 1.0, maxOutputTokens: 2000 },
    });

    const result = await withTimeout(
      model.generateContent(
        `You are the universe itself speaking to someone extraordinary. 
Write a deeply sincere, soul-stirring compliment. Not cheesy. Not a motivational poster. REAL. 
Like you actually see this person and you are in awe of them.
3-4 sentences max. No emojis. Start with the word "You are HIM." then continue.
Make them feel like the chosen one. keep it concise of about 20 words max`,
      ),
      20000,
    );

    const text = result.response.text().trim();
    if (!text) throw new Error("Empty response");
    return text;
  });
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
    } catch (error) {
      console.error("generateCompliment failed:", error);
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
    } catch (error) {
      console.error("generateRoast failed:", error);
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