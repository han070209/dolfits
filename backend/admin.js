// DolFits 관리자 페이지 통합본 (검색 + 수정 + 링크관리 + 메타저장 유지)

async function fetchAdmin(url, init = {}) {
  const headers = new Headers(init.headers || {});
  const tok = sessionStorage.getItem("df_admin_auth");
  if (tok) headers.set("Authorization", `Basic ${tok}`);

  // 1차 시도
  let res = await fetch(url, { ...init, headers });

  // 401이면 그때 딱 한 번만 로그인 받고 재시도
  if (res.status === 401) {
    const u = prompt("Admin ID", "");
    const p = prompt("Admin PW", "");
    if (u == null || p == null) throw new Error("auth canceled");
    const newTok = btoa(`${u}:${p}`);
    sessionStorage.setItem("df_admin_auth", newTok);

    headers.set("Authorization", `Basic ${newTok}`);
    res = await fetch(url, { ...init, headers });
  }
  return res;
}

// ============================
// 🔐 관리자 인증 (Basic Auth)
// ============================
function askAuthOnce() {
  if (!sessionStorage.getItem("df_admin_auth")) {
    const u = prompt("Admin ID", "");
    const p = prompt("Admin PW", "");
    if (u == null || p == null) throw new Error("auth canceled");
    sessionStorage.setItem("df_admin_auth", btoa(`${u}:${p}`));
  }
}

function H(extra = {}) {
  if (!sessionStorage.getItem("df_admin_auth")) askAuthOnce();
  return { Authorization: `Basic ${sessionStorage.getItem("df_admin_auth")}`, ...extra };
}


async function fetchAuth(url, init = {}) {
  const headers = init.headers instanceof Headers ? init.headers : { ...(init.headers || {}), ...H() };
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    sessionStorage.removeItem("df_admin_auth");
    throw new Error("auth failed");
  }
  return res;
}


