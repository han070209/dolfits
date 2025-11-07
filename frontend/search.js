// frontend/search.js
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("keyword");
  const btn = document.getElementById("searchBtn");
  const suggestBox = document.getElementById("suggestList");
  const results = document.getElementById("searchResults");

  // 페이지에 해당 요소들이 없으면 종료 (다른 페이지에서 에러 방지)
  if (!input || !btn || !suggestBox) return;

  let allKeywords = [];
  let cachedData = [];
  let cursor = -1; // 키보드 이동용 인덱스

  // outfitss.json 로드 (키워드/데이터 캐시)
  (async function init() {
    const res = await fetch(`/data/outfitss.json?t=${Date.now()}`, { cache: "no-store" });
    cachedData = await res.json();

    const groups = [...new Set(cachedData.map(f => f.groupName).filter(Boolean))];
    const names  = [...new Set(cachedData.map(f => f.name).filter(Boolean))];

    allKeywords = [...new Set([...groups, ...names])];
  })().catch(console.error);

  // 자동완성 렌더
  function renderSuggest(list) {
    suggestBox.innerHTML = "";
    cursor = -1;
    if (!list.length) {
      suggestBox.style.display = "none";
      return;
    }
    list.slice(0, 8).forEach(text => {
      const li = document.createElement("li");
      li.textContent = text;
      li.addEventListener("mousedown", (e) => {
        // mousedown 단계에서 값 확정 (blur 전에)
        e.preventDefault();
        input.value = text;
        suggestBox.style.display = "none";
        doSearch();
      });
      suggestBox.appendChild(li);
    });
    suggestBox.style.display = "block";
  }

  // 입력 시 자동완성
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      suggestBox.style.display = "none";
      return;
    }
    const matches = allKeywords.filter(k => k.toLowerCase().includes(q));
    renderSuggest(matches);
  });

  // 포커스 아웃 시 닫기 (리스트 클릭은 mousedown에서 처리)
  input.addEventListener("blur", () => {
    setTimeout(() => (suggestBox.style.display = "none"), 100);
  });

  // 버튼 클릭 → 검색
  btn.addEventListener("click", () => doSearch());

  // 엔터/방향키 처리
  input.addEventListener("keydown", (e) => {
    const visible = suggestBox.style.display === "block";
    const items = Array.from(suggestBox.querySelectorAll("li"));

    if (e.key === "Enter") {
      if (visible && cursor >= 0 && items[cursor]) {
        input.value = items[cursor].textContent;
        suggestBox.style.display = "none";
      }
      doSearch();
      return;
    }

    if (!visible || !items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      cursor = (cursor + 1) % items.length;
      updateActive(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      cursor = (cursor - 1 + items.length) % items.length;
      updateActive(items);
    }
  });

  function updateActive(items) {
    items.forEach((li, i) => li.classList.toggle("active", i === cursor));
  }

  // 검색 실행 (결과를 메인 그리드로 표시하거나 별도 results에 표출)
  function doSearch() {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      // 검색어 비었으면 결과 숨김
      if (results) results.style.display = "none";
      return;
    }

    const matches = cachedData.filter(f => {
      const g = (f.groupName || "").toLowerCase();
      const n = (f.name || "").toLowerCase();
      return g.includes(q) || n.includes(q);
    });

    if (!results) return; // 결과 컨테이너 없으면 종료

    results.innerHTML = "";
    results.style.display = "grid";

    if (!matches.length) {
      results.innerHTML = `<p style="color:#555;">검색 결과가 없습니다.</p>`;
      return;
    }

    matches.forEach(f => {
      const box = document.createElement("div");
      box.className = "fit-box";

      const img = document.createElement("img");
      img.src = `/uploads/${encodeURIComponent(f.filename)}?v=${Date.now()}`;
      img.alt = f.originalname || "";
      box.appendChild(img);

      const info = document.createElement("div");
      info.className = "fit-info";
      info.textContent = `${f.groupName || "그룹"} · ${f.name || "이름"} (${(f.date || "").slice(0,10)})`;
      box.appendChild(info);

      results.appendChild(box);
    });
  }
});
