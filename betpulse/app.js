var API='https://site.api.espn.com/apis/site/v2/sports/football/nfl',WEB='https://site.web.api.espn.com/apis/common/v3/sports/football/nfl',R='20260927-20260928',HIST='20260901-20260927',busy=false,lastData=[],selected=localStorage.getItem('betpulseFilter')||'all';

var S=[
{id:'b1',tag:'BET 1',n:'DraftKings',short:'DK $10',w:'$10.00',p:'$349.70',cls:'dk',l:[
['total',['BAL','DAL'],'Under 59.5','under',59.5],
['ml',['PHI','CHI'],'PHI Moneyline','PHI'],
['spread',['NE','JAX'],'NE +3','NE',3],
['ml',['CIN','PIT'],'CIN Moneyline','CIN'],
['ml',['SEA','WAS'],'SEA Moneyline','SEA'],
['td',['KC','MIA'],'Kenneth Walker III Anytime TD','Kenneth Walker III',1],
['stat',['LV','NO'],'Chris Olave 6+ Receptions','Chris Olave','receiving','REC',6,'REC'],
['spread',['LV','NO'],'LV +3.5','LV',3.5]
]},
{id:'b2',tag:'BET 2',n:'FanDuel',short:'FD $2.05',w:'$2.05',p:'$272,982.55',cls:'fd1',l:[
['stat',['NYJ','DET'],'Jameson Williams 80+ Yards','Jameson Williams','receiving','YDS',80,'REC YDS'],
['stat',['NYJ','DET'],'Amon-Ra St. Brown 125+ Yards','Amon-Ra St. Brown','receiving','YDS',125,'REC YDS'],
['stat',['NYJ','DET'],'Jared Goff 250+ Yards','Jared Goff','passing','YDS',250,'PASS YDS'],
['dst',['CIN','PIT'],'Pittsburgh Defense Anytime TD','PIT'],
['td',['KC','MIA'],'Emmett Johnson Anytime TD','Emmett Johnson',1],
['td',['NE','JAX'],'Chris Rodriguez Jr. Anytime TD','Chris Rodriguez Jr.',1],
['stat',['LAC','BUF'],'Justin Herbert Over 0.5 INT','Justin Herbert','passing','INT',1,'INT'],
['total',['MIN','TB'],'Over 42.5','over',42.5],
['total',['BAL','DAL'],'Under 52.5','under',52.5],
['td',['LV','NO'],'Ashton Jeanty 2+ TDs','Ashton Jeanty',2]
]},
{id:'b3',tag:'BET 3',n:'FanDuel',short:'FD $2',w:'$2.00',p:'$337,260.85',cls:'fd2',l:[
['q4rush',['BAL','DAL'],'Derrick Henry 20+ Yards (4th Qtr)','Derrick Henry',20],
['td',['BAL','DAL'],'Lamar Jackson Anytime TD','Lamar Jackson',1],
['stat',['CIN','PIT'],'Pat Freiermuth 4+ Receptions','Pat Freiermuth','receiving','REC',4,'REC'],
['stat',['HOU','IND'],'Woody Marks 3+ Receptions','Woody Marks','receiving','REC',3,'REC'],
['td',['NE','JAX'],'Trevor Lawrence Anytime TD','Trevor Lawrence',1],
['stat',['LAC','BUF'],'Oronde Gadsden 3+ Receptions','Oronde Gadsden','receiving','REC',3,'REC'],
['longrush',['SEA','WAS'],'Marcus Mariota Over 10.5 Longest Rush','Marcus Mariota',10.5],
['stat',['NYJ','DET'],'Garrett Wilson 6+ Receptions','Garrett Wilson','receiving','REC',6,'REC'],
['stat',['TEN','NYG'],'Isaiah Likely 4+ Receptions','Isaiah Likely','receiving','REC',4,'REC'],
['td',['CAR','CLE'],'Quinshon Judkins Anytime TD','Quinshon Judkins',1],
['combo',['KC','MIA'],'Emmett Johnson 50+ Rush + Rec Yards','Emmett Johnson',50],
['combo',['ARI','SF'],'Deebo Samuel Over 47.5 Rush + Rec Yards','Deebo Samuel',47.5],
['stat',['MIN','TB'],'Jalen McMillan 2+ Receptions','Jalen McMillan','receiving','REC',2,'REC'],
['stat',['LV','NO'],'Michael Mayer 3+ Receptions','Michael Mayer','receiving','REC',3,'REC'],
['sack',['LAR','DEN'],'Aaron Donald To Record a Sack','Aaron Donald',1],
['stat',['PHI','CHI'],'Tyson Bagent Over 18.5 Rushing Yards','Tyson Bagent','rushing','YDS',18.5,'RUSH YDS']
]}];

