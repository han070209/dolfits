// server.js — DolFits 백엔드 시



import express from "express";
import multer from "multer";
import fs from "fs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import winston from "winston";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { spawn } from "child_process";
import AWS from "aws-sdk";
import multerS3 from "multer-s3";



const app = express();

// --------------------------
// 🔁 X 자동 수집 API (공백경로 완벽 처리)
// --------------------------
app.post("/api/collect-x", basicAdminAuth, async (req, res) => {
  try {
    // ✅ 실행 명령을 문자열로 감싸서 shell로 실행
    const cmd = `"${process.execPath}" scripts/collect_twitter_api_monthly.js`;

    const proc = spawn(cmd, {
      cwd: path.resolve("."),
      shell: true, // ✅ ← cmd.exe로 감싸서 공백경로 자동 처리
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let responded = false;

    proc.stdout.on("data", (data) => (stdout += data.toString()));
    proc.stderr.on("data", (data) => (stderr += data.toString()));

    proc.on("close", (code) => {
      if (responded) return;
      responded = true;

      console.log("📸 X Collect Result:", stdout);
      if (stderr) console.error("stderr:", stderr);

      const jsonPath = path.join("backend", "auto_outfits_x.json");
      const list = fs.existsSync(jsonPath)
        ? JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
        : [];

      res.json({
        success: true,
        count: list.length,
        code,
        output: stdout.trim(),
        errors: stderr ? stderr.trim() : null,
      });
    });

    proc.on("error", (err) => {
      if (responded) return;
      responded = true;
      console.error("❌ spawn error:", err.message);
      res.json({ success: false, error: err.message });
    });
  } catch (e) {
    console.error("❌ X 수집 오류:", e.message);
    if (!res.headersSent) res.json({ success: false, error: e.message });
  }
});


// ✅ 이제 나머지 기존 코드들 (helmet, multer, logger 등) 아래에 이어 붙이기




const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

// 🔹 AWS S3 설정
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();




const PORT = Number(process.env.PORT || 3000);

app.use(helmet({ contentSecurityPolicy: false }));


app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ----- logger
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, "server.log") }),
    new winston.transports.Console(),
  ],
});

// ----- paths
const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");

const uploadFolder = path.join(backendDir, "uploads");
const requestUploadFolder = path.join(backendDir, "request_uploads");
const backupsFolder = path.join(backendDir, "backups");

// 🔹 자동 수집 엔진 전용 경로
const autoUploadFolder = path.join(backendDir, "auto_uploads");
const AUTO_OUTFITS_JSON = path.join(backendDir, "auto_outfits.json");

const OUTFITS_JSON = path.join(backendDir, "outfitss.json");
const REQUESTS_JSON = path.join(backendDir, "requests.json");

[uploadFolder, requestUploadFolder, backupsFolder, logDir, autoUploadFolder].forEach((p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});
function ensureJson(file, initial = []) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initial, null, 2), "utf-8");
}
ensureJson(OUTFITS_JSON, []);
ensureJson(REQUESTS_JSON, []);
ensureJson(AUTO_OUTFITS_JSON, []);

function loadJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); }
  catch (e) { logger.error("loadJson", e); return []; }
}
function saveJson(file, data) {
  try {
    const now = new Date();
    const dateKey = now.toISOString().slice(0,10); // 예: 2025-11-02
    const bakName = `${path.basename(file, ".json")}.${dateKey}.json`;
    const bak = path.join(backupsFolder, bakName);

    // ✅ 같은 날짜 파일이 이미 있으면 새 백업은 생략
    if (!fs.existsSync(bak)) {
      fs.writeFileSync(bak, JSON.stringify(data, null, 2), "utf-8");
    }
  } catch (e) { logger.warn("backup skip:", e.message); }

  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}


