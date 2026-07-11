// =========================================================
// "정보 퀴즈" 방에서 사용하는 문제 목록입니다.
// 고등학교 정보(컴퓨팅시스템 / 데이터 / 네트워크 / 알고리즘 / 파이썬 제어구조 / 디지털윤리)
// 6개 영역에서 골고루 출제되도록 만들었습니다.
//
// 이 파일만 수정하면 문제를 자유롭게 바꿀 수 있습니다.
// - category  : 영역 구분용 (게임 로직에는 영향 없음, 정리용)
// - question  : 화면에 보여줄 문제
// - answer    : 참가자가 정확히 입력해야 하는 정답
//   (앞뒤 공백은 자동으로 무시되고, 대소문자는 구분하지 않습니다)
//
// 문제 개수는 배열 길이에 따라 자동으로 라운드 수가 정해집니다 (지금은 48문제 = 48라운드).
// =========================================================

const QUIZ_QUESTIONS = [
  // ---- 컴퓨팅시스템 ----
  { category: "컴퓨팅시스템", question: "컴퓨터의 두뇌 역할을 하는 핵심 장치는?", answer: "CPU" },
  { category: "컴퓨팅시스템", question: "전원이 꺼지면 저장된 내용이 사라지는 휘발성 메모리는?", answer: "RAM" },
  { category: "컴퓨팅시스템", question: "프로그램 실행 결과를 사람이 볼 수 있게 나타내는 장치는?", answer: "출력장치" },
  { category: "컴퓨팅시스템", question: "컴퓨터 내부에서 0과 1로만 표현하는 수 체계는?", answer: "이진수" },
  { category: "컴퓨팅시스템", question: "하드웨어를 관리하고 사용자와 컴퓨터를 연결해주는 대표적인 소프트웨어(MS)는?", answer: "윈도우" },
  { category: "컴퓨팅시스템", question: "외부 네트워크와 내부 네트워크를 연결해주는 장치는?", answer: "라우터" },

  // ---- 데이터 ----
  { category: "데이터", question: "여러 데이터를 표와 표 사이의 관계로 저장·관리하는 데이터의 구조는?", answer: "정형데이터" },
  { category: "데이터", question: "대량의 데이터를 빠르게 수집하고 분석하여 가치 있는 정보를 얻는 기술은?", answer: "빅데이터" },
  { category: "데이터", question: "원본 데이터를 복원할 수 있도록 크기를 줄이는 압축 방식은?", answer: "비손실압축" },
  { category: "데이터", question: "압축 후 일부 데이터가 손실되지만 높은 압축률을 얻는 방식은?", answer: "손실압축" },
  { category: "데이터", question: "컴퓨터가 다루는 데이터의 가장 작은 단위(0 또는 1)는?", answer: "비트" },
  { category: "데이터", question: "8비트를 묶어서 부르는 데이터 단위는?", answer: "바이트" },
  { category: "데이터", question: "데이터를 다른 사람이 알아볼 수 없도록 변환하여 보호하는 작업은?", answer: "암호화" },
  { category: "데이터", question: "암호화된 데이터를 원래의 데이터로 되돌리는 작업은?", answer: "복호화" },

  // ---- 네트워크 ----
  { category: "네트워크", question: "전 세계의 컴퓨터를 서로 연결하는 거대한 통신망은?", answer: "인터넷" },
  { category: "네트워크", question: "웹사이트 주소 앞에 붙는 보안 통신 프로토콜의 약자는?", answer: "https" },
  { category: "네트워크", question: "네트워크에서 각 장치를 구분하는 고유 주소를 부르는 두 글자 영문 약자는?", answer: "ip" },
  { category: "네트워크", question: "무선으로 인터넷에 접속할 수 있게 해주는 근거리 통신 기술은?", answer: "와이파이" },
  { category: "네트워크", question: "와이파이 신호를 제공하여 무선 기기가 네트워크에 연결될 수 있도록 하는 장치는?", answer: "엑세스포인트" },
  { category: "네트워크", question: "빛을 이용하여 데이터를 빠르게 전송하는 통신 케이블은?", answer: "광케이블" },
  { category: "네트워크", question: "컴퓨터와 공유기 등을 유선으로 연결할 때 사용하는 케이블은?", answer: "이더넷케이블" },

  // ---- 알고리즘 ----
  { category: "알고리즘", question: "문제 해결 절차를 순서대로 나타낸 것을 무엇이라 하는가?", answer: "알고리즘" },
  { category: "알고리즘", question: "알고리즘의 흐름을 도형과 화살표로 표현한 것은?", answer: "순서도" },
  { category: "알고리즘", question: "알고리즘을 사람이 이해하기 쉬운 일상적인 언어로 표현하는 방법은?", answer: "자연어" },
  { category: "알고리즘", question: "프로그래밍 언어와 비슷한 형식으로 알고리즘을 표현하는 방법은?", answer: "의사코드" },
  { category: "알고리즘", question: "인접한 두 값을 비교하며 교환해 나가는 정렬 알고리즘은?", answer: "버블정렬" },
  { category: "알고리즘", question: "정렬된 자료에서 중간값과 비교해 범위를 절반씩 줄여가는 탐색법은?", answer: "이진탐색" },
  { category: "알고리즘", question: "가장 작은(또는 큰) 값을 찾아 앞에서부터 차례대로 배치하는 정렬 알고리즘은?", answer: "선택정렬" },
  { category: "알고리즘", question: "자료를 처음부터 끝까지 차례대로 확인하며 찾는 탐색 방법은?", answer: "순차탐색" },

  // ---- 파이썬 제어구조 ----
  { category: "파이썬 제어구조", question: "파이썬에서 입력은 input, 출력은?", answer: "print" },
  { category: "파이썬 제어구조", question: "파이썬에서 조건을 판단할 때 사용하는 예약어는?", answer: "if" },
  { category: "파이썬 제어구조", question: "파이썬에서 정해진 횟수/범위를 반복할 때 자주 쓰는 반복문은?", answer: "for" },
  { category: "파이썬 제어구조", question: "조건이 참인 동안 계속 반복 실행하는 파이썬 반복문은?", answer: "while" },
  { category: "파이썬 제어구조", question: "파이썬에서 반복문을 즉시 빠져나올 때 쓰는 키워드는?", answer: "break" },
  { category: "파이썬 제어구조", question: "파이썬에서 이번 반복을 건너뛰고 다음 반복으로 넘어갈 때 쓰는 키워드는?", answer: "continue" },
  { category: "파이썬 제어구조", question: "10, -3, 100과 같은 정수를 저장하는 자료형은?", answer: "int" },
  { category: "파이썬 제어구조", question: "3.14, 0.5와 같은 실수를 저장하는 자료형은?", answer: "float" },
  { category: "파이썬 제어구조", question: "True와 False 값을 저장하는 자료형은?", answer: "bool" },
  { category: "파이썬 제어구조", question: "HelloWorld와 같은 문자열을 저장하는 자료형은?", answer: "str" },

  // ---- 디지털윤리 ----
  { category: "디지털윤리", question: "다른 사람의 저작물을 허락 없이 자신의 것처럼 사용하는 행위는?", answer: "표절" },
  { category: "디지털윤리", question: "인터넷에서 상대를 존중하며 지켜야 할 예절을 무엇이라 하는가?", answer: "네티켓" },
  { category: "디지털윤리", question: "온라인에서 특정인을 지속적으로 괴롭히는 행위를 무엇이라 하는가?", answer: "사이버폭력" },
  { category: "디지털윤리", question: "온라인에서 발생하는 언어폭력, 따돌림 등 디지털 공간의 괴롭힘은?", answer: "사이버불링" },
  { category: "디지털윤리", question: "인터넷 활동을 통해 만들어지는 개인의 온라인 정체성은?", answer: "디지털자아" },
  { category: "디지털윤리", question: "스마트폰 문자메시지를 이용한 피싱(phishing) 범죄는?", answer: "스미싱" },
  { category: "디지털윤리", question: "사용자의 동의 없이 대량으로 전송되는 불필요한 이메일은?", answer: "스팸메일" },
  { category: "디지털윤리", question: "이름, 주민등록번호처럼 특정 개인을 알아볼 수 있는 정보를 무엇이라 하는가?", answer: "개인정보" },
  { category: "디지털윤리", question: "정보를 다룰 때 지켜야 할 올바른 가치관과 태도를 통틀어 무엇이라 하는가?", answer: "정보윤리" },
];

module.exports = { QUIZ_QUESTIONS };
