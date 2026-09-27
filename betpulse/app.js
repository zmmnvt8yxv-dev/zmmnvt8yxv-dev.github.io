'use strict';
var API='https://site.api.espn.com/apis/site/v2/sports/football/nfl';
var WEB='https://site.web.api.espn.com/apis/common/v3/sports/football/nfl';
var DAYS=['20260927','20260928'], YEAR=2026, VERSION='20260927.2';
function read(k,fallback){try{var v=JSON.parse(localStorage.getItem(k));return v==null?fallback:v}catch(e){return fallback}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
var busy=false,lastData=[],selected=read('betpulseFilter','all');
if(!['all','b1','b2','b3'].includes(selected))selected='all';
function nt(x){return({JAC:'JAX',WSH:'WAS',LA:'LAR',BLT:'BAL'})[String(x).toUpperCase()]||String(x||'').toUpperCase()}
function nm(x){return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'')}
function n(v){if(v&&typeof v==='object')v=v.value??v.displayValue; if(v==null||String(v).trim()===''||String(v)==='--'||String(v)==='-')return null;var x=Number(String(v).replace(/,/g,''));return Number.isFinite(x)?x:null}
function fmt(v,d){return v!=null&&Number.isFinite(Number(v))?Number(v).toFixed(d??1):'—'}
function matchName(a,b){return !!nm(a)&&nm(a)===nm(b)}
function ev(es,g){return es.find(e=>g.every(t=>(e.competitions?.[0]?.competitors||[]).some(c=>nt(c.team?.abbreviation)===nt(t))))}
function comp(q,e){return q?.header?.competitions?.[0]||e?.competitions?.[0]||{competitors:[]}}
function score(c,t){return n((c.competitors||[]).find(z=>nt(z.team?.abbreviation)===nt(t))?.score)}
function st(q,e){var s=comp(q,e).status||e?.status||{};return{v:s.type?.state||'pre',d:s.type?.shortDetail||s.type?.detail||'Scheduled',completed:s.type?.completed===true}}
function poss(q,e){var c=comp(q,e),sit=q?.situation||c.situation||e?.competitions?.[0]?.situation,id=sit?.possession;var p=(c.competitors||[]).find(x=>id!=null&&String(x.id||x.team?.id)===String(id)||x.possession===true);return p?nt(p.team.abbreviation):''}
function playerName(l){return ['stat','td','combo','longrush','q4rush','sack'].includes(l[0])?l[3]:''}
function groups(q){return(q?.boxscore?.players||[]).flatMap(t=>t.statistics||[])}
function playerPresent(q,p){return groups(q).some(g=>(g.athletes||[]).some(a=>matchName(a.athlete?.displayName,p)))}
function ps(q,p,cat,label){
 var gs=groups(q).filter(g=>g.name?.toLowerCase()===cat.toLowerCase());if(!gs.length)return null;
 var aliases=label==='LONG'?['LONG','LNG']:label==='SACKS'?['SACK','SACKS']:[label];
 for(var g of gs){var i=(g.labels||[]).findIndex(x=>aliases.includes(String(x).toUpperCase()));if(i<0)continue;
  var a=(g.athletes||[]).find(a=>matchName(a.athlete?.displayName,p));if(a)return n(a.stats?.[i]);
 }
 // A participant can have zero catches/rushes and no row in that category.
 if(['rushing','receiving'].includes(cat)&&playerPresent(q,p)&&gs.some(g=>(g.labels||[]).some(x=>aliases.includes(String(x).toUpperCase()))))return 0;
 return null;
}
function combo(q,p){var a=ps(q,p,'rushing','YDS'),b=ps(q,p,'receiving','YDS');return a==null||b==null?null:a+b}
function plays(q){var all=[...(q?.plays||[]),...(q?.drives?.previous||[]).flatMap(d=>d.plays||[]),...(q?.drives?.current?.plays||[])];var seen=new Set();return all.filter(p=>{var key=p.id||JSON.stringify([p.period,p.clock,p.text]);if(seen.has(key))return false;seen.add(key);return true})}
function qRush(q,p,quarter){
 var all=plays(q);if(!all.length)return null;
 var tokens=p.replace(/\b(Jr\.?|III|II)\b/gi,'').trim().split(/\s+/),abbr=nm(tokens[0][0]+tokens.slice(1).join(''));
 var sum=0;
 all.forEach(pl=>{var text=pl.text||pl.shortText||'',type=pl.type?.text||'';
  if(Number(pl.period?.number)!==quarter||/no play|nullified|overturned|two.point/i.test(text+' '+type))return;
  if(!/rush|run|scrambl|kneel/i.test(type))return;
  // Text before the rushing action identifies the runner, not a tackler/participant.
  var runner=text.split(/\b(left|right|up the middle|rushes|rushed|scrambles|kneels|for)\b/i)[0];
  if(!nm(runner).includes(nm(p))&&!nm(runner).includes(abbr))return;
  var yards=n(pl.statYardage);if(yards==null){var m=text.match(/for\s+(-?\d+)\s+yards?/i),loss=text.match(/loss of\s+(\d+)/i);yards=loss?-Number(loss[1]):m?Number(m[1]):/no gain/i.test(text)?0:null}
  if(yards!=null)sum+=yards;
 });return sum;
}
function td(q,p){
 if(!playerPresent(q,p))return null;
 // Passing TDs do not count as touchdowns scored. Do not double count defensive totals.
 var cats=['rushing','receiving','kickReturns','puntReturns','interceptions'],total=0,found=false;
 cats.forEach(c=>{var v=ps(q,p,c,'TD');if(v!=null){total+=v;found=true}});
 return found?total:null;
}
function dst(q,t){
 if(!Array.isArray(q?.scoringPlays))return null;
 return q.scoringPlays.filter(p=>{
  var text=[p.text,p.shortText,p.type?.text].filter(Boolean).join(' ');
  var touchdown=p.scoringType?.name==='touchdown'||Number(p.scoringType?.points)===6||/touchdown/i.test(text);
  return nt(p.team?.abbreviation)===nt(t)&&touchdown&&!/no play|overturned|two.point/i.test(text)&&/interception.*return|fumble.*(return|recover)|punt.*return|kickoff.*return|blocked.*(return|recover|end zone)|defensive touchdown|special teams touchdown/i.test(text);
 }).length;
}
function statValue(l,q){switch(l[0]){case'stat':return ps(q,l[3],l[4],l[5]);case'combo':return combo(q,l[3]);case'longrush':return ps(q,l[3],'rushing','LONG');case'q4rush':return qRush(q,l[3],4);case'td':return td(q,l[3]);case'sack':return ps(q,l[3],'defensive','SACKS');case'dst':return dst(q,l[3]);default:return 0}}
function evalLeg(l,q,e,ctx){
 var gs=st(q,e),playing=gs.v==='in'||gs.v==='post',c=comp(q,e);
 if(playing&&(score(c,l[1][0])==null||score(c,l[1][1])==null||statValue(l,q)==null)){
  var a=score(c,l[1][0]),b=score(c,l[1][1]);
  return{x:l,s:'pending',v:'Stat unavailable',d:gs.completed?'Final game • result awaiting verified stats; check sportsbook settlement.':'Waiting for ESPN stats. Tap Refresh to retry.',g:l[1][0]+' '+(a??'—')+' — '+l[1][1]+' '+(b??'—')+' · '+gs.d,season:seasonLine(l,ctx)};
 }
 var result=evaluateKnown(l,q,e,ctx);
 if(!e){result.s='pending';result.g=l[1].join(' vs ')+' · Schedule unavailable'}
 if(q?._stale)result.d+=' Saved stats • '+new Date(q._fetchedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return result;
}
function teamAverages(events){var m={},seen=new Set();events.forEach(e=>{
 if(seen.has(e.id)||e.season?.year!==YEAR||e.season?.type!==2||!st(null,e).completed)return;seen.add(e.id);
 var cc=e.competitions?.[0]?.competitors||[];if(cc.length!==2)return;
 cc.forEach((x,i)=>{var pf=n(x.score),pa=n(cc[1-i].score),t=nt(x.team?.abbreviation);if(pf==null||pa==null)return;var a=m[t]||(m[t]={gp:0,pf:0,pa:0});a.gp++;a.pf+=pf;a.pa+=pa});
 });Object.values(m).forEach(a=>{a.ppg=a.pf/a.gp;a.papg=a.pa/a.gp;a.margin=(a.pf-a.pa)/a.gp});return m}
function playerContext(raw){
 // This endpoint includes every career season even with season=2026. Read only 2026 rows.
 var cats={};
 (raw.categories||[]).forEach(g=>{var rows=(g.statistics||[]).filter(r=>Number(r.season?.year)===YEAR&&(!r.season?.type||Number(r.season.type?.id||r.season.type)===2));
  if(!rows.length)return;
  var total=rows.find(r=>r.teamSlug==='total'||r.teamId==='0'||r.isTotal);if(total)rows=[total];
  var vals={};(g.names||[]).forEach((name,i)=>{var numbers=rows.map(r=>n(r.stats?.[i]));vals[name]=numbers.every(v=>v!=null)?numbers.reduce((a,b)=>a+b,0):null});cats[g.name]=vals;
 });
 var gp=Math.max(0,...Object.values(cats).map(c=>c.gamesPlayed||0));if(!gp)return null;
 var value=(cat,key)=>cats[cat]?(cats[cat][key]??null):0,avg=(cat,key)=>{var v=value(cat,key);return v==null?null:v/gp};
 var rush=avg('rushing','rushingYards'),rec=avg('receiving','receivingYards');
 var rt=cats.scoring?.rushingTouchdowns??value('rushing','rushingTouchdowns'),ct=cats.scoring?.receivingTouchdowns??value('receiving','receivingTouchdowns');
 return{gp,rec:avg('receiving','receptions'),recY:rec,rushY:rush,passY:avg('passing','passingYards'),ints:avg('passing','interceptions'),td:rt==null||ct==null?null:(rt+ct)/gp,combo:rush==null||rec==null?null:rush+rec,sacks:avg('defensive','sacks')};
}
function tctx(t,ctx){return ctx?.teams?.[nt(t)]}
function pctx(p,ctx){return ctx?.players?.[nm(p)]}
function seasonLine(l,ctx){
 var a,b,p,x;
 if(l[0]==='total'){if(!ctx)return'Loading 2026 team scoring averages…';a=tctx(l[1][0],ctx);b=tctx(l[1][1],ctx);if(a&&b)return'2026 scoring avg: '+l[1][0]+' '+fmt(a.ppg)+' + '+l[1][1]+' '+fmt(b.ppg)+' = '+fmt(a.ppg+b.ppg)+' pts/game';}
 if(l[0]==='ml'){if(!ctx)return'Loading 2026 team scoring averages…';a=tctx(l[1][0],ctx);b=tctx(l[1][1],ctx);if(a&&b)return'2026 PPG: '+l[1][0]+' '+fmt(a.ppg)+' • '+l[1][1]+' '+fmt(b.ppg);}
 if(l[0]==='spread'){if(!ctx)return'Loading 2026 team margins…';a=tctx(l[1][0],ctx);b=tctx(l[1][1],ctx);if(a&&b)return'2026 avg margin: '+l[1][0]+' '+(a.margin>=0?'+':'')+fmt(a.margin)+' • '+l[1][1]+' '+(b.margin>=0?'+':'')+fmt(b.margin);}
 if(l[0]==='dst'){if(!ctx)return'Loading 2026 team averages…';a=tctx(l[3],ctx);if(a)return'2026 scoring context (not D/ST TD rate): '+l[3]+' '+fmt(a.ppg)+' scored • '+fmt(a.papg)+' allowed/game';}
 p=pctx(playerName(l),ctx);if(!ctx)return'Loading 2026 season average…';if(!p||!p.gp)return'2026 season average unavailable';
 var key=l[0]==='stat' ? (l[4]==='receiving'?(l[5]==='REC'?'rec':'recY'):l[4]==='rushing'?'rushY':l[5]==='INT'?'ints':'passY') : ({td:'td',combo:'combo',longrush:'rushY',q4rush:'rushY',sack:'sacks'})[l[0]];
 var units={rec:'receptions/game',recY:'receiving yds/game',rushY:'rushing yds/game',passY:'passing yds/game',ints:'INT thrown/game',td:'rushing/receiving TD/game',combo:'rush + rec yds/game',sacks:'sacks/game'};
 if(!key||p[key]==null)return '2026 season average unavailable';
 return '2026 '+(['longrush','q4rush'].includes(l[0])?'full-game context: ':'avg: ')+fmt(p[key])+' '+units[key]+' • '+p.gp+' games';
 return''
}
function targetText(l){
 if(l[0]==='total')return(l[3]==='over'?'Over ':'Under ')+l[4];
 if(l[0]==='ml')return l[3]+' ML';
 if(l[0]==='spread')return l[3]+' +'+l[4];
 if(l[0]==='stat')return'Target: '+l[6]+(l[6]%1===0?'+':'')+' '+l[7];
 if(l[0]==='td')return'Target: '+l[4]+' TD';
 if(l[0]==='dst')return'Target: 1 D/ST TD';
 if(l[0]==='combo')return'Target: '+l[4]+(l[4]%1===0?'+':'')+' rush+rec yds';
 if(l[0]==='longrush')return'Target: over '+l[4]+' longest rush';
 if(l[0]==='q4rush')return'Target: '+l[4]+'+ Q4 rush yds';
 if(l[0]==='sack')return'Target: record a sack (½ counts)';
 return l[2]
}
function targetState(s,fin,x,target,strict){var hit=strict?x>target:x>=target;if(hit)return{state:'hit',detail:'Target reached.'};if(fin)return{state:'lost',detail:'Finished short.'};return{state:s,detail:'Needs '+(strict?(Math.floor(target)+1-x):Math.ceil(target-x))+' more.'}}
function evaluateKnown(l,q,e,ctx){
 var c=comp(q,e),gs=st(q,e),live=gs.v==='in',fin=gs.completed,pre=!live&&!fin,s=live?'live':(fin?'final':'pre'),a=score(c,l[1][0]),b=score(c,l[1][1]),v='',d='',x=0,y=0,r;
 if(pre){v=targetText(l);d=seasonLine(l,ctx);var when=e?gs.d:'Schedule unavailable';return{x:l,s:'pre',v:v,d:d,g:l[1][0]+' vs '+l[1][1]+' · '+when,season:d}}
 if(l[0]==='total'){x=a+b;v=x+' / '+l[4];if(l[3]==='over'){if(x>l[4]){s='hit';d='Over cleared.'}else if(fin){s='lost';d='Finished short.'}else d='Needs '+(Math.floor(l[4]-x)+1)+' more total points.'}else{if(x>l[4]){s='lost';d='Under can no longer hit.'}else if(fin){s='hit';d='Final stayed under.'}else d=fmt(l[4]-x)+' points below the line.'}}
 if(l[0]==='ml'){x=l[3]===l[1][0]?a:b;y=l[3]===l[1][0]?b:a;v=l[3]+' '+x+' — '+y;if(fin){s=x>y?'hit':x===y?'push':'lost';d=s==='hit'?'Moneyline won.':s==='push'?'Tie • check sportsbook settlement.':'Moneyline lost.'}else d=x>y?'Currently leading by '+(x-y)+'.':x<y?'Currently trailing by '+(y-x)+'.':'Game tied.'}
 if(l[0]==='spread'){x=l[3]===l[1][0]?a:b;y=l[3]===l[1][0]?b:a;var cv=x+l[4]-y;v=l[3]+' +'+l[4];if(fin){s=cv>0?'hit':cv===0?'push':'lost';d=cv>0?'Covered by '+fmt(cv)+'.':cv===0?'Push.':'Missed cover by '+fmt(Math.abs(cv))+'.'}else d=cv>0?'Currently covering by '+fmt(cv)+'.':cv===0?'Currently a push.':'Outside cover by '+fmt(Math.abs(cv))+'.'}
 if(l[0]==='stat'){x=ps(q,l[3],l[4],l[5]);v=x+' / '+l[6]+' '+l[7];r=targetState(s,fin,x,l[6],l[6]%1!==0);s=r.state;d=r.detail}
 if(l[0]==='combo'){x=combo(q,l[3]);v=x+' / '+l[4]+' RUSH+REC YDS';r=targetState(s,fin,x,l[4],l[4]%1!==0);s=r.state;d=r.detail}
 if(l[0]==='longrush'){x=ps(q,l[3],'rushing','LONG');v=x+' / O'+l[4]+' LONG RUSH';if(x>l[4]){s='hit';d='Longest rush cleared the line.'}else if(fin){s='lost';d='Longest rush finished at '+x+'.'}else d='Needs a rush of '+(Math.floor(l[4])+1)+'+ yards.'}
 if(l[0]==='q4rush'){x=qRush(q,l[3],4);v=x+' / '+l[4]+' Q4 RUSH YDS';if(x>=l[4]){s='hit';d='4th-quarter target reached.'}else if(fin){s='lost';d='Finished with '+x+' Q4 rushing yards.'}else d='Needs '+(l[4]-x)+' more Q4 rushing yards.'}
 if(l[0]==='sack'){x=ps(q,l[3],'defensive','SACKS');v=x+' SACKS (½ counts)';if(x>=0.5){s='hit';d='Sack recorded.'}else if(fin){s='lost';d='No sack recorded.'}else d='Needs a credited sack (half sacks count).'}
 if(l[0]==='td'){x=td(q,l[3]);v=x+' / '+l[4]+' TD';if(x>=l[4]){s='hit';d='Touchdown target reached.'}else if(fin){s='lost';d='Finished with '+x+' TD.'}else d='Needs '+(l[4]-x)+' touchdown'+(l[4]-x===1?'':'s')+'.'}
 if(l[0]==='dst'){x=dst(q,l[3]);v=x+' / 1 D/ST TD';if(x){s='hit';d='D/ST touchdown detected.'}else if(fin){s='lost';d='No D/ST touchdown.'}else d='Needs a defensive/special-teams TD.'}
 var p=poss(q,e),info=l[1][0]+' '+a+' — '+l[1][1]+' '+b+' · '+(fin?'Final':gs.d)+(live&&p?' · 🏈 '+p:'');
 return{x:l,s:s,v:v,d:d,g:info,season:seasonLine(l,ctx)}
}
function card(o){var badge=o.s==='pre'?'UPCOMING':o.s==='pending'?'PENDING':o.s.toUpperCase(),sl=(o.season&&o.s!=='pre')?'<div class="season">'+o.season+'</div>':'';return'<div class="card '+o.s+'"><div class="r"><div><div class="pick">'+o.x[2]+'</div><div class="game">'+o.x[1].join(' vs ')+'</div></div><span class="badge">'+badge+'</span></div><div class="metric">'+o.v+'</div><div class="detail">'+o.d+'</div>'+sl+'<div class="state">'+o.g+'</div></div>'}
function filters(){var arr=[{id:'all',txt:'All 3 Bets'}].concat(S.map(function(s){return{id:s.id,txt:s.tag+' · '+s.short,cls:s.cls}}));return'<div class="filters">'+arr.map(function(f){return'<button class="filter '+(f.cls||'')+' '+(selected===f.id?'on':'')+'" onclick="setFilter(\''+f.id+'\')">'+f.txt+'</button>'}).join('')+'</div>'}
function setFilter(id){selected=id;save('betpulseFilter',id);render(lastData)}
function render(data){lastData=data;var h=filters();data.forEach(function(s){if(selected!=='all'&&selected!==s.id)return;var hit=s.a.filter(function(x){return x.s==='hit'}).length,live=s.a.filter(function(x){return x.s==='live'}).length,lost=s.a.filter(function(x){return x.s==='lost'}).length,up=s.a.filter(function(x){return x.s==='pre'}).length;s.a.sort(function(a,b){var p={live:0,hit:1,pre:2,final:3,lost:4,push:3,pending:1};return(p[a.s]??3)-(p[b.s]??3)});h+='<section class="book '+s.cls+'"><div class="betlabel">'+s.tag+'</div><div class="bh"><div><div class="bn">'+s.n+'</div><div class="betmoney">'+s.w+' → '+s.p+'</div></div><div class="legcount">'+s.a.length+' legs</div></div><div class="sum"><span><b>'+hit+'</b>Hit</span><span><b>'+live+'</b>Live</span><span><b>'+lost+'</b>Lost</span><span><b>'+up+'</b>Upcoming</span></div>'+s.a.map(card).join('')+'</section>'});document.getElementById('app').innerHTML=h}

var inflight=new Map(),relayDown=false;
async function requestJSON(url,timeout=6500){
 var controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{var r=await fetch(url,{signal:controller.signal,cache:'no-store',credentials:'omit'});if(!r.ok){var err=Error('HTTP '+r.status);err.status=r.status;throw err}var body=await r.json();if(!body||typeof body!=='object'||body.error)throw Error('Invalid ESPN response');return body}finally{clearTimeout(timer)}
}
async function fj(url){
 if(inflight.has(url))return inflight.get(url);
 var job=(async()=>{
  var error;
  for(var attempt=0;attempt<2;attempt++)try{return await requestJSON(url)}catch(e){error=e;if(e.status>=400&&e.status<500&&e.status!==429)throw e}
  // Last-resort relay, bounded and circuit-broken. A relay cannot fix an invalid URL.
  if(!relayDown)try{return await requestJSON('https://api.allorigins.win/raw?url='+encodeURIComponent(url),4500)}catch(e){relayDown=true}
  throw error;
 })();inflight.set(url,job);try{return await job}finally{inflight.delete(url)}
}
async function pool(items,work,count=4){var i=0;await Promise.all(Array.from({length:Math.min(count,items.length)},async()=>{while(i<items.length){var item=items[i++];try{await work(item)}catch(e){/* isolate each resource */}}}))}
var seed=typeof BOOTSTRAP==='undefined'?{events:[],context:{teams:{},players:{}},athletes:{}}:BOOTSTRAP;
var snapshot=read('betpulseSnapshot_v4',null)||{events:seed.events,qs:{},ts:0};
var context=read('betpulseContext_v4',null)||{data:seed.context,ts:seed.ts||0,playerTs:{}};
var events=snapshot.events||[],summaries=snapshot.qs||{},contextData=context.data||{teams:{},players:{}};
var epoch=0;
function build(){return S.map(s=>({...s,a:s.l.map(l=>evalLeg(l,summaries[ev(events,l[1])?.id],ev(events,l[1]),contextData))}))}
function repaint(){render(build())}
function persist(){save('betpulseSnapshot_v4',{events,qs:summaries,ts:snapshot.ts});save('betpulseContext_v4',context)}
function setNote(text){document.getElementById('note').textContent=text}
async function loadContext(run){
 var missing=0,week=Math.max(1,...events.map(e=>e.week?.number||1));
 // Include completed games in the current week, but never preseason or the live score.
 await pool(Array.from({length:week},(_,i)=>i+1),async w=>{
  var key='betpulseWeek_'+YEAR+'_'+w,cached=read(key,null);
  if(cached&&Date.now()-cached.ts<6*3600000&&w<week)return;
  try{var b=await fj(API+'/scoreboard?dates='+YEAR+'&seasontype=2&week='+w);if(!Array.isArray(b.events)||!b.events.length)throw Error('Missing history');save(key,{ts:Date.now(),events:b.events})}catch(e){missing++}
 },3);
 if(run!==epoch)return;
 var history=Array.from({length:week},(_,i)=>read('betpulseWeek_'+YEAR+'_'+(i+1),null));
 if(history.every(Boolean)){contextData.teams=teamAverages(history.flatMap(h=>h.events));repaint()}
 var unique=[...new Map(S.flatMap(s=>s.l).filter(l=>playerName(l)).map(l=>[nm(playerName(l)),l])).entries()];
 await pool(unique,async([key,l])=>{
  if((context.playerTs?.[key]||seed.ts)&&Date.now()-(context.playerTs?.[key]||seed.ts)<6*3600000)return;
  var a=seed.athletes[key];if(!a){missing++;return}
  try{var raw=await fj(WEB+'/athletes/'+a.id+'/stats?season='+YEAR+'&seasontype=2');if(!Array.isArray(raw.categories))throw Error('Missing season rows');var value=playerContext(raw);
   if(run!==epoch)return;contextData.players[key]=value;context.playerTs=context.playerTs||{};context.playerTs[key]=Date.now();repaint();
  }catch(e){missing++}
 });
 if(run!==epoch)return;
 context.ts=Date.now();context.data=contextData;save('betpulseContext_v4',context);return missing;
}
async function go(){
 if(busy)return;busy=true;var run=++epoch,failures=0,loaded=0;
 var buttons=document.querySelectorAll('[data-refresh]');buttons.forEach(b=>{b.disabled=true;b.textContent='Refreshing…'});
 document.getElementById('last').textContent='Fetching schedule…';setNote('Keeping your slips visible while ESPN updates.');
 Object.values(summaries).forEach(q=>{q._stale=true});repaint();
 try{
  await pool(DAYS,async day=>{try{
   var b=await fj(API+'/scoreboard?dates='+day);if(!Array.isArray(b.events)||!b.events.length)throw Error('Empty schedule');
   var ids=new Set(b.events.map(e=>e.id));events=events.filter(e=>!ids.has(e.id)).concat(b.events.map(e=>({...e,week:b.week||e.week})));loaded++;repaint();
  }catch(e){failures++}},2);
  if(!loaded){setNote('ESPN is unavailable. Showing saved schedule/stats; nothing has been reset. Tap Refresh to retry.');return}
  snapshot.ts=Date.now();document.getElementById('last').textContent='Schedule loaded • updating stats…';persist();
  var relevant=events.filter(e=>S.some(s=>s.l.some(l=>ev([e],l[1])))&&['in','post'].includes(st(null,e).v));
  await pool(relevant,async e=>{try{var q=await fj(API+'/summary?event='+e.id);if(!q.header?.competitions?.length)throw Error('Missing game');q._fetchedAt=Date.now();q._stale=false;summaries[e.id]=q;repaint()}catch(err){failures++}});
  persist();
  document.getElementById('last').textContent='Snapshot '+new Date(snapshot.ts).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+' • season context updating…';
  var missing=await loadContext(run);
  setNote((failures?'Some live feeds failed; saved or unavailable stats are labeled. ':'Snapshot loaded. ')+(missing?'Some averages could not update. ':'')+'Refresh is manual. ESPN may lag 1–2 minutes. HIT/LOST are stat-based estimates; sportsbook settlement controls voids and corrections.');
 }catch(e){setNote('Some data could not update. Your slips and saved data are still available. Tap Refresh to retry.')}
 finally{busy=false;buttons.forEach(b=>{b.disabled=false;b.textContent=b.id==='big'?'↻ Refresh BetPulse':'Refresh'});document.getElementById('last').textContent=(loaded?'Updated ':'Saved snapshot ')+(snapshot.ts?new Date(snapshot.ts).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'• tap Refresh')+' • v'+VERSION;repaint()}
}
// Render bundled, dated pregame context immediately. Opening/focusing never polls ESPN.
Object.values(summaries).forEach(q=>{q._stale=true});
repaint();
document.getElementById('last').textContent=snapshot.ts?'Saved '+new Date(snapshot.ts).toLocaleString():'Pregame snapshot • Sep 27, 2026';
setNote('Tap Refresh for current ESPN scores and stats. Season context uses completed 2026 regular-season games. No automatic refresh.');
