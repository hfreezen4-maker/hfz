// =========================================================
// "상식 퀴즈" 방에서 사용하는 문제 목록입니다. (일반 상식)
// 고등학교 정보 교과 문제는 quiz-questions.js 에 따로 있습니다.
//
// 이 파일만 수정하면 문제를 자유롭게 바꿀 수 있습니다.
// - question : 화면에 보여줄 문제
// - answer   : 참가자가 정확히 입력해야 하는 정답
//   (앞뒤 공백은 자동으로 무시되고, 대소문자는 구분하지 않습니다)
// =========================================================

const COMMON_QUIZ_QUESTIONS = [
  { question: "대한민국의 수도는?", answer: "서울" },
  { question: "세계에서 가장 높은 산은?", answer: "에베레스트" },
  { question: "물의 화학 기호는?", answer: "H2O" },
  { question: "1년은 총 몇 일일까요? (평년 기준, 숫자만)", answer: "365" },
  { question: "태양계에서 가장 큰 행성은?", answer: "목성" },
  { question: "피자의 원산지 국가는?", answer: "이탈리아" },
  { question: "인체에서 가장 큰 장기는?", answer: "피부" },
  { question: "세계에서 가장 긴 강은?", answer: "나일강" },
  { question: "축구 한 팀의 필드 플레이어 수(골키퍼 제외, 숫자만)는?", answer: "10" },
  { question: "우리나라 화폐 단위는?", answer: "원" },
  { question: "빛의 삼원색이 아닌 것: 빨강, 초록, 파랑, 노랑 중 정답은?", answer: "노랑" },
  { question: "대한민국의 국화(나라꽃)는?", answer: "무궁화" },
  { question: "지구에서 가장 가까운 별은?", answer: "태양" },
  { question: "커피의 주요 성분 중 각성 효과를 내는 물질은?", answer: "카페인" },
  { question: "대한민국의 표준시는 UTC+몇? (숫자만)", answer: "9" },
  { question: "세계에서 가장 작은 대륙은?", answer: "오세아니아" },
  { question: "무지개의 색깔은 총 몇 가지? (숫자만)", answer: "7" },
  { question: "김치의 주요 재료 중 하나는?", answer: "배추" },
  { question: "물이 어는 온도는 섭씨 몇 도? (숫자만)", answer: "0" },
  { question: "1더하기1은? (숫자만)", answer: "2" },
  { question: "정해원의 뜻은?", answer: "정보해원" },
  { question: "1반 담임인 국어쌤 이름은?", answer: "유혜진" },
  { question: "2반 담임인 음악쌤 이름은?", answer: "이이슬" },
  { question: "3반 담임인 정보쌤 이름은?", answer: "박건우" },
  { question: "4반 담임인 한국사쌤 이름은?", answer: "정승호" },
  { question: "5반 담임인 사회쌤 이름은?", answer: "정운자" },
  { question: "6반 담임인 과학쌤 이름은?", answer: "김성" },
  { question: "7반 담임인 영어쌤 이름은?", answer: "안성실" },
  { question: "8반 담임인 지리쌤 이름은?", answer: "김이식" },
  { question: "9반 담임인 국어쌤 이름은?", answer: "김관희" },
  { question: "10반 담임인 체육쌤 이름은?", answer: "오상록" },
  { question: "1학년 부장인 수학쌤 이름은?", answer: "권량희" },  
  { question: "교장선생님 성함은?", answer: "박성우" },
  { question: "교감선생님 성함은?", answer: "김효식" },
  { question: "해원고등학교 개교 연도는?", answer: "2013" },
  { question: "해원고등학교 교목은?", answer: "미선나무" },
  { question: "고교학점제란 학생이 자신의 진로와 적성에 따라 필요한 과목을 선택하여 이수하는 제도이다. 이때 학생이 선택하여 듣는 과목을 무엇이라 하는가?", answer: "선택과목" },
  { question: "고교학점제에서 학생이 과목을 이수하기 위해 필요한 최소 성취 기준에 도달했는지 확인하는 것을 무엇이라 하는가?", answer: "성취평가" },
  { question: "고교학점제에서 학생이 졸업하기 위해 필요한 총 학점은 몇 학점인가?", answer: "192" },
  { question: "고교학점제는 학생의 무엇을 중심으로 교육과정을 운영하기 위해 도입되었는가?", answer: "진로" },
  { question: "고교학점제에서 학생이 원하는 과목을 선택할 수 있도록 안내하고 상담하는 활동을 무엇이라 하는가?", answer: "진로상담" },
  { question: "고교학점제에서 학생들이 선택한 과목을 운영하기 위해 여러 학교가 함께 교육과정을 구성하는 것을 무엇이라 하는가?", answer: "꿈두레" },
  { question: "고교학점제에서 학생이 자신의 학습 계획을 세우고 관리하는 능력을 무엇이라 하는가?", answer: "자기주도학습" },
  { question: "고교학점제의 목적은 학생의 진로와 (   )을 존중하는 교육을 실현하는 것이다.", answer: "적성" },
  { question: "진로에 맞춰 과목을 선택하는 제도는?", answer: "고교학점제" },
  { question: "고교학점제는 몇 년부터 전면 시행되었는가?", answer: "2025년" }
];

module.exports = { COMMON_QUIZ_QUESTIONS };
