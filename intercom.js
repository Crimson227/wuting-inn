'use strict';
const $=s=>document.querySelector(s);
const station=$('#station'),runway=$('#terminal'),monitor=$('.monitor'),picture=$('#picture'),caption=$('#caption'),actions=$('#actions');
const cameras=[
 ['lobby','一楼门厅','CAM 01 · ENTRANCE','单元门'],
 ['stairs','东侧楼梯间','CAM 02 · STAIRWELL','楼梯间'],
 ['peephole','604 门外','OPTICAL · 0604','六楼猫眼'],
 ['inside','604 室内','EXT 04 · INTERIOR','室内分机']
];
const transcripts=['楼下有人在按你的门铃。','她说她忘带钥匙了。','楼梯转角站着一个人。','门链还扣着。门外没有人。','你家里还有一部正在通话的分机。',''];
let stage=-1,visible=false,route='eye',asked=false,lit=false,cam=0,epoch=0,clockStart=0;
let jobs=[],records=[],audioCtx,volume,drone,wind,noiseBuffer,muteByChoice=false,enabled=false,speaking=null;
const pics={};
function preload(){['lobby','stairs','peephole','inside','ajar','visitor'].forEach(n=>{if(!pics[n]){pics[n]=new Image();pics[n].src=n+'.webp'}})}
if('IntersectionObserver' in window){const io=new IntersectionObserver(v=>{if(v.some(x=>x.isIntersecting)){preload();io.disconnect()}},{rootMargin:'450px'});io.observe($('#service'))}else preload();
function playTone(freq,duration,level=.13,delay=0,type='sine',pan=0,endFreq=freq){
 if(!enabled||!audioCtx||!visible)return;
 const t=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(endFreq,t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(level,t+.014);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);
 if(audioCtx.createStereoPanner){const p=audioCtx.createStereoPanner();p.pan.value=pan;g.connect(p).connect(volume)}else g.connect(volume);
 o.start(t);o.stop(t+duration+.04)
}
function soundscape(){
 if(!audioCtx)return;const t=audioCtx.currentTime;
 volume.gain.setTargetAtTime(enabled&&visible?.45:0,t,.08);
 drone.gain.setTargetAtTime(stage<2?.022:stage<4?.06:.035,t,.7);
 wind.gain.setTargetAtTime(cam===0?.06:.014,t,.4)
}
function enable(value){
 if(value&&!audioCtx){
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  try{audioCtx=new Audio();volume=audioCtx.createGain();volume.gain.value=0;const comp=audioCtx.createDynamicsCompressor();volume.connect(comp).connect(audioCtx.destination);
  drone=audioCtx.createGain();drone.gain.value=0;drone.connect(volume);[47,49.2,72.6].forEach(f=>{let o=audioCtx.createOscillator();o.frequency.value=f;o.connect(drone);o.start()});
  noiseBuffer=audioCtx.createBuffer(1,audioCtx.sampleRate*2,audioCtx.sampleRate);let a=noiseBuffer.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;
  const n=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter();wind=audioCtx.createGain();wind.gain.value=0;n.buffer=noiseBuffer;n.loop=true;filter.type='lowpass';filter.frequency.value=1700;n.connect(filter).connect(wind).connect(volume);n.start()
  }catch{return}}
 enabled=value;if(value)audioCtx.resume().catch(()=>{});else stopVoice();
 $('#audio').textContent=value?'声音开':'声音关';$('#audio').setAttribute('aria-pressed',value);soundscape()
}
function stopVoice(){if(speaking&&window.speechSynthesis){speechSynthesis.cancel();speaking=null}}
function voice(words,near=false){
 if(!enabled||!visible||!window.speechSynthesis)return;
 const voices=speechSynthesis.getVoices(),v=voices.find(x=>/ting.?ting|婷婷/i.test(x.name))||voices.find(x=>/^zh[-_]CN/i.test(x.lang));if(!v)return;
 stopVoice();speaking=new SpeechSynthesisUtterance(words);speaking.voice=v;speaking.lang=v.lang;speaking.rate=near?.82:.91;speaking.pitch=near?.63:.92;speaking.volume=near?.42:.35;speechSynthesis.speak(speaking)
}
window.speechSynthesis?.getVoices();
function bell(){[0,.48].forEach(d=>{playTone(693,.35,.12,d,'sine',-.22);playTone(922,.33,.075,d+.02,'sine',-.22)})}
function knock(d=0,pan=.78,heavy=false){playTone(heavy?134:189,.24,heavy?.43:.22,d,'triangle',pan,40);playTone(440,.055,.10,d,'square',pan,130)}
function hiss(loud=false){if(!enabled||!visible||!audioCtx)return;
 const n=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain(),t=audioCtx.currentTime;n.buffer=noiseBuffer;f.type='bandpass';f.frequency.value=loud?1520:870;f.Q.value=.8;g.gain.setValueAtTime(loud?.35:.08,t);g.gain.exponentialRampToValueAtTime(.0001,t+(loud?.6:.14));n.connect(f).connect(g).connect(volume);n.start();n.stop(t+.68)}
