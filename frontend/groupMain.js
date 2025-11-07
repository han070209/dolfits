document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("groupContainer");

  try {
    const res = await fetch(`/data/outfitss.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("outfitss.json 로드 실패");
    const data = await res.json();

    // ✅ 그룹별로 묶기
    const grouped = {};
    data.forEach(f => {
      const group = f.groupName || "기타";
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(f);
    });

    // ✅ 그룹별 섹션 만들기
    Object.entries(grouped).forEach(([groupName, outfits]) => {
      const section = document.createElement("div");
      section.className = "group-section";

      const header = document.createElement("div");
      header.className = "group-header";
      header.textContent = `${groupName} (${outfits.length})`;

      const list = document.createElement("div");
      list.className = "group-list";
      list.style.display = "none"; // 처음엔 숨김

      // ✅ 착장 이미지 박스 구성
      outfits.forEach(f => {
        const box = document.createElement("div");
        box.className = "fit-box";

        const img = document.createElement("img");
        img.src = `/uploads/${encodeURIComponent(f.filename)}?v=${Date.now()}`;
        img.alt = f.originalname || "fit";

        const info = document.createElement("div");
        info.className = "fit-info";
        info.textContent = `${f.name || ""}`;

        box.appendChild(img);
        box.appendChild(info);
        list.appendChild(box);
      });

      // ✅ 클릭 시 펼치기 / 접기
      header.addEventListener("click", () => {
        const isOpen = list.style.display === "grid";
        document.querySelectorAll(".group-list").forEach(l => (l.style.display = "none")); // 다른 그룹 닫기
        list.style.display = isOpen ? "none" : "grid";
      });

      section.appendChild(header);
      section.appendChild(list);
      container.appendChild(section);
    });
  } catch (err) {
    console.error("❌ 그룹별 로드 오류:", err);
  }
});
