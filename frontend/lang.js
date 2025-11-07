// ✅ DolFits 다국어 시스템
document.addEventListener("DOMContentLoaded", () => {
  const userLang = navigator.language || navigator.userLanguage;
  const savedLang = localStorage.getItem("lang") || (userLang.startsWith("ko") ? "ko" : "en");
  let currentLang = savedLang;

  const translations = {
    ko: {
      site_title: "DolFits",
      search_placeholder: "그룹명 또는 이름을 입력하세요",
      top_title: "인기 착장 top12",
      request_title: "착장 업로드 요청",
      date_title: "날짜별 착장",
      group_title: "그룹별 착장",
      contact_title: "문의하기",
      no_results: "해당 착장이 없습니다 😢",
     contact_title: "문의 | DolFits",
    contact_heading: "문의하기",
    contact_info: "문의는 dolfits07@gmail.com 또는 인스타그램 @dolfits_official 로 연락해주세요 💌",
     menu_home: "홈",
    menu_request: "착장 요청",
    menu_date: "날짜별 착장",
    menu_group: "그룹별 착장",
    menu_top: "인기 착장 순위",
    menu_contact: "문의",
    title: "착장 요청 | DolFits",
    uploadTitle: "📮 착장 업로드 요청",
    labelDate: "날짜",
    labelGroup: "그룹명",
    labelName: "이름",
    labelImage: "참고 이미지",
    submitBtn: "요청 보내기",
    select_year: "연도 선택 ▼",
select_month: "월 선택 ▼",
select_day: "일 선택 ▼",
search_btn: "검색",
date_footer: "© 2025 DolFits | 날짜별 착장 아카이브",
date_empty_msg: "🐬 아직 이 날짜의 착장이 없어요. 다른 날짜를 선택해볼까요?",
date_title_full: "📅 날짜별 착장 보기"






    },
    en: {
      site_title: "DolFits",
      search_placeholder: "Enter group name or member name",
      top_title: "Top Outfits Ranking 12",
      request_title: "Upload Outfit Request",
      date_title: "Outfits by Date",
      group_title: "Outfits by Group",
      contact_title: "Contact",
      no_results: "No outfits found 😢",
    contact_title: "Contact | DolFits",
    contact_heading: "Contact Us",
    contact_info: "For inquiries, please reach us at dolfits07@gmail.com or Instagram @dolfits_official 💌",
    menu_home: "Home",
    menu_request: "Outfit Request",
    menu_date: "By Date",
    menu_group: "By Group",
    menu_top: "Top Outfits",
    menu_contact: "Contact",
    title: "Outfit Upload Request | DolFits",
    uploadTitle: "📮 Outfit Upload Request",
    labelDate: "Date",
    labelGroup: "Group Name",
    labelName: "Member Name",
    labelImage: "Reference Image",
    submitBtn: "Submit Request",
    select_year: "Select Year ▼",
select_month: "Select Month ▼",
select_day: "Select Day ▼",
search_btn: "Search",
date_footer: "© 2025 DolFits | Outfit Archive by Date",
date_empty_msg: "🐬 No outfits for this date yet. Try another date?",
date_title_full: "📅 View Outfits by Date"







    }
  };



  // ✅ 번역 적용 함수
  function applyTranslations(lang) {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (translations[lang][key]) {
        el.textContent = translations[lang][key];
      }
    });

    // placeholder용 (input)
    const input = document.querySelector("#keyword");
    if (input) input.placeholder = translations[lang].search_placeholder;

    localStorage.setItem("lang", lang);
    currentLang = lang;
  }

  // ✅ 토글 버튼 추가 (햄버거 옆에)
  const btn = document.createElement("div");
  btn.className = "lang-toggle";
  btn.textContent = currentLang === "ko" ? "EN" : "KO";
  btn.addEventListener("click", () => {
    const newLang = currentLang === "ko" ? "en" : "ko";
    btn.textContent = newLang === "ko" ? "EN" : "KO";
    applyTranslations(newLang);
  });
  document.body.appendChild(btn);

  // 초기 번역 실행
  applyTranslations(currentLang);
});






