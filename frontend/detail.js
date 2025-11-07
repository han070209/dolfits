document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const file = params.get("file");
  if (!file) return;

  try {
    const res = await fetch(`/data/outfitss.json?t=${Date.now()}`);
    const data = await res.json();
    const fit = data.find(f => f.filename === file);
    if (!fit) return;

    // ✅ 화면에 표시할 부분
    document.body.innerHTML += `
      <div class="detail-box">
        <img src="/uploads/${encodeURIComponent(fit.filename)}" class="fit-image" />
        <div class="fit-info">
          <h2>${fit.groupName || "그룹 없음"} - ${fit.name || "이름 없음"}</h2>
          <p>날짜: ${fit.date || "정보 없음"}</p>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("❌ detail 로드 오류:", err);
  }
});


