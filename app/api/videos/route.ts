import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".ogg"];

export async function GET() {
  try {
    const videosDirectory = path.join(process.cwd(), "public", "videos");
    const entries = fs.readdirSync(videosDirectory, { withFileTypes: true });

    const videos = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => VIDEO_EXTENSIONS.includes(path.extname(name).toLowerCase()))
      .sort()
      .map((name) => `/videos/${name}`);

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Failed to read videos folder:", error);
    return NextResponse.json({ videos: [] });
  }
}