function nt(x){x=(x||'').toUpperCase();if(x==='JAC')return'JAX';if(x==='WSH')return'WAS';if(x==='LA')return'LAR';return x}
function nm(x){return(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'')}
function n(v){var m=String(v==null?'':v).replace(/,/g,'').match(/-?\d+(\.\d+)?/);return m?+m[0]:0}
function fmt(v,d){return isFinite(v)?Number(v).toFixed(d==null?1:d):'—'}
function ev(es,g){return es.find(function(e){var a=(e.competitions&&e.competitions[0]&&e.competitions[0].competitors||[]).map(function(c){return nt(c.team.abbreviation)});return g.every(function(t){return a.indexOf(nt(t))>=0})})}
function comp(q,e){return(q&&q.header&&q.header.competitions&&q.header.competitions[0])||(e&&e.competitions&&e.competitions[0])||{competitors:[]}}
function score(c,t){var x=(c.competitors||[]).find(function(z){return nt(z.team&&z.team.abbreviation)===nt(t)});return x?n(x.score):0}
function st(q,e){var c=comp(q,e),s=c.status||(e&&e.status)||{};return{v:(s.type&&s.type.state)||'pre',d:(s.type&&(s.type.shortDetail||s.type.detail))||'Scheduled',completed:!!(s.type&&s.type.completed)}}
function poss(q){var c=q&&q.header&&q.header.competitions&&q.header.competitions[0],id=c&&c.situation&&c.situation.possession,p=c&&(c.competitors||[]).find(function(x){return String(x.id||x.team.id)===String(id)||x.possession===true});if(p)return nt(p.team.abbreviation);return q&&q.drives&&q.drives.current&&q.drives.current.team?nt(q.drives.current.team.abbreviation):''}
function matchName(a,b){a=nm(a);b=nm(b);return !!a&&!!b&&(a===b||a.indexOf(b)>=0||b.indexOf(a)>=0)}