// ----- basic auth
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "change_me";
function basicAdminAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.split(" ")[1] || "";
  if (!token) return res.set("WWW-Authenticate", "Basic").status(401).send("Auth required");
  const [u, p] = Buffer.from(token, "base64").toString().split(":");
  if (u === ADMIN_USER && p === ADMIN_PASS) return next();
  return res.set("WWW-Authenticate", "Basic").status(401).send("Unauthorized");
}

// ----- admin routes (🚨 정적 서빙보다 '위'에 둔다)
app.use("/admin", basicAdminAuth, express.static(backendDir));
app.get("/admin", basicAdminAuth, (req, res) => {
  res.sendFile(path.join(backendDir, "admin.html"));
});

// ----- static
app.use("/uploads", express.static(uploadFolder));
app.use("/request_uploads", express.static(requestUploadFolder));
// 🔹 자동 수집 미리보기용
app.use("/auto_uploads", express.static(autoUploadFolder));
app.use("/", express.static(frontendDir));

// ----- multer
// 🔹 S3에 직접 업로드되도록 설정
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    acl: "public-read", // 업로드 후 외부에서 볼 수 있게
    key: function (req, file, cb) {
      const filename = `${Date.now()}-${file.originalname}`;
      cb(null, filename);
    },
  }),
});


