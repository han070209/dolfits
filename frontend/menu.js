// frontend/menu.js
document.addEventListener("DOMContentLoaded", () => {
  const menuHTML = `
    <div class="menu-btn">☰</div>
   <div class="side-menu">
   <ul>
    <li><a href="/" data-i18n="menu_home">홈</a></li>
    <li><a href="/request" data-i18n="menu_request">착장 요청</a></li>
    <li><a href="/date" data-i18n="menu_date">날짜별 착장</a></li>
    <li><a href="/group" data-i18n="menu_group">그룹별 착장</a></li>
    <li><a href="/top" data-i18n="menu_top">인기 착장 순위</a></li>
    <li><a href="/contact" data-i18n="menu_contact">문의</a></li>
  </ul>
</div>

  `;

  // ✅ body 맨 위에 메뉴 삽입
  document.body.insertAdjacentHTML("afterbegin", menuHTML);

  const menuBtn = document.querySelector(".menu-btn");
  const sideMenu = document.querySelector(".side-menu");

  if (!menuBtn || !sideMenu) return;






 menuBtn.addEventListener("mouseenter", () => {
    sideMenu.classList.add("active");
  });

  // ✅ 메뉴에 마우스 유지 중이면 계속 열려있기
  sideMenu.addEventListener("mouseenter", () => {
    sideMenu.classList.add("active");
  });

  // ✅ 메뉴에서 마우스가 벗어나면 닫힘
  sideMenu.addEventListener("mouseleave", () => {
    sideMenu.classList.remove("active");
  });


  // ✅ 클릭할 때마다 열고 닫기 (토글)
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sideMenu.classList.toggle("active");
  });

  // ✅ 메뉴 안쪽 링크 클릭 시 자동 닫기
  sideMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      sideMenu.classList.remove("active");
    });
  });

  // ✅ 메뉴 외부 클릭 시 닫기
  document.addEventListener("click", (e) => {
    if (
      !sideMenu.contains(e.target) &&
      !menuBtn.contains(e.target)
    ) {
      sideMenu.classList.remove("active");
    }
  });
});

// ✅ DolFits 로고 클릭 시 홈으로 이동
document.addEventListener("DOMContentLoaded", () => {
  const logo = document.querySelector(".logo");
  if (logo) {
    logo.style.cursor = "pointer";
    logo.addEventListener("click", () => {
      window.location.href = "/";
    });
  }
});