function deepAthleteId(root,p){
 if(!root)return'';var q=[root],seen=new Set(),want=nm(p),steps=0;
 while(q.length&&steps<12000){steps++;var x=q.shift();if(!x||typeof x!=='object'||seen.has(x))continue;seen.add(x);
  var dn=x.displayName||x.fullName||x.shortName;
  if(dn&&x.id&&matchName(dn,want))return String(x.id);
  Object.keys(x).forEach(function(k){var v=x[k];if(v&&typeof v==='object')q.push(v)})
 }return''
}
function ps(q,p,cat,lab){var out=0;(q&&q.boxscore&&q.boxscore.players||[]).forEach(function(tm){(tm.statistics||[]).forEach(function(g){if((g.name||'').toLowerCase()!==cat.toLowerCase())return;var i=(g.labels||[]).findIndex(function(x){return String(x).toUpperCase()===String(lab).toUpperCase()});if(i<0)return;(g.athletes||[]).forEach(function(a){if(matchName(a.athlete.displayName,p))out=n(a.stats[i])})})});return out}
function psLabel(q,p,re){var out=0;(q&&q.boxscore&&q.boxscore.players||[]).forEach(function(tm){(tm.statistics||[]).forEach(function(g){var i=(g.labels||[]).findIndex(function(x){return re.test(String(x).toUpperCase())});if(i<0)return;(g.athletes||[]).forEach(function(a){if(matchName(a.athlete.displayName,p))out=Math.max(out,n(a.stats[i]))})})});return out}
function athleteId(q,p){return deepAthleteId(q,p)}
function playHas(pl,id,p){var hit=false;(pl.participants||[]).forEach(function(x){var a=x.athlete||x;if(String(a.id||x.athleteId||'')===String(id)&&id)hit=true});if(hit)return true;var tx=nm(pl.text||pl.shortText||''),full=nm(p),parts=full.split(/\s+/),last=parts[parts.length-1]||full;return tx.indexOf(full)>=0||(last.length>4&&tx.indexOf(last)>=0)}
function playYards(pl){if(typeof pl.statYardage==='number')return pl.statYardage;var tx=pl.text||pl.shortText||'',m=tx.match(/for\s+(-?\d+)\s+yards?/i);if(m)return +m[1];m=tx.match(/loss of\s+(\d+)\s+yards?/i);if(m)return -Number(m[1]);return 0}
function qRush(q,p,quarter){var z=0,id=athleteId(q,p);(q&&q.plays||[]).forEach(function(pl){if(!pl.period||Number(pl.period.number)!==quarter||!playHas(pl,id,p))return;var typ=((pl.type&&pl.type.text)||'').toLowerCase(),tx=(pl.text||pl.shortText||'').toLowerCase();if(!/rush|run/.test(typ)&&!/rushed|rushes|scramble|left end|right end|up the middle|left tackle|right tackle|left guard|right guard/.test(tx))return;z+=playYards(pl)});return z}
function td(q,p){var z=0;(q&&q.boxscore&&q.boxscore.players||[]).forEach(function(tm){(tm.statistics||[]).forEach(function(g){if((g.name||'').toLowerCase()==='passing')return;var i=(g.labels||[]).findIndex(function(x){return String(x).toUpperCase()==='TD'});if(i<0)return;(g.athletes||[]).forEach(function(a){if(matchName(a.athlete.displayName,p))z+=n(a.stats[i])})})});return z}
function dst(q,t){var z=0,re=/(interception.*return|fumble.*return|punt.*return|kickoff.*return|blocked.*(return|end zone)|defensive touchdown|special teams touchdown)/i;(q&&q.scoringPlays||[]).forEach(function(p){var a=nt(p.team&&p.team.abbreviation),x=[p.text,p.shortText,p.type&&p.type.text].filter(Boolean).join(' ');if(a===nt(t)&&re.test(x))z++});return z}