const storageReq = multer.diskStorage({
  destination: (req, file, cb) => cb(null, requestUploadFolder),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname || ".jpg")}`),
});
const uploadReq = multer({ storage: storageReq });


const requestUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  message: { success: false, error: "Too many upload requests. Please wait." },
  standardHeaders: "draft-7"
});

app.post("/request-upload", requestUploadLimiter, uploadReq.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: "no_file" });
  const list = loadJson(REQUESTS_JSON);
  const rec = { id: Date.now(), filename: req.file.filename, path: `/request_uploads/${req.file.filename}`, createdAt: Date.now() };
  list.unshift(rec);
  saveJson(REQUESTS_JSON, list);
  res.json({ success: true, request: rec });
});


// ----- admin APIs: outfits (원기능 유지)
app.get("/outfits", basicAdminAuth, (req, res) => {
  let list = loadJson(OUTFITS_JSON);
  let changed = false;
  list = list.map((rec) => {
    if (!rec.path && rec.filename) { rec.path = `/uploads/${rec.filename}`; changed = true; }
    return rec;
  });
  if (changed) saveJson(OUTFITS_JSON, list);
  res.json({ success: true, outfits: list });
});

app.post("/upload", basicAdminAuth, upload.single("image"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "no_file" });
    const { groupName = "", name = "", date = "" } = req.body || {};
    const list = loadJson(OUTFITS_JSON);
    const rec = {
      filename: req.file.filename,
      path: req.file.location, // S3 업로드 URL
      uploadedAt: Date.now(),
      groupName, name, date,
      items: [],
      likes: 0,
    };
    list.unshift(rec);
    saveJson(OUTFITS_JSON, list);
    res.json({ success: true, outfit: rec });
  } catch (e) {
    logger.error("upload error", e);
    res.status(500).json({ success: false, error: "upload_failed" });
  }
});

app.put("/update-outfit/:filename", basicAdminAuth, (req, res) => {
  const { filename } = req.params;
  const { items, meta } = req.body || {};
  const list = loadJson(OUTFITS_JSON);
  const idx = list.findIndex((x) => x.filename === filename);
  if (idx < 0) return res.status(404).json({ success: false, error: "not_found" });
  if (Array.isArray(items)) list[idx].items = items;
  if (meta && typeof meta === "object") list[idx].meta = { ...(list[idx].meta || {}), ...meta };
  if (meta?.groupName !== undefined) list[idx].groupName = meta.groupName;
  if (meta?.memberName !== undefined) list[idx].name = meta.memberName;
  if (meta?.date !== undefined) list[idx].date = meta.date;

  saveJson(OUTFITS_JSON, list);
  res.json({ success: true, outfit: list[idx] });
});

app.delete("/delete-outfit/:filename", basicAdminAuth, (req, res) => {
  const { filename } = req.params;
  const list = loadJson(OUTFITS_JSON);
  const idx = list.findIndex((x) => x.filename === filename);
  if (idx < 0) return res.status(404).json({ success: false, error: "not_found" });
  const fp = path.join(uploadFolder, filename);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  list.splice(idx, 1);
  saveJson(OUTFITS_JSON, list);
  res.json({ success: true });
});

// ----- requests (원기능 유지)
app.post("/request-upload", uploadReq.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: "no_file" });
  const list = loadJson(REQUESTS_JSON);
  const rec = { id: Date.now(), filename: req.file.filename, path: `/request_uploads/${req.file.filename}`, createdAt: Date.now() };
  list.unshift(rec);
  saveJson(REQUESTS_JSON, list);
  res.json({ success: true, request: rec });
});
app.get("/requests", basicAdminAuth, (req, res) => {
  res.json({ success: true, requests: loadJson(REQUESTS_JSON) });
});
app.delete("/delete-request/:id", basicAdminAuth, (req, res) => {
  const id = String(req.params.id || "");
  const list = loadJson(REQUESTS_JSON);
  const idx = list.findIndex((x) => String(x.id) === id);
  if (idx < 0) return res.status(404).json({ success: false, error: "not_found" });
  const fp = path.join(requestUploadFolder, list[idx].filename);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  list.splice(idx, 1);
  saveJson(REQUESTS_JSON, list);
  res.json({ success: true });
});

// ----- public APIs (원기능 유지)
function _mapOutfit(rec) {
  return {
    filename: rec.filename,
    path: rec.path || (rec.filename ? `/uploads/${rec.filename}` : ""),
    uploadedAt: rec.uploadedAt || null,
    likes: rec.likes || 0,
    items: Array.isArray(rec.items) ? rec.items : [],
    meta: rec.meta || {},
    groupName: rec.groupName || "",
    name: rec.name || "",
    date: rec.date || "",
  };
}
function _publicList() { return loadJson(OUTFITS_JSON).map(_mapOutfit); }

app.get(
  ["/outfits.json", "/data/outfits.json", "/outfitss.json", "/data/outfitss.json", "/api/public/outfits"],
  (req, res) => { res.json(_publicList()); }
);
app.get(["/top.json", "/data/top.json"], (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 24)));
  const list = _publicList().sort((a,b)=>(b.likes||0)-(a.likes||0)).slice(0,limit);
  res.json({ success:true, list });
});
app.get(["/recent", "/recent.json", "/data/recent.json"], (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 24)));
  const list = _publicList().sort((a,b)=>(b.uploadedAt||0)-(a.uploadedAt||0)).slice(0,limit);
  res.json({ success:true, list });
});
app.get(["/details.json", "/data/details.json"], (req, res) => {
  const { filename } = req.query || {};
  const rec = _publicList().find((r) => r.filename === filename);
  if (!rec) return res.status(404).json({ success:false, error:"not_found" });
  res.json({ success:true, outfit: rec });
});
app.post("/like/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const action = (req.body?.action || "like").toLowerCase();
    const list = loadJson(OUTFITS_JSON);
    const idx = list.findIndex((x) => x.filename === filename);
    if (idx < 0) return res.status(404).json({ success:false, error:"not_found" });
    const cur = Number(list[idx].likes || 0);
    list[idx].likes = action === "unlike" ? Math.max(0, cur - 1) : cur + 1;
    saveJson(OUTFITS_JSON, list);
    res.json({ success:true, likes: list[idx].likes });
  } catch (e) {
    logger.error("like error", e);
    res.status(500).json({ success:false, error:"like_failed" });
  }
});

// ----- front pages (원기능 유지)
const sendPage = (name) => (req,res)=> res.sendFile(path.join(frontendDir, name));
app.get("/", sendPage("index.html"));
app.get("/search", sendPage("search.html"));
app.get("/group", sendPage("group.html"));
app.get("/details", sendPage("details.html"));
app.get("/request", sendPage("request.html"));
app.get("/date", sendPage("date.html"));
app.get("/top", sendPage("top.html"));
app.get("/contact", sendPage("contact.html"));

/* ============================================================
   🔥 자동 아이돌 사진 수집 엔진
   - Google CSE 이미지 검색 기반 (키 없으면 동작 안 함)
   - 결과를 backend/auto_uploads 에 저장
   - auto_outfits.json 에 기록
   - 승인 시 uploads/ 로 이동 + outfitss.json 반영
   ============================================================ */

function todayKR(shiftDays = 0) {
  // Asia/Seoul 기준 YYYY-MM-DD
  const now = new Date();
  const tzOffset = 9 * 60; // minutes
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kr = new Date(utc + tzOffset * 60000 + shiftDays * 86400000);
  const p = (n) => String(n).padStart(2, "0");
  return `${kr.getFullYear()}-${p(kr.getMonth()+1)}-${p(kr.getDate())}`;
}

function extFromUrl(u) {
  try {
    const url = new URL(u);
    const pathname = url.pathname || "";
    const m = pathname.match(/\.(jpg|jpeg|png|gif|webp|bmp|jfif)$/i);
    return m ? m[0] : ".jpg";
  } catch { return ".jpg"; }
}

async function searchImagesCSE(q, n = 4) {
  const { GOOGLE_API_KEY, GOOGLE_CSE_ID } = process.env;
  if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) return [];
  const params = new URLSearchParams({
    key: GOOGLE_API_KEY,
    cx: GOOGLE_CSE_ID,
    q,
    searchType: "image",
    num: String(Math.min(10, Math.max(1, n))),
    safe: "off",
    gl: "kr",
    lr: "lang_ko",
    hl: "ko",
  });
  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
  const r = await fetch(url);
  const d = await r.json().catch(()=> ({}));
  if (!r.ok || !d.items) return [];
  return d.items.map(i => ({
    title: i.title || "",
    link: i.link || "",
    contextLink: i.image?.contextLink || i.displayLink || "",
  })).filter(x => x.link);
}

async function downloadToFile(url, folder) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buff = Buffer.from(await res.arrayBuffer());
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}${extFromUrl(url)}`;
  const fp = path.join(folder, filename);
  fs.writeFileSync(fp, buff);
  return { filename, path: `/auto_uploads/${filename}` };
}

