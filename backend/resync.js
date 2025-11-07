// backend/resync.js
import fs from "fs";
import path from "path";

const folder = path.join("backend", "auto_uploads_x");
const jsonFile = path.join("backend", "auto_outfits_x.json");

const files = fs.readdirSync(folder).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));

const list = files.map(f => ({
  filename: f,
  path: `/auto_uploads_x/${f}`,
  uploadedAt: Date.now(),
  groupName: "",
  source: "twitter",
  date: new Date().toISOString().split("T")[0],
}));

fs.writeFileSync(jsonFile, JSON.stringify(list, null, 2), "utf-8");
console.log(`✅ ${list.length}개 이미지 정보를 ${jsonFile}에 저장했습니다.`);