function teamAverages(events){
 var m={};
 (events||[]).forEach(function(e){var c=e.competitions&&e.competitions[0],ss=e.status&&e.status.type;if(!c||!(ss&&ss.completed))return;var cc=c.competitors||[];if(cc.length<2)return;
  cc.forEach(function(x){var t=nt(x.team&&x.team.abbreviation);if(!t)return;var opp=cc.find(function(y){return y!==x});if(!m[t])m[t]={gp:0,pf:0,pa:0};m[t].gp++;m[t].pf+=n(x.score);m[t].pa+=n(opp&&opp.score)})
 });
 Object.keys(m).forEach(function(t){m[t].ppg=m[t].pf/m[t].gp;m[t].papg=m[t].pa/m[t].gp;m[t].margin=(m[t].pf-m[t].pa)/m[t].gp});
 return m
}
function collectStats(root){
 var out={},q=[root],seen=new Set(),steps=0;
 while(q.length&&steps<15000){steps++;var x=q.shift();if(!x||typeof x!=='object'||seen.has(x))continue;seen.add(x);
  var name=x.name||x.displayName||x.shortDisplayName||x.abbreviation;
  var val=(typeof x.value==='number')?x.value:(typeof x.displayValue==='number'?x.displayValue:null);
  if(val==null&&typeof x.displayValue==='string'&&/^-?\d+(\.\d+)?$/.test(x.displayValue.replace(/,/g,'')))val=Number(x.displayValue.replace(/,/g,''));
  if(name&&val!=null){var k=nm(name);if(!out[k]||Math.abs(val)>Math.abs(out[k]))out[k]=val}
  Object.keys(x).forEach(function(k){var v=x[k];if(v&&typeof v==='object')q.push(v)})
 }return out
}
function statGuess(map,patterns){
 var keys=Object.keys(map||{}),best=null,bestScore=-1;
 patterns.forEach(function(p,idx){var np=nm(p);keys.forEach(function(k){var score=-1;if(k===np)score=100-idx;else if(k.indexOf(np)>=0||np.indexOf(k)>=0)score=50-idx;if(score>bestScore){bestScore=score;best=map[k]}})});
 return best==null?0:Number(best)
}
function playerContextFromMap(map,type){
 var gp=statGuess(map,['gamesPlayed','games','appearances']);
 var rec=statGuess(map,['receptions','receivingReceptions']);
 var recY=statGuess(map,['receivingYards']);
 var rushY=statGuess(map,['rushingYards']);
 var passY=statGuess(map,['passingYards']);
 var ints=statGuess(map,['interceptions','passingInterceptions']);
 var rushTD=statGuess(map,['rushingTouchdowns']);
 var recTD=statGuess(map,['receivingTouchdowns']);
 var sacks=statGuess(map,['sacks','defensiveSacks']);
 function avg(v){return gp?v/gp:0}
 return{gp:gp,rec:avg(rec),recY:avg(recY),rushY:avg(rushY),passY:avg(passY),ints:avg(ints),td:avg(rushTD+recTD),combo:avg(rushY+recY),sacks:avg(sacks)}
}
function playerName(l){return['stat','td','combo','longrush','q4rush','sack'].indexOf(l[0])>=0?l[3]:''}