function cancel(){epoch++;jobs.forEach(clearTimeout);jobs=[];stopVoice();monitor.classList.remove('black','hit','listen','bump','cut');station.classList.remove('invasion')}
function later(ms,fn){const generation=epoch;jobs.push(setTimeout(()=>{if(epoch===generation&&visible)fn()},ms))}
function cut(){monitor.classList.add('cut');hiss();later(135,()=>monitor.classList.remove('cut'))}
function shake(){monitor.classList.remove('bump');void monitor.offsetWidth;monitor.classList.add('bump')}
function time(){const t=23*3600+48*60+6+Math.floor((performance.now()-clockStart)/1000);return [Math.floor(t/3600)%24,Math.floor(t/60)%60,t%60].map(x=>String(x).padStart(2,'0')).join(':')}
function log(s){if(records.at(-1)?.s===s)return;records.push({s,t:time()});$('#history').replaceChildren(...records.slice(-4).map(x=>{const li=document.createElement('li');li.textContent=x.t+'　'+x.s;return li}))}
function showFrame(i,file,zoom=1){cam=i;const [defaultFile,title,name,line]=cameras[i];picture.style.backgroundImage='url("'+(file||defaultFile)+'.webp")';picture.style.transform=zoom===1?'':'scale('+zoom+')';picture.style.filter='';$('#channel').textContent=title;$('#cam').textContent=name;document.querySelectorAll('.line').forEach(el=>el.classList.toggle('active',el.querySelector('span').textContent===line));soundscape()}
function subtitle(text,read=false,near=false){caption.replaceChildren();if(text){const span=document.createElement('span');span.textContent=text;caption.append(span);if(read)voice(text,near)}}
function controls(primary,cb,other,alt){actions.replaceChildren();[[primary,cb],[other,alt]].forEach(([title,fn])=>{if(!title)return;const btn=document.createElement('button');btn.textContent=title;btn.onclick=()=>{if(!enabled&&!muteByChoice)enable(true);fn()};actions.append(btn)})}
function info(signal,source,prompt){$('#signal').textContent=signal;$('#source').textContent=source;$('#prompt').textContent=prompt}
function geometry(){return {start:runway.offsetTop,range:Math.max(1,runway.offsetHeight-station.offsetHeight)}}
function go(s){const {start,range}=geometry();window.scrollTo({top:start+range*(s/5),behavior:'instant'});sync()}
function restart(){cancel();records=[];asked=false;lit=false;route='eye';stage=-1;clockStart=performance.now();$('#history').replaceChildren();window.scrollTo({top:0,behavior:'instant'});sync()}
function enter(){preload();if(!enabled&&!muteByChoice)enable(true);go(0)}
document.querySelectorAll('[data-start]').forEach(b=>b.onclick=enter);$('#quit').onclick=restart;
$('#audio').onclick=()=>{muteByChoice=enabled;enable(!enabled);if(enabled&&stage===0)bell()};
function ringAgain(){bell();later(4600,ringAgain)}
function chooseRoute(r){route=r;go(4)}
function render(s){
 cancel();stage=s;station.dataset.stage=s;subtitle('');$('#feednote').textContent='线路稳定';$('#stepinfo').textContent='向下滚动或操作面板';$('#connection').textContent='QILI INTERCOM　/　内线 0604';
 if(s>0)cut();
 switch(s){
 case 0:showFrame(0);info('访客呼叫中','单元门呼叫 604',transcripts[0]);log('门厅呼叫本机');controls('接听对讲',()=>go(1),'查看门口',()=>{showFrame(0,null,1.38);subtitle('雨伞还在滴水。门已经关了。');controls('接听对讲',()=>go(1))});ringAgain();break;
 case 1:showFrame(0);info('对讲已接通','来自单元门',transcripts[1]);log('接听 · 门厅');subtitle('“帮我开一下门。两只手都拎着东西呢。”',true);
 controls('查看楼梯间',()=>go(2),'问她是谁',()=>{asked=true;log('对方未报姓名');subtitle('“你先别挂。我说话的时候，你仔细听家里。”',true);knock(.9,-.7);$('#prompt').textContent='那一下敲击声，是从你身后传来的。';controls('切到楼梯间',()=>go(2))});break;
 case 2:showFrame(1);info('移动侦测','东梯 · 五层半',transcripts[2]);log('五楼半有人停留');subtitle('楼下的听筒还通着。楼梯上的人双手空空。');later(1700,()=>{knock(0,-.65);knock(.58,-.18);knock(1.35,.45)});
 controls('查看六楼猫眼',()=>go(3),'打开楼道灯',()=>{lit=true;cut();showFrame(1,null,1.35);picture.style.filter='brightness(1.42)';log('六楼声控灯亮起');subtitle('“谢谢。我看见你家门牌了。”',true);$('#prompt').textContent='她抬头之前，你已经听见六楼的脚步。';controls('查看自家门口',()=>go(3))});break;
 case 3:showFrame(2);info('本层门前','604 室外',transcripts[3]);log('切入门前猫眼');subtitle(lit?'楼道灯亮着。那串湿脚印停在你门前。':'门底渗进来一点水。楼梯间的脚步停了。');later(1300,()=>{knock();knock(.34);shake()});later(3100,()=>{subtitle(asked?'“听到了吗？我现在敲的是哪一边？”':'“你看看门后。我把钥匙挂在那儿了。”',true,true)});
 controls('凑近猫眼',()=>chooseRoute('eye'),'扣紧门链',()=>chooseRoute('chain'));break;
 case 4:showFrame(route==='eye'?2:3);log(route==='eye'?'切换光学直视':'门链已扣紧');info('通话静音',route==='eye'?'光学猫眼':'玄关',route==='eye'?'屏住气，你把眼睛贴了过去。':'金属链条绷紧了。你往后退了一步。');
 monitor.classList.add('listen');subtitle(route==='eye'?'镜片另一侧起了一层雾。':'座机听筒自己从底座上滑了下来。');later(1300,()=>{playTone(520,.19,.07,0,'triangle',-.65);log('室内分机加入通话')});
 later(2100,()=>{subtitle(route==='eye'?'“你堵住光了。”':'“扣好了？那外面的人进不来了。”',true,true);$('#prompt').textContent=route==='eye'?'镜片被什么东西从外面擦了一下。':'门还关着。沙发后面有人喘了一口气。'});
 controls(route==='eye'?'再看一眼':'回头看一眼',()=>go(5));later(4900,()=>go(5));break;
 case 5:finale();break;
 }
}
function finale(){
 const eye=route==='eye';showFrame(eye?2:3);controls();info('载波中断',eye?'门前猫眼':'室内分机',eye?'猫眼里，只剩一圈很细的光。':'电话线已经从墙上拔下来了。');subtitle('');$('#stepinfo').textContent='';monitor.classList.add('black');
 later(eye?820:1260,()=>{monitor.classList.remove('black','listen','cut');station.classList.add('invasion');showFrame(eye?2:3,eye?'visitor':'ajar');monitor.classList.add('hit');hiss(true);knock(0,eye?.5:-.9,true);playTone(81,.63,.38,0,'sawtooth',-.1,31);playTone(724,.39,.16,.02,'triangle',.4,213)});
 if(!eye)later(2220,()=>{showFrame(3,'visitor');hiss(true);knock(0,-.8,true)});
 later(eye?2150:3150,()=>{station.classList.remove('invasion');monitor.classList.remove('hit');monitor.classList.add('black');playTone(423,.65,.09,0,'sine',0,412);info('呼叫已结束','内线录音回放','接下来响起的是你自己的门铃。')});
 later(eye?3100:4050,()=>{showFrame(3,eye?'inside':'ajar');monitor.classList.remove('black');subtitle(eye?'“先别开门。它刚刚趴在我家猫眼上。”':'“链子扣好了。现在屋里就我们两个。”',true,true);log('呼叫来源：604 室内');$('#connection').textContent='本次呼叫来源　/　604 室内分机';$('#feednote').textContent='自动保存 · 通话录音';bell()});
 later(eye?4800:5650,()=>{info('录音已归档',eye?'通话结束 · 猫眼':'通话结束 · 门链',eye?'呼叫转接成功。下一户正在听你的声音。':'门链一直扣在门的里面。');controls('重新进入社区',restart);$('#stepinfo').textContent='604 / END OF RECORD'})
}
function sync(){
 const top=runway.getBoundingClientRect().top;const nextVisible=top<station.offsetHeight*.48&&runway.getBoundingClientRect().bottom>0;
 if(nextVisible!==visible){visible=nextVisible;if(!visible){cancel();stage=-1}else if(!clockStart)clockStart=performance.now();soundscape()}
 if(!visible)return;const {range}=geometry();const wanted=Math.min(5,Math.max(0,Math.floor((-top/range)*5+.09)));if(stage!==wanted)render(wanted)
}
let frame=0;function scrollTick(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;sync()})}
addEventListener('scroll',scrollTick,{passive:true});addEventListener('resize',scrollTick);
setInterval(()=>{if(visible&&!document.hidden)$('#clock').textContent=time()},500);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopVoice();if(audioCtx)audioCtx.suspend().catch(()=>{})}else if(enabled&&audioCtx)audioCtx.resume().catch(()=>{})});
addEventListener('keydown',e=>{if(e.key==='Escape'&&visible)restart()});sync();
