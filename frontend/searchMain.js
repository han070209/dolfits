document.addEventListener("DOMContentLoaded", async () => {
  const input = document.getElementById("keyword");
  const suggestBox = document.getElementById("suggestList");
  const searchResults = document.getElementById("searchResults");
  const mainFits = document.getElementById("mainFits");

  // ✅ outfitss.json 불러오기
  let allFits = [];
  try {
    const res = await fetch(`/data/outfitss.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("outfitss.json 로드 실패");
    allFits = await res.json();
  } catch (err) {
    console.error("❌ JSON 로드 오류:", err);
  }

  const normalize = str => str ? str.toLowerCase().replace(/\s+/g, "") : "";

  // ✅ 자동완성
 function showSuggestions(value) {
  if (!value.trim()) {
    suggestBox.style.display = "none";
    return;
  }

  const key = normalize(value);
  const filtered = allFits.filter(f =>
    normalize(f.groupName).includes(key) || normalize(f.name).includes(key)
  );

  // ✅ 중복 제거
  const unique = [];
  const seen = new Set();
  for (const f of filtered) {
    const key = `${f.groupName || ""}-${f.name || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(f);
    }
  }

  suggestBox.innerHTML = "";
  if (unique.length === 0) {
    suggestBox.style.display = "none";
    return;
  }

  // ✅ 최대 10개까지만 표시
  unique.slice(0, 10).forEach(f => {
    const li = document.createElement("li");
    li.textContent = `${f.groupName || ""} ${f.name || ""}`.trim();
    li.addEventListener("click", () => {
  input.value = li.textContent;
  suggestBox.style.display = "none";

  // ✅ 그룹명과 이름을 정확히 분리해서 검색
  const [group, name] = li.textContent.split(" ").filter(Boolean);
  const keyword = `${group || ""}${name || ""}`.trim();

  showSearchResults(keyword);
});

    suggestBox.appendChild(li);
  });
  suggestBox.style.display = "block";
}

  // ✅ 검색 결과 표시 + 좋아요
 function showSearchResults(keyword) {
  if (!searchResults || !mainFits) return;

  mainFits.style.display = "none";
  searchResults.style.display = "grid";
  searchResults.innerHTML = "";

  const key = normalize(keyword);

  // ✅ 그룹명 + 이름 전체에서 검색 (포함만 되어도 매칭)
  const results = allFits.filter(f => {
    const full = normalize(`${f.groupName} ${f.name}`);
    return full.includes(key);
  });

  if (results.length === 0) {
    searchResults.innerHTML = `<p style="font-size:18px; color:#666;">해당 착장이 없습니다 😢</p>`;
    return;
  }

  results.forEach(f => {
    const box = document.createElement("div");
    box.className = "fit-box";

    const img = document.createElement("img");
    img.src = `/uploads/${encodeURIComponent(f.filename)}?v=${Date.now()}`;
    img.alt = f.originalname || "fit image";

    img.addEventListener("click", () => {
      window.location.href = `/detail.html?file=${encodeURIComponent(f.filename)}`;
    });

    const info = document.createElement("div");
    info.className = "fit-info";

    const label = document.createElement("span");
    label.textContent = `${f.groupName || '그룹 없음'} · ${f.name || '이름 없음'}`;

    const heart = document.createElement("span");
    heart.className = "heart";
    heart.innerHTML = '♡';

    const count = document.createElement("span");
    count.className = "like-count";
    count.textContent = f.likes > 0 ? ` ${f.likes}` : '';

    // ✅ 좋아요 로직 동일 유지
    const likeKey = `liked_${f.filename}`;
    const isLiked = localStorage.getItem(likeKey) === 'true';
    if (isLiked) {
      heart.classList.add('active');
      heart.innerHTML = '❤️';
    }

    heart.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const nowLiked = heart.classList.toggle('active');
        heart.innerHTML = nowLiked ? '❤️' : '♡';
        heart.classList.add('pop');
        localStorage.setItem(likeKey, nowLiked);

        const res = await fetch(`/like/${encodeURIComponent(f.filename)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: nowLiked ? "like" : "unlike" }),
        });
        const data = await res.json();
        count.textContent = data.likes > 0 ? ` ${data.likes}` : '';

        setTimeout(() => heart.classList.remove('pop'), 300);
      } catch (err) {
        console.error("❌ 좋아요 처리 오류:", err);
      }
    });

    info.appendChild(label);
    info.appendChild(heart);
    info.appendChild(count);
    box.appendChild(img);
    box.appendChild(info);
    searchResults.appendChild(box);
  });
}


  // ✅ 이벤트 연결
  input.addEventListener("input", e => showSuggestions(e.target.value));
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      showSearchResults(input.value);
      suggestBox.style.display = "none";
    }
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#searchBar")) suggestBox.style.display = "none";
  });
});