// 기본 키워드 (원하면 env로 대체 가능: COLLECT_GROUPS="아이브,에스파,뉴진스,르세라핌")
function seedGroups() {
  const env = (process.env.COLLECT_GROUPS || "").trim();
  if (env) return env.split(",").map(s=>s.trim()).filter(Boolean);
  return ["아이브", "에스파", "뉴진스", "르세라핌", "아이들", "트와이스", "레드벨벳"];
}

function buildKeywords() {
  const ymd = todayKR(0).replace(/-/g, " ");
  const gs = seedGroups();
  const postfixes = [" 공항 패션", " 사복 패션", " 무대 패션"];
  const keys = [];
  for (const g of gs) {
    for (const p of postfixes) keys.push(`${g} ${ymd}${p}`);
  }
  return keys;
}

app.get("/api/auto-outfits", basicAdminAuth, (req, res) => {
  const list = loadJson(AUTO_OUTFITS_JSON);
  res.json({ success: true, list });
});

app.post("/api/auto-collect", basicAdminAuth, async (req, res) => {
  const out = { success: true, collected: 0, errors: [], keywords: [] };
  try {
    const keywords = Array.isArray(req.body?.keywords) && req.body.keywords.length
      ? req.body.keywords
      : buildKeywords();

    out.keywords = keywords;

    const autoList = loadJson(AUTO_OUTFITS_JSON);
    const linkSeen = new Set(autoList.map(x => x.sourceLink).filter(Boolean));

    for (const q of keywords) {
      try {
        const imgs = await searchImagesCSE(q, 4); // 키가 없으면 [] 반환
        for (const im of imgs) {
          if (!im.link || linkSeen.has(im.link)) continue;
          try {
            const { filename, path: relPath } = await downloadToFile(im.link, autoUploadFolder);
            const rec = {
              filename,
              path: relPath,
              uploadedAt: Date.now(),
              groupName: q.split(" ")[0] || "", // 간이 추정
              name: "",
              date: todayKR(0),
              source: "google_cse",
              keyword: q,
              sourceLink: im.link,
              contextLink: im.contextLink || "",
            };
            autoList.unshift(rec);
            linkSeen.add(im.link);
            out.collected += 1;
          } catch (e) {
            out.errors.push({ q, link: im.link, message: e.message });
          }
        }
      } catch (e) {
        out.errors.push({ q, message: e.message });
      }
    }

    saveJson(AUTO_OUTFITS_JSON, autoList);
    res.json(out);
  } catch (e) {
    logger.error("auto_collect_failed", e);
    res.status(500).json({ success: false, error: "auto_collect_failed", detail: e.message, ...out });
  }
});

