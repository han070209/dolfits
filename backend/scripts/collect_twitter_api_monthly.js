import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const BEARER = process.env.TWITTER_BEARER_TOKEN;
if (!BEARER) {
  console.error("❌ .env 파일에 TWITTER_BEARER_TOKEN이 없습니다.");
  process.exit(1);
}

const SAVE_JSON = path.join("auto_outfits_x.json");
const SAVE_DIR = path.join("uploads", "auto_from_x");
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

// ✅ 설정
const SEARCH_QUERIES = [
  "(#아이브 OR #IVE OR #장원영 OR #안유진 OR #리즈 OR #가을 OR #이서 OR #레이) has:images",
  "(#에스파 OR #aespa OR #karina OR #winter OR #ningning OR #giselle) has:images",
];
const MAX_RESULTS = 50; // 한번에 50개씩 (두 그룹 합쳐서 100개)

async function fetchTweets(query) {
  const url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", query);
  url.searchParams.set("expansions", "attachments.media_keys");
  url.searchParams.set("media.fields", "url");
  url.searchParams.set("tweet.fields", "created_at,text");
  url.searchParams.set("max_results", MAX_RESULTS.toString());

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BEARER}` },
  });

  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  const data = await res.json();
  return data;
}

async function downloadImage(url, dest) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    fs.writeFileSync(dest, Buffer.from(buf));
    return true;
  } catch (err) {
    console.error("❌ 다운로드 실패:", err.message);
    return false;
  }
}

async function main() {
  let collected = fs.existsSync(SAVE_JSON)
    ? JSON.parse(fs.readFileSync(SAVE_JSON, "utf-8"))
    : [];

  for (const query of SEARCH_QUERIES) {
    console.log("🐦 검색 중:", query);
    const data = await fetchTweets(query);
    if (!data.includes?.media) continue;

    const mediaMap = Object.fromEntries(
      data.includes.media.map((m) => [m.media_key, m.url])
    );

    for (const tweet of data.data || []) {
      if (!tweet.attachments?.media_keys) continue;
      for (const key of tweet.attachments.media_keys) {
        const url = mediaMap[key];
        if (!url) continue;

        const ext = path.extname(new URL(url).pathname) || ".jpg";
        const filename = `${tweet.id}${ext}`;
        const filePath = path.join(SAVE_DIR, filename);

        if (fs.existsSync(filePath)) continue;

        const ok = await downloadImage(url, filePath);
        if (ok) {
          collected.push({
            id: tweet.id,
            text: tweet.text,
            date: tweet.created_at,
            img: `/uploads/auto_from_x/${filename}`,
            query,
          });
          console.log("📸 저장:", filename);
        }
      }
    }
  }

  fs.writeFileSync(SAVE_JSON, JSON.stringify(collected, null, 2));
  console.log("✅ 완료 — 총", collected.length, "개 이미지 기록됨");
}

main().catch(console.error);