async function fj(u){var r=await fetch(u+(u.indexOf('?')>=0?'&':'?')+'_='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(r.status);return r.json()}
var rosterCache={};
async function getRoster(t){t=nt(t);if(rosterCache[t])return rosterCache[t];rosterCache[t]=fj(API+'/teams/'+t+'/roster').catch(function(){return null});return rosterCache[t]}
async function athleteForLeg(l,q){
 var p=playerName(l);if(!p)return'';var id=deepAthleteId(q,p);if(id)return id;
 var teams=l[1]||[];
 for(var i=0;i<teams.length;i++){try{var ro=await getRoster(teams[i]);id=deepAthleteId(ro,p);if(id)return id}catch(e){}}
 return''
}
async function loadContext(es,qs){
 var cacheKey='betpulseContext_20260927_v3',cached=null;
 try{cached=JSON.parse(localStorage.getItem(cacheKey)||'null')}catch(e){}
 if(cached&&Date.now()-cached.ts<21600000)return cached.data;
 var hist=[];try{var h=await fj(API+'/scoreboard?limit=200&dates='+HIST);hist=h.events||[]}catch(e){}
 var ta=teamAverages(hist),players={},jobs={},legs=[];
 S.forEach(function(s){s.l.forEach(function(l){if(playerName(l))legs.push(l)})});
 await Promise.all(legs.map(async function(l){
  var p=playerName(l),key=nm(p);if(jobs[key])return;jobs[key]=true;
  var e=ev(es,l[1]),q=e&&qs[e.id],id=await athleteForLeg(l,q);if(!id){players[key]=null;return}
  try{var raw=await fj(WEB+'/athletes/'+id+'/stats?season=2026&seasontype=2');players[key]=playerContextFromMap(collectStats(raw),l[0])}catch(err){players[key]=null}
 }));
 var data={teams:ta,players:players};try{localStorage.setItem(cacheKey,JSON.stringify({ts:Date.now(),data:data}))}catch(e){}
 return data
}
function tctx(t,ctx){return ctx&&ctx.teams&&ctx.teams[nt(t)]}
function pctx(p,ctx){return ctx&&ctx.players&&ctx.players[nm(p)]}
function seasonLine(l,ctx){
 var a,b,p,x;
 if(l[0]==='total'){a=tctx(l[1][0],ctx);b=tctx(l[1][1],ctx);if(a&&b)return'2026 scoring avg: '+l[1][0]+' '+fmt(a.ppg)+' + '+l[1][1]+' '+fmt(b.ppg)+' = '+fmt(a.ppg+b.ppg)+' pts/game';}
 if(l[0]==='ml'){a=tctx(l[1][0],ctx);b=tctx(l[1][1],ctx);if(a&&b)return'2026 PPG: '+l[1][0]+' '+fmt(a.ppg)+' • '+l[1][1]+' '+fmt(b.ppg);}
 if(l[0]==='spread'){a=tctx(l[1][0],ctx);b=tctx(l[1][1],ctx);if(a&&b)return'2026 avg margin: '+l[1][0]+' '+(a.margin>=0?'+':'')+fmt(a.margin)+' • '+l[1][1]+' '+(b.margin>=0?'+':'')+fmt(b.margin);}
 if(l[0]==='dst'){a=tctx(l[3],ctx);if(a)return'2026 '+l[3]+': '+fmt(a.ppg)+' scored • '+fmt(a.papg)+' allowed/game';}
 p=pctx(playerName(l),ctx);if(!p||!p.gp)return'2026 season average unavailable';
 if(l[0]==='stat'){
  if(l[4]==='receiving'&&l[5]==='REC')x=p.rec+' receptions/game';
  else if(l[4]==='receiving')x=p.recY+' receiving yds/game';
  else if(l[4]==='rushing')x=p.rushY+' rushing yds/game';
  else if(l[4]==='passing'&&l[5]==='INT')x=p.ints+' INT/game';
  else if(l[4]==='passing')x=p.passY+' passing yds/game';
  if(x)return'2026 avg: '+fmt(parseFloat(x))+' '+x.replace(/^[\d.]+\s*/,'')+' • '+p.gp+' games';
 }
 if(l[0]==='td')return'2026 avg: '+fmt(p.td)+' rushing/receiving TD/game • '+p.gp+' games';
 if(l[0]==='combo')return'2026 avg: '+fmt(p.combo)+' rush + rec yds/game • '+p.gp+' games';
 if(l[0]==='longrush')return'2026 context: '+fmt(p.rushY)+' rushing yds/game • '+p.gp+' games';
 if(l[0]==='q4rush')return'2026 context: '+fmt(p.rushY)+' full-game rushing yds/game • '+p.gp+' games';
 if(l[0]==='sack')return'2026 avg: '+fmt(p.sacks)+' sacks/game • '+p.gp+' games';
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
 if(l[0]==='sack')return'Target: 1 sack';
 return l[2]
}
function targetState(s,fin,x,target,strict){var hit=strict?x>target:x>=target;if(hit)return{state:'hit',detail:'Target reached.'};if(fin)return{state:'lost',detail:'Finished short.'};return{state:s,detail:'Needs '+(strict?(Math.floor(target)+1-x):Math.ceil(target-x))+' more.'}}
function evalLeg(l,q,e,ctx){
 var c=comp(q,e),gs=st(q,e),live=gs.v==='in',fin=gs.v==='post',pre=!live&&!fin,s=live?'live':(fin?'final':'pre'),a=score(c,l[1][0]),b=score(c,l[1][1]),v='',d='',x=0,y=0,r;
 if(pre){v=targetText(l);d=seasonLine(l,ctx);var when=e?gs.d:'Scheduled';return{x:l,s:'pre',v:v,d:d,g:l[1][0]+' @ '+l[1][1]+' · '+when,season:d}}
 if(l[0]==='total'){x=a+b;v=x+' / '+l[4];if(l[3]==='over'){if(x>l[4]){s='hit';d='Over cleared.'}else if(fin){s='lost';d='Finished short.'}else d='Needs '+(Math.floor(l[4]-x)+1)+' more total points.'}else{if(x>l[4]){s='lost';d='Under can no longer hit.'}else if(fin){s='hit';d='Final stayed under.'}else d=fmt(l[4]-x)+' points below the line.'}}
 if(l[0]==='ml'){x=l[3]===l[1][0]?a:b;y=l[3]===l[1][0]?b:a;v=l[3]+' '+x+' — '+y;if(fin){s=x>y?'hit':'lost';d=s==='hit'?'Moneyline won.':'Moneyline lost.'}else d=x>y?'Currently leading by '+(x-y)+'.':x<y?'Currently trailing by '+(y-x)+'.':'Game tied.'}
 if(l[0]==='spread'){x=l[3]===l[1][0]?a:b;y=l[3]===l[1][0]?b:a;var cv=x+l[4]-y;v=l[3]+' +'+l[4];if(fin){s=cv>0?'hit':cv===0?'push':'lost';d=cv>0?'Covered by '+fmt(cv)+'.':cv===0?'Push.':'Missed cover by '+fmt(Math.abs(cv))+'.'}else d=cv>0?'Currently covering by '+fmt(cv)+'.':cv===0?'Currently a push.':'Outside cover by '+fmt(Math.abs(cv))+'.'}
 if(l[0]==='stat'){x=ps(q,l[3],l[4],l[5]);v=x+' / '+l[6]+' '+l[7];r=targetState(s,fin,x,l[6],l[6]%1!==0);s=r.state;d=r.detail}
 if(l[0]==='combo'){x=ps(q,l[3],'rushing','YDS')+ps(q,l[3],'receiving','YDS');v=x+' / '+l[4]+' RUSH+REC YDS';r=targetState(s,fin,x,l[4],l[4]%1!==0);s=r.state;d=r.detail}
 if(l[0]==='longrush'){x=ps(q,l[3],'rushing','LONG');if(!x)x=psLabel(q,l[3],/^LONG/);v=x+' / O'+l[4]+' LONG RUSH';if(x>l[4]){s='hit';d='Longest rush cleared the line.'}else if(fin){s='lost';d='Longest rush finished at '+x+'.'}else d='Needs a rush of '+(Math.floor(l[4])+1)+'+ yards.'}
 if(l[0]==='q4rush'){x=qRush(q,l[3],4);v=x+' / '+l[4]+' Q4 RUSH YDS';if(x>=l[4]){s='hit';d='4th-quarter target reached.'}else if(fin){s='lost';d='Finished with '+x+' Q4 rushing yards.'}else d='Needs '+(l[4]-x)+' more Q4 rushing yards.'}
 if(l[0]==='sack'){x=psLabel(q,l[3],/SACK/);v=x+' / '+l[4]+' SACK';if(x>=l[4]){s='hit';d='Sack recorded.'}else if(fin){s='lost';d='No sack recorded.'}else d='Needs 1 sack.'}
 if(l[0]==='td'){x=td(q,l[3]);v=x+' / '+l[4]+' TD';if(x>=l[4]){s='hit';d='Touchdown target reached.'}else if(fin){s='lost';d='Finished with '+x+' TD.'}else d='Needs '+(l[4]-x)+' touchdown'+(l[4]-x===1?'':'s')+'.'}
 if(l[0]==='dst'){x=dst(q,l[3]);v=x+' / 1 D/ST TD';if(x){s='hit';d='D/ST touchdown detected.'}else if(fin){s='lost';d='No D/ST touchdown.'}else d='Needs a defensive/special-teams TD.'}
 var p=poss(q),info=l[1][0]+' '+a+' — '+l[1][1]+' '+b+' · '+(fin?'Final':gs.d)+(live&&p?' · 🏈 '+p:'');
 return{x:l,s:s,v:v,d:d,g:info,season:seasonLine(l,ctx)}
}
function card(o){var badge=o.s==='pre'?'UPCOMING':o.s.toUpperCase(),sl=(o.season&&o.s!=='pre')?'<div class="season">'+o.season+'</div>':'';return'<div class="card '+o.s+'"><div class="r"><div><div class="pick">'+o.x[2]+'</div><div class="game">'+o.x[1].join(' @ ')+'</div></div><span class="badge">'+badge+'</span></div><div class="metric">'+o.v+'</div><div class="detail">'+o.d+'</div>'+sl+'<div class="state">'+o.g+'</div></div>'}
function filters(){var arr=[{id:'all',txt:'All 3 Bets'}].concat(S.map(function(s){return{id:s.id,txt:s.tag+' · '+s.short,cls:s.cls}}));return'<div class="filters">'+arr.map(function(f){return'<button class="filter '+(f.cls||'')+' '+(selected===f.id?'on':'')+'" onclick="setFilter(\''+f.id+'\')">'+f.txt+'</button>'}).join('')+'</div>'}
function setFilter(id){selected=id;localStorage.setItem('betpulseFilter',id);render(lastData)}
function render(data){lastData=data;var h=filters();data.forEach(function(s){if(selected!=='all'&&selected!==s.id)return;var hit=s.a.filter(function(x){return x.s==='hit'}).length,live=s.a.filter(function(x){return x.s==='live'}).length,lost=s.a.filter(function(x){return x.s==='lost'}).length,up=s.a.filter(function(x){return x.s==='pre'}).length;s.a.sort(function(a,b){var p={live:0,hit:1,pre:2,final:3,lost:4,push:3};return(p[a.s]||3)-(p[b.s]||3)});h+='<section class="book '+s.cls+'"><div class="betlabel">'+s.tag+'</div><div class="bh"><div><div class="bn">'+s.n+'</div><div class="betmoney">'+s.w+' → '+s.p+'</div></div><div class="legcount">'+s.a.length+' legs</div></div><div class="sum"><span><b>'+hit+'</b>Hit</span><span><b>'+live+'</b>Live</span><span><b>'+lost+'</b>Lost</span><span><b>'+up+'</b>Upcoming</span></div>'+s.a.map(card).join('')+'</section>'});document.getElementById('app').innerHTML=h}
async function go(){
 if(busy)return;busy=true;document.getElementById('big').textContent='Refreshing…';document.getElementById('last').textContent='Fetching games + season context…';
 try{
  var b=await fj(API+'/scoreboard?limit=100&dates='+R),es=b.events||[],ids={};
  S.forEach(function(s){s.l.forEach(function(l){var e=ev(es,l[1]);if(e)ids[e.id]=e})});
  var qs={};await Promise.all(Object.keys(ids).map(async function(id){try{qs[id]=await fj(API+'/summary?event='+id)}catch(e){qs[id]=null}}));
  var ctx=await loadContext(es,qs);
  var data=S.map(function(s){return{id:s.id,tag:s.tag,n:s.n,w:s.w,p:s.p,cls:s.cls,a:s.l.map(function(l){var e=ev(es,l[1]);return evalLeg(l,e&&qs[e.id],e,ctx)})}});
  render(data);document.getElementById('last').textContent='Updated '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'});
  document.getElementById('note').innerHTML='<b>Fresh snapshot loaded.</b> Before kickoff, cards show 2026 per-game averages; once games start, they switch to live progress while keeping the season context underneath.';
 }catch(e){document.getElementById('last').textContent='Refresh failed';document.getElementById('note').innerHTML='<span class="err"><b>Could not reach ESPN.</b> Check service and tap Refresh again.</span>'}
 busy=false;document.getElementById('big').textContent='↻ Refresh BetPulse'
}
go();