app.post("/api/auto-approve/:filename", basicAdminAuth, (req, res) => {
  const { filename } = req.params;
  const autoList = loadJson(AUTO_OUTFITS_JSON);
  const idx = autoList.findIndex(x => x.filename === filename);
  if (idx < 0) return res.status(404).json({ success:false, error:"not_found" });

  const rec = autoList[idx];
  const srcPath = path.join(autoUploadFolder, filename);
  if (!fs.existsSync(srcPath)) return res.status(404).json({ success:false, error:"file_missing" });

  const destFilename = `${Date.now()}${path.extname(filename) || ".jpg"}`;
  const destPath = path.join(uploadFolder, destFilename);
  fs.copyFileSync(srcPath, destPath);

  // 최종 outfitss.json 반영
  const outfits = loadJson(OUTFITS_JSON);
  const finalRec = {
    filename: destFilename,
    path: `/uploads/${destFilename}`,
    uploadedAt: Date.now(),
    groupName: rec.groupName || "",
    name: rec.name || "",
    date: rec.date || todayKR(0),
    items: [],
    likes: 0,
    meta: {
      approvedFrom: "auto",
      keyword: rec.keyword || "",
      sourceLink: rec.sourceLink || "",
      contextLink: rec.contextLink || "",
    }
  };
  outfits.unshift(finalRec);
  saveJson(OUTFITS_JSON, outfits);

  // auto_outfits 에서는 상태 표시만 (또는 삭제)
  autoList[idx].approved = true;
  autoList[idx].approvedAs = destFilename;
  saveJson(AUTO_OUTFITS_JSON, autoList);

  res.json({ success: true, outfit: finalRec });
});

app.delete("/api/auto-delete/:filename", basicAdminAuth, (req, res) => {
  const { filename } = req.params;
  const autoList = loadJson(AUTO_OUTFITS_JSON);
  const idx = autoList.findIndex(x => x.filename === filename);
  if (idx < 0) return res.status(404).json({ success:false, error:"not_found" });

  const fp = path.join(autoUploadFolder, filename);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);

  autoList.splice(idx, 1);
  saveJson(AUTO_OUTFITS_JSON, autoList);
  res.json({ success: true });
});


// ============================================================
// 🪄 자동수집(X) 이미지 관리 API
// ============================================================

const autoUploadXFolder = path.join(backendDir, "auto_uploads_x");
const AUTO_OUTFITS_X_JSON = path.join(backendDir, "auto_outfits_x.json");
ensureJson(AUTO_OUTFITS_X_JSON, []);