function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function fmt(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ------------------ 업로드 목록 --------------------
async function loadList() {
  const box = document.getElementById("listBox");
  if (!box) return;
  box.innerHTML = "⏳ 불러오는 중…";

  try {
    const r = await fetchAuth("/outfits");
    const d = await r.json();
    if (!d.success) throw new Error("목록 불러오기 실패");

    const list = d.outfits || [];
    if (!list.length) {
      box.textContent = "목록 없음";
      return;
    }

    box.innerHTML = "";
    list.forEach((x) => {
      const card = el(`
        <div class="card" style="margin-bottom:10px;padding:8px;border:1px solid #ddd;border-radius:6px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${x.path}" class="thumb" style="width:70px;height:70px;object-fit:cover;border-radius:6px;">
            <div style="flex:1;">
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">
                <input value="${x.groupName || ""}" placeholder="그룹명" data-f="${x.filename}" data-k="groupName" style="width:120px;padding:6px;">
                <input value="${x.name || ""}" placeholder="이름" data-f="${x.filename}" data-k="memberName" style="width:120px;padding:6px;">
                <input type="date" value="${(x.date || "").slice(0, 10)}" data-f="${x.filename}" data-k="date" style="padding:6px;">
                <div style="font-size:12px;color:#666;">업로드: ${fmt(x.uploadedAt)} | ♥ ${x.likes || 0}</div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button data-act="save-meta" data-f="${x.filename}">메타 저장</button>
                <button data-act="delete" data-f="${x.filename}" style="background:#b00020;border-color:#b00020;">삭제</button>
                <button data-act="links" data-f="${x.filename}" style="background:#333;border-color:#333;">▼ 링크 보기</button>
              </div>
              <div id="links-${x.filename}" class="link-body" style="display:none;margin-top:10px;">
                <table class="link-table" style="width:100%;border-collapse:collapse;">
                  <tbody>
                    ${(x.items || [])
                      .map(
                        (i) => `
                        <tr>
                          <td><input type="text" value="${i.name || ""}" placeholder="상품명" style="width:100%;padding:4px;"></td>
                          <td><input type="text" value="${i.url || ""}" placeholder="URL" style="width:100%;padding:4px;"></td>
                          <td><button class="delete-row" style="background:#b00020;color:#fff;">삭제</button></td>
                        </tr>`
                      )
                      .join("")}
                  </tbody>
                </table>
                <div style="margin-top:6px;display:flex;gap:6px;">
                  <button class="add-link">＋ 링크 추가</button>
                  <button class="save-link" data-f="${x.filename}" style="background:#007bff;">💾 저장</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);
      box.appendChild(card);
    });

    bindListEvents();
  } catch (e) {
    console.error(e);
    box.textContent = "❌ 불러오기 실패";
  }
}

function bindListEvents() {
  const box = document.getElementById("listBox");
  if (!box) return;

  // 삭제
  box.querySelectorAll("button[data-act='delete']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const f = btn.getAttribute("data-f");
      if (!confirm("정말 삭제할까요?")) return;
      const r = await fetchAuth(`/delete-outfit/${encodeURIComponent(f)}`, { method: "DELETE" });
      const j = await r.json();
      if (!j.success) return alert("삭제 실패");
      loadList();
    });
  });

  // 메타 저장
  box.querySelectorAll("button[data-act='save-meta']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const f = btn.getAttribute("data-f");
      const inputs = box.querySelectorAll(`input[data-f='${CSS.escape(f)}']`);
      const meta = {};
      inputs.forEach((inp) => (meta[inp.getAttribute("data-k")] = inp.value || ""));
      const r = await fetchAuth(`/update-outfit/${encodeURIComponent(f)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta }),
      });
      const j = await r.json();
      if (!j.success) return alert("메타 저장 실패");
      alert("✅ 저장 완료");
      loadList();
    });
  });

  // 링크 보기/숨기기
  box.querySelectorAll("button[data-act='links']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const f = btn.getAttribute("data-f");
      const target = document.getElementById(`links-${f}`);
      if (!target) return;
      if (target.style.display === "block") {
        target.style.display = "none";
        btn.textContent = "▼ 링크 보기";
      } else {
        target.style.display = "block";
        btn.textContent = "▲ 링크 접기";
      }
    });
  });

  // 링크 추가 / 삭제 / 저장
  box.querySelectorAll(".add-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const table = btn.closest(".link-body").querySelector("tbody");
      const row = el(`
        <tr>
          <td><input type="text" placeholder="상품명" style="width:100%;padding:4px;"></td>
          <td><input type="text" placeholder="URL" style="width:100%;padding:4px;"></td>
          <td><button class="delete-row" style="background:#b00020;color:#fff;">삭제</button></td>
        </tr>
      `);
      table.appendChild(row);
    });
  });

  box.querySelectorAll(".link-body").forEach((body) => {
    body.addEventListener("click", async (e) => {
      if (e.target.classList.contains("delete-row")) {
        e.target.closest("tr").remove();
      }
      if (e.target.classList.contains("save-link")) {
        const f = e.target.getAttribute("data-f");
        const rows = body.querySelectorAll("tbody tr");
        const items = [];
        rows.forEach((tr) => {
          const [name, url] = [...tr.querySelectorAll("input")].map((i) => i.value.trim());
          if (name && url) items.push({ name, url });
        });
        const r = await fetchAuth(`/update-outfit/${f}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        const j = await r.json();
        if (j.success) alert("✅ 링크 저장 완료");
        else alert("❌ 링크 저장 실패");
      }
    });
  });
}




// =======================
// 🔍 검색 기능 복원
// =======================
// =======================
// 🔍 검색 기능 (유지)
// =======================
// =======================
// 🔍 검색 기능 (유지)
// =======================
function setupSearch() {
  const input = document.getElementById("searchInput");
  const clearBtn = document.getElementById("searchClear");
  const listBox = document.getElementById("listBox");
  if (!input || !listBox) return;

  input.addEventListener("input", () => {
    const term = input.value.trim().toLowerCase();
    const cards = listBox.querySelectorAll(".outfit-card");
    cards.forEach((card) => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(term) ? "" : "none";
    });
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    input.dispatchEvent(new Event("input"));
  });
}

// =======================
// 📦 업로드 목록 + 링크 관리 복구
// =======================
async function loadOutfits() {
  const res = await fetchAuth("/outfits");
  const data = await res.json();
  if (!data.success) return alert("로드 실패");

  const listBox = document.getElementById("listBox");
  listBox.innerHTML = "";

  data.outfits.forEach((fit) => {
    const card = document.createElement("div");
    card.className = "outfit-card";

    // 헤더
    const header = document.createElement("div");
    header.className = "outfit-header";

    const img = document.createElement("img");
    img.src = fit.path;
    img.className = "thumb";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `
      <b>${fit.groupName || "그룹 없음"} · ${fit.name || "이름 없음"}</b>
      <br><small>${fit.date || ""}</small>
    `;

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "▼";
    toggleBtn.className = "toggle";

    header.append(img, meta, toggleBtn);

    // 바디 (접힘)
    const body = document.createElement("div");
    body.className = "outfit-body hidden";

    // 메타 수정 칸
    const metaEdit = document.createElement("div");
    metaEdit.style.marginBottom = "8px";
    metaEdit.innerHTML = `
      <label>그룹명: <input type="text" value="${fit.groupName || ""}" data-f="${fit.filename}" data-k="groupName"></label>
      <label>이름: <input type="text" value="${fit.name || ""}" data-f="${fit.filename}" data-k="memberName"></label>
      <label>날짜: <input type="date" value="${(fit.date || "").slice(0, 10)}" data-f="${fit.filename}" data-k="date"></label>
      <button class="save-meta" data-f="${fit.filename}">메타 저장</button>
    `;

    // 링크 테이블
    const table = document.createElement("table");
    table.className = "link-table";

    (fit.items || []).forEach((it) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input type="text" value="${it.name || ""}" placeholder="상품명"></td>
        <td><input type="text" value="${it.url || ""}" placeholder="URL"></td>
        <td><button class="delete-row">삭제</button></td>
      `;
      table.appendChild(row);
    });

    const addBtn = document.createElement("button");
    addBtn.textContent = "＋ 링크 추가";
    addBtn.className = "add-link";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "💾 저장";
   

const delBtn = document.createElement("button");
delBtn.textContent = "🗑️ 삭제";
delBtn.className = "delete-btn";
body.appendChild(delBtn);

delBtn.addEventListener("click", async () => {
  if (!confirm("정말 삭제할까요?")) return;
  const res = await fetchAdmin(`/delete-outfit/${fit.filename}`, { method: "DELETE" });
  const r = await res.json();
  if (r.success) card.remove();
  else alert("❌ 삭제 실패");
});


    body.append(metaEdit, addBtn, table, saveBtn, delBtn);
    card.append(header, body);
    listBox.appendChild(card);

    // 이벤트들
    toggleBtn.addEventListener("click", () => {
      body.classList.toggle("hidden");
      toggleBtn.textContent = body.classList.contains("hidden") ? "▼" : "▲";
    });

    addBtn.addEventListener("click", () => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input type="text" placeholder="상품명"></td>
        <td><input type="text" placeholder="URL"></td>
        <td><button class="delete-row">삭제</button></td>
      `;
      table.appendChild(row);
    });

    table.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-row")) {
        e.target.closest("tr").remove();
      }
    });

    saveBtn.addEventListener("click", async () => {
      const items = [];
      table.querySelectorAll("tr").forEach((tr) => {
        const [name, url] = [...tr.querySelectorAll("input")].map(i => i.value.trim());
        if (name && url) items.push({ name, url });
      });

      const res = await fetchAuth(`/update-outfit/${fit.filename}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const result = await res.json();
      if (result.success) alert("✅ 저장 완료");
      else alert("❌ 저장 실패");
    });

    delBtn.addEventListener("click", async () => {
      if (!confirm("정말 삭제할까요?")) return;
      const res = await fetchAuth(`/delete-outfit/${fit.filename}`, { method: "DELETE" });
      const r = await res.json();
      if (r.success) card.remove();
    });

    metaEdit.querySelector(".save-meta").addEventListener("click", async (e) => {
      const f = e.target.getAttribute("data-f");
      const inputs = metaEdit.querySelectorAll(`input[data-f='${CSS.escape(f)}']`);
      const meta = {};
      inputs.forEach(inp => meta[inp.getAttribute("data-k")] = inp.value || "");
      const r = await fetch(`/update-outfit/${encodeURIComponent(f)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: fit.items, meta }),
      });
      const j = await r.json();
      if (!j.success) return alert("메타 저장 실패");
      alert("메타 저장 완료");
      loadOutfits();
    });
  });

  setupSearch();
}

document.addEventListener("DOMContentLoaded", loadOutfits);
