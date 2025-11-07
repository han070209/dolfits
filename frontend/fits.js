(async function loadFits() {
  try {
    const res = await fetch(`/data/outfitss.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('outfitss.json 로드 실패');
    const data = await res.json();

    const boxes = document.querySelectorAll('.fit-box');
    if (!boxes.length || !data.length) return;

    // 최근 12개 중 랜덤 6개 추출
    // ✅ 최신순 정렬 후 랜덤 6개 추출
const sorted = [...data].sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
const shuffled = sorted
  .slice(0, 12) // 최신 12개
  .sort(() => Math.random() - 0.5)
  .slice(0, boxes.length);


    // ✅ 좋아요 상태 통합 관리용
    function getLikedSet() {
      try { return new Set(JSON.parse(localStorage.getItem("df_liked_set") || "[]")); }
      catch { return new Set(); }
    }
    function saveLikedSet(set) {
      localStorage.setItem("df_liked_set", JSON.stringify([...set]));
    }

    const likedSet = getLikedSet();

    boxes.forEach((box, i) => {
      const f = shuffled[i];
      if (!f) return;

      const img = document.createElement('img');
      img.src = `/uploads/${encodeURIComponent(f.filename)}?v=${Date.now()}`;
      img.alt = f.originalname || "fit image";

      const info = document.createElement('div');
      info.className = 'fit-info';

      // ✅ 그룹명 · 이름
      const label = document.createElement('span');
      label.textContent = `${f.groupName || '그룹명 없음'} · ${f.name || '이름 없음'}`;

      // ✅ 하트 + 좋아요 수
      const heart = document.createElement('span');
      heart.className = 'heart';
      heart.innerHTML = likedSet.has(f.filename) ? '❤️' : '♡';
      if (likedSet.has(f.filename)) heart.classList.add('active');

      const count = document.createElement('span');
      count.className = 'like-count';
      count.textContent = f.likes > 0 ? ` ${f.likes}` : '';

      // ✅ 하트 클릭
      heart.addEventListener('click', async (e) => {
        e.stopPropagation(); // 상세 이동 방지
        try {
          const nowLiked = !likedSet.has(f.filename);
          heart.innerHTML = nowLiked ? '❤️' : '♡';
          heart.classList.toggle('active', nowLiked);
          heart.classList.add('pop');

          if (nowLiked) likedSet.add(f.filename);
          else likedSet.delete(f.filename);
          saveLikedSet(likedSet);

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

      // ✅ 상세 페이지 이동
      box.addEventListener('click', () => {
        window.location.href = `/detail.html?file=${encodeURIComponent(f.filename)}`;
      });

      // ✅ 구성 정리
      info.appendChild(label);
      info.appendChild(heart);
      info.appendChild(count);

      box.innerHTML = '';
      box.appendChild(img);
      box.appendChild(info);
    });
  } catch (err) {
    console.error('❌ 이미지 로드 오류:', err);
  }
})();
