(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.PikaDialogue=value;})(globalThis,function(){
 const lines={
  confident:['피카피카! 오늘도 응원할게요.','작은 한 걸음부터, 나랑 같이 해요 ⚡','오늘도 든든하게 곁에 있을게요!','준비됐나요? 오늘의 모험을 시작해요!'],
  determined:['P1부터 하나씩! 캡틴이 함께할게요.','피카! 중요한 일부터 차근차근 가봐요.','집중할 준비 완료! 급한 일부터 시작해요.','할 수 있어요. 첫 번째 P1을 골라볼까요?'],
  excited:['피카! 새로운 소식이 왔어요.','새로운 할 일을 발견했어요! 같이 볼까요?','띵동! 오늘의 작은 미션이 도착했어요.','업무 소식을 챙겨왔어요. 하나씩 확인해요!'],
  surprised:['피카?! 새 할 일이 여러 개 생겼어요!','앗, 새로운 미션이 한꺼번에 왔네요!','소식이 쏟아졌어요. P1부터 함께 정리해요.','깜짝! 할 일이 늘었지만 차근차근 해봐요.'],
  happy:['피카피카! 멋진 한 걸음이에요 ⚡','짝짝! 캡틴이 힘껏 응원하고 있어요!','정말 잘하고 있어요. 잠깐 뿌듯해해도 좋아요!','한 가지씩 해내는 모습, 멋져요!'],
  tired:['할 일이 많아도 괜찮아요.','산처럼 보여도 한 걸음씩 오르면 돼요.','전부 한 번에 하지 않아도 괜찮아요.','조금 버거울 땐 가장 작은 일부터 해봐요.'],
  angry:['앗, 연결이 잠깐 꼬였어요.','피카! 연결 상태를 한번 살펴볼까요?','소식을 가져오는 길에 문제가 생겼어요.','잠깐 멈췄지만 같이 해결할 수 있어요!'],
  sleepy:['피카… 잠깐 쉬어갈까요?','조용한 시간이네요. 기지개 한번 켜요!','눈도 어깨도 쉬어갈 시간이 필요해요.','피카아… 물 한 모금 마시고 다시 만나요.'],
  goofy:['피카~ 잠깐 웃고 갈까요?','5분 쉬는 시간! 어깨를 쭉 펴봐요.','캡틴도 충전 중이에요. 함께 쉬어요!','쉬는 것도 오늘의 멋진 한 걸음이에요.'],
  focused:['좋아요, 지금은 집중할 시간!','피카! 25분 동안 한 가지에 집중해요.','캡틴이 조용히 곁을 지킬게요 ⚡','첫 한 걸음에 집중해요. 제가 곁에 있을게요.'],
  meeting:['피카! 회의 시간이 다가와요.','캡틴의 시간 체크! 곧 회의가 시작돼요.','회의 준비할 시간이에요. 필요한 노트를 챙겨요!','다음 만남이 코앞이에요. 참가 링크를 확인해요.'],
  welcome:['피카! 오늘도 함께할게요.','캡틴 피카츄, 오늘도 출근 완료 ⚡','다시 만나 반가워요! 오늘도 차근차근 가봐요.','오늘의 작은 모험에도 제가 함께할게요!'],
  complete:['모두 해냈어요! 정말 멋져요 ⚡','오늘의 미션 완료! 캡틴이 박수를 보내요!','전부 마쳤네요. 이제 마음 놓고 쉬어요!','피카피카! 끝까지 해낸 당신이 멋져요!'],
  halfway:['벌써 절반 했어요!','반이나 해냈네요! 이 기세로 차근차근 ⚡','중간 지점 도착! 아주 잘하고 있어요.','절반을 넘었어요. 한 걸음씩 쌓인 힘이에요!'],
  step:['한 걸음 더 해냈어요!','작은 미션 하나 완료! 잘했어요 ⚡','하나 줄었네요. 캡틴이 응원해요!','차근차근 전진 중! 지금처럼 해봐요.']
 };
 function createPicker(random=Math.random){const last=new Map();return function pick(situation){const options=lines[situation]||lines.confident,previous=last.get(situation),available=options.map((_,i)=>i).filter(i=>i!==previous);const index=available[Math.min(available.length-1,Math.max(0,Math.floor(random()*available.length)))];last.set(situation,index);return options[index];};}
 const pick=createPicker();return {lines,pick,createPicker};
});