// ① 목록 조회
app.get("/auto-outfits-x", basicAdminAuth, (req, res) => {
  try {
    const list = JSON.parse(fs.readFileSync(AUTO_OUTFITS_X_JSON, "utf-8"));
    res.json({ success: true, list });
  } catch (e) {
    logger.error("auto-outfits-x read error", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ② 승인 (uploads로 이동 + outfitss.json 반영)
// ② 승인 (uploads로 이동 + outfitss.json 반영)
app.post("/auto-approve-x/:filename", basicAdminAuth, (req, res) => {
  try {
    const { filename } = req.params;
    const list = JSON.parse(fs.readFileSync(AUTO_OUTFITS_X_JSON, "utf-8"));
    const item = list.find(x => x.filename === filename);
    if (!item) return res.status(404).json({ success: false, error: "not_found" });

    const srcPath = path.join(autoUploadXFolder, filename);
    const destPath = path.join(uploadFolder, filename);
    if (!fs.existsSync(srcPath)) return res.status(404).json({ success: false, error: "file_missing" });

    fs.renameSync(srcPath, destPath);

    const outfits = loadJson(OUTFITS_JSON);
    const record = {
      filename,
      path: `/uploads/${filename}`,
      uploadedAt: Date.now(),
      groupName: item.groupName || "",
      name: item.name || item.meta?.memberName || "",
      date: item.dateRange?.until || item.date || "",
      source: item.source || "twitter",
      items: [],          // ✅ 추가
      likes: 0,
    };
    outfits.unshift(record);
    saveJson(OUTFITS_JSON, outfits);

    const updated = list.filter(x => x.filename !== filename);
    fs.writeFileSync(AUTO_OUTFITS_X_JSON, JSON.stringify(updated, null, 2), "utf-8");

    res.json({ success: true, moved: record });
  } catch (e) {
    logger.error("auto-approve-x error", e);
    res.status(500).json({ success: false, error: e.message });
  }
});


// ③ 삭제
app.delete("/auto-delete-x/:filename", basicAdminAuth, (req, res) => {
  try {
    const { filename } = req.params;
    const list = JSON.parse(fs.readFileSync(AUTO_OUTFITS_X_JSON, "utf-8"));
    const idx = list.findIndex(x => x.filename === filename);
    if (idx < 0) return res.status(404).json({ success: false, error: "not_found" });

    const filePath = path.join(autoUploadXFolder, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    list.splice(idx, 1);
    fs.writeFileSync(AUTO_OUTFITS_X_JSON, JSON.stringify(list, null, 2), "utf-8");

    res.json({ success: true });
  } catch (e) {
    logger.error("auto-delete-x error", e);
    res.status(500).json({ success: false, error: e.message });
  }
});


// ④ 자동 동기화 (폴더 기준으로 JSON 갱신)
// ④ 자동 동기화 (폴더 기준으로 JSON 갱신)



// ④ 자동 동기화 (폴더 기준으로 JSON 갱신)
app.post("/auto-resync-x", basicAdminAuth, (req, res) => {
  try {
    const folder = autoUploadXFolder;
    const files = fs.readdirSync(folder).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
    const existing = loadJson(AUTO_OUTFITS_X_JSON);
    const existingNames = new Set(existing.map(x => x.filename));
    let added = 0;

    for (const filename of files) {
      if (existingNames.has(filename)) continue;
      const stat = fs.statSync(path.join(folder, filename));
      existing.unshift({
        filename,
        path: `/auto_uploads_x/${filename}`,
        uploadedAt: stat.mtimeMs,
        groupName: "",
        source: "twitter",
        date: new Date(stat.mtime).toISOString().split("T")[0]
      });
      added++;
    }

    saveJson(AUTO_OUTFITS_X_JSON, existing);
    res.json({ success: true, added, total: existing.length });
  } catch (e) {
    logger.error("auto-resync-x error", e);
    res.status(500).json({ success: false, error: e.message });
  }
});


// 이미 있는 것들


// ✅ 이 줄이 빠져서 이미지가 안 보인 거였음
app.use("/auto_uploads_x", express.static(path.join(backendDir, "auto_uploads_x")));

app.use("/", express.static(frontendDir));



// ----- 404
app.use((req,res)=> res.status(404).json({ success:false, error:"not_found" }));

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중 → http://localhost:${PORT}`);
  console.log(`🧩 관리자 페이지 → http://localhost:${PORT}/admin`);
});
