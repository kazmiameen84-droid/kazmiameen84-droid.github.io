window.__p=1;
// ==========================================
// REDLINE 2.2 — CORE ENGINE
// Existing rl2-* storage keys are retained.
// ==========================================
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromKey=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
const todayKey=()=>dateKey(new Date());
const addDays=(key,n)=>{const d=fromKey(key);d.setDate(d.getDate()+n);return dateKey(d)};
const read=(key,fallback)=>{try{const v=localStorage.getItem('rl2-'+key);return v===null?fallback:JSON.parse(v)}catch(e){return fallback}};
const write=(key,value)=>{try{localStorage.setItem('rl2-'+key,JSON.stringify(value))}catch(e){console.warn('Storage write failed',e)}};

let tasks=read('tasks',[]),cats=read('cats',['Study','Personal','Fitness','Other']);
let focus=read('focus',{}),exams=read('exams',[]),notes=read('notes',{}),events=read('events',[]);
let xp=Number(read('xp',0))||0,coins=Number(read('coins',0))||0;
let xpAwards=read('xpAwards',{}),owned=read('owned',['default']),avatar=read('avatar','default');
let challenges=read('challenges',[]),completedDays=read('completedDays',[]);
let weeklyGoal=Number(read('goal',20))||20;
let tab='today',selectedDate=todayKey(),calendarMonth=new Date(),calendarView='month';
let calendarSearch='',calendarFilter='All',selectedEventColor='#78aaff',editingNote=false;
let timerLength=Number(read('timerLength',1500))||1500,timerLeft=timerLength,timerEndAt=Number(read('timerEndAt',0))||0,timerId=null;
let timerRunning=timerEndAt>Date.now();
let currentQuote=read('quote',0);
let theme=read('theme','dark');
let profileName=String(read('profileName','Operator')||'Operator');
let reducedMotion=Boolean(read('reducedMotion',false));

const NAV=[['today','⌂','Today'],['calendar','▦','Plan'],['focus','◷','Focus'],['progress','↗','Progress'],['more','☷','More'],['settings','⚙','Settings']];
const COLORS=['#78aaff','#55d6a2','#f04459','#f4c16b','#b99cff','#ff91c8','#69d8dc','#b2b6c2'];
const QUOTES=['Discipline beats motivation.','Small steps. Serious results.','You do not need to be perfect. You need to be consistent.','Your future is built by what you do today.','Start before you feel ready.','One focused hour can change your day.','Stop waiting. Start doing.','Make your actions match your ambitions.','Consistency creates confidence.','Do the work. Let the results speak.','Progress is still progress, no matter how small.','Your only competition is who you were yesterday.','A little every day adds up.','Stay patient. Stay disciplined.','You can restart as many times as you need.','Make today count.','Focus on the next step, not the whole staircase.','Hard work is a habit, not a mood.','Build a life you are proud of.','Less excuses. More execution.'];


function save(){
write('tasks',tasks);write('cats',cats);write('focus',focus);write('exams',exams);write('notes',notes);write('events',events);
write('xp',xp);write('coins',coins);write('xpAwards',xpAwards);write('owned',owned);write('avatar',avatar);
write('challenges',challenges);write('completedDays',completedDays);write('goal',weeklyGoal);write('timerEndAt',timerEndAt);write('timerLength',timerLength);write('profileName',profileName);write('reducedMotion',reducedMotion);
}
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(window.toastTimeout);window.toastTimeout=setTimeout(()=>el.classList.remove('show'),2300)}
function level(){return Math.floor(xp/100)+1}
function levelXP(){return xp%100}
function awardXP(amount){xp+=amount;save();toast(`+${amount} XP`)}
function completedCount(){return tasks.filter(t=>t.done).length}
function dayTasks(key){return tasks.filter(t=>t.date===key)}
function streak(){let count=0,d=new Date();if(!completedDays.includes(dateKey(d)))d.setDate(d.getDate()-1);while(completedDays.includes(dateKey(d))){count++;d.setDate(d.getDate()-1)}return count}
function formatDate(key,options={weekday:'short',month:'short',day:'numeric'}){return fromKey(key).toLocaleDateString('en-IN',options)}
function formatTime(time){if(!time)return '';const [h,m]=time.split(':').map(Number);return new Date(2000,0,1,h,m).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})}
function go(next){tab=next;render()}
function chooseDate(key){selectedDate=key;editingNote=false;render()}
function toggleTheme(){theme=theme==='dark'?'light':'dark';write('theme',theme);applyTheme()}
function applyTheme(){document.documentElement.dataset.theme=theme;$('themeToggle').textContent=theme==='dark'?'☀':'☾';$('themeToggle').title=theme==='dark'?'Switch to light mode':'Switch to dark mode';document.documentElement.classList.toggle('reduce-motion',reducedMotion);document.documentElement.style.setProperty('--motion-duration',reducedMotion?'0ms':'200ms')}
function saveProfile(){const value=$('profileNameInput').value.trim();profileName=value||'Operator';save();renderSettings();toast('Profile updated')}
function setReducedMotion(value){reducedMotion=Boolean(value);write('reducedMotion',reducedMotion);applyTheme();toast(reducedMotion?'Reduced motion enabled':'Animations enabled')}

// TASKS
function openTaskModal(){$('taskModal').classList.add('show');$('taskDate').value=selectedDate;$('taskCat').innerHTML=cats.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');$('taskName').value='';$('taskPri').value='0';$('taskRep').value='none'}
function closeTaskModal(){$('taskModal').classList.remove('show')}
function ensureRecurringSchedule(){
const roots=tasks.filter(t=>t.rep&&t.rep!=='none'&&!t.generated);
roots.forEach(root=>{if(!root.seriesId)root.seriesId=root.id;const start=fromKey(root.date),end=new Date(start.getFullYear(),11,31);
for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const diff=Math.round((d-start)/86400000),matches=root.rep==='daily'||(root.rep==='weekly'&&diff%7===0);if(!matches||diff===0)continue;const key=dateKey(d);if(!tasks.some(t=>t.seriesId===root.seriesId&&t.date===key))tasks.push({...root,id:Date.now()+Math.random(),date:key,done:false,generated:true})}
})}
function addTask(){const text=$('taskName').value.trim(),date=$('taskDate').value;if(!text||!date){toast('Enter a task and date');return}
const task={id:Date.now()+Math.random(),text,date,cat:$('taskCat').value,pri:Number($('taskPri').value),rep:$('taskRep').value,done:false,generated:false,seriesId:null};
if(task.rep!=='none')task.seriesId=task.id;tasks.push(task);ensureRecurringSchedule();save();closeTaskModal();render();toast('Task added')}
function toggleTask(id){const task=tasks.find(t=>t.id==id);if(!task)return;task.done=!task.done;task.doneAt=task.done?new Date().toISOString():null;
if(task.done&&!xpAwards[String(task.id)]){xpAwards[String(task.id)]=true;awardXP(10)}
const todays=dayTasks(todayKey());if(todays.length&&todays.every(t=>t.done)&&!completedDays.includes(todayKey())){completedDays.push(todayKey());awardXP(20);toast('Perfect day! +20 XP')}
save();render()}
function deleteTask(id){const task=tasks.find(t=>t.id==id);if(!task)return;if(task.seriesId){tasks=tasks.filter(t=>t.seriesId!==task.seriesId||t.date<task.date||t.done);tasks.forEach(t=>{if(t.seriesId===task.seriesId)t.rep='none'})}else tasks=tasks.filter(t=>t.id!=id);save();render();toast('Task deleted')}

// FOCUS TIMER
function updateTimer(){if(timerRunning){timerLeft=Math.max(0,Math.ceil((timerEndAt-Date.now())/1000));if(timerLeft<=0){timerRunning=false;timerEndAt=0;const key=todayKey();focus[key]=(focus[key]||0)+timerLength;awardXP(25);save();clearInterval(timerId);timerId=null;toast('Focus session complete!')}}if(tab==='focus')renderFocus()}
function startTimer(){if(timerRunning)return;if(timerLeft<=0)timerLeft=timerLength;timerEndAt=Date.now()+timerLeft*1000;timerRunning=true;save();clearInterval(timerId);timerId=setInterval(updateTimer,1000);render()}
function pauseTimer(){if(!timerRunning)return;timerLeft=Math.max(0,Math.ceil((timerEndAt-Date.now())/1000));timerRunning=false;timerEndAt=0;clearInterval(timerId);timerId=null;save();render()}
function resetTimer(){timerRunning=false;timerEndAt=0;timerLeft=timerLength;clearInterval(timerId);timerId=null;save();render()}
function setTimer(minutes){if(timerRunning)return;timerLength=minutes*60;timerLeft=timerLength;save();render()}
function timerText(){return `${pad(Math.floor(timerLeft/60))}:${pad(timerLeft%60)}`}
function totalFocus(key){return Math.floor((focus[key]||0)/60)}

// NOTES, QUOTES, EXAMS
function saveNote(){const value=$('noteInput').value.trim();if(value)notes[selectedDate]=value;else delete notes[selectedDate];editingNote=false;save();render();toast('Note saved')}
function editNote(){editingNote=true;render();setTimeout(()=>$('noteInput')?.focus(),50)}
function cancelNoteEdit(){editingNote=false;render()}
function newQuote(){currentQuote=(currentQuote+1+Math.floor(Math.random()*(QUOTES.length-1)))%QUOTES.length;write('quote',currentQuote);render()}
function addExam(){const name=$('examName')?.value.trim(),date=$('examDate')?.value;if(!name||!date){toast('Enter exam name and date');return}exams.push({id:Date.now(),name,date});save();render();toast('Exam added')}
function deleteExam(id){exams=exams.filter(e=>e.id!=id);save();render()}

// CALENDAR
function setCalendarView(view){calendarView=view;render()}
function changeCalendar(amount){if(calendarView==='month')calendarMonth.setMonth(calendarMonth.getMonth()+amount);else{selectedDate=addDays(selectedDate,amount*(calendarView==='week'?7:1));calendarMonth=fromKey(selectedDate)}render()}
function calendarToday(){selectedDate=todayKey();calendarMonth=new Date();render()}
function setCalendarFilter(v){calendarFilter=v;render()}
function setCalendarSearch(v){calendarSearch=v;const pos=$('calendarSearch')?.selectionStart;render();const el=$('calendarSearch');if(el){el.focus();el.setSelectionRange(pos,pos)}}
function eventMatchesDate(e,key){if(key<e.date)return false;const repeat=e.repeat||'none';if(repeat==='none')return key>=e.date&&key<=(e.endDate||e.date);if(e.repeatUntil&&key>e.repeatUntil)return false;const start=fromKey(e.date),cur=fromKey(key);if(repeat==='daily')return true;if(repeat==='weekly')return Math.round((cur-start)/86400000)%7===0;if(repeat==='monthly')return cur.getDate()===start.getDate();if(repeat==='yearly')return cur.getMonth()===start.getMonth()&&cur.getDate()===start.getDate();return false}
function eventsOn(key){return events.filter(e=>eventMatchesDate(e,key)).filter(e=>calendarFilter==='All'||e.category===calendarFilter).filter(e=>!calendarSearch||(e.name+' '+(e.location||'')+' '+(e.description||'')).toLowerCase().includes(calendarSearch.toLowerCase()))}
function openEventModal(id=null){const e=id?events.find(x=>x.id==id):null;$('eventModalTitle').textContent=e?'Edit event':'Create event';$('eventEditId').value=e?e.id:'';$('eventName').value=e?.name||'';$('eventDate').value=e?.date||selectedDate;$('eventEndDate').value=e?.endDate||e?.date||selectedDate;$('eventTime').value=e?.time||'09:00';$('eventEndTime').value=e?.endTime||'10:00';$('eventLocation').value=e?.location||'';$('eventDescription').value=e?.description||'';$('eventCategory').value=e?.category||'Personal';$('eventRepeat').value=e?.repeat||'none';selectedEventColor=e?.color||COLORS[0];$('eventColors').innerHTML=COLORS.map(c=>`<button type="button" class="color-choice ${c===selectedEventColor?'active':''}" style="background:${c}" onclick="chooseEventColor('${c}',this)"></button>`).join('');$('eventModal').classList.add('show')}
function chooseEventColor(color,button){selectedEventColor=color;document.querySelectorAll('.color-choice').forEach(b=>b.classList.remove('active'));button.classList.add('active')}
function closeEventModal(){$('eventModal').classList.remove('show')}
function saveEvent(){const name=$('eventName').value.trim(),date=$('eventDate').value,endDate=$('eventEndDate').value||date,time=$('eventTime').value,endTime=$('eventEndTime').value;if(!name||!date||!time||!endTime){toast('Fill in the title, date and times');return}if(endDate<date||(endDate===date&&endTime<=time)){toast('End must be after start');return}
const oldId=$('eventEditId').value,e={id:oldId?oldId:Number(Date.now()),name,date,endDate,time,endTime,location:$('eventLocation').value.trim(),description:$('eventDescription').value.trim(),category:$('eventCategory').value,color:selectedEventColor,repeat:$('eventRepeat').value};
if(oldId){const i=events.findIndex(x=>x.id==oldId);if(i>=0)events[i]=e}else events.push(e);save();closeEventModal();render();toast(oldId?'Event updated':'Event created')}
function deleteEvent(id){events=events.filter(e=>e.id!=id);save();render();toast('Event deleted')}
function moveEventDate(id,newDate){const e=events.find(x=>x.id==id);if(!e)return;const duration=Math.round((fromKey(e.endDate||e.date)-fromKey(e.date))/86400000);e.date=newDate;e.endDate=addDays(newDate,duration);save();render();toast('Event rescheduled')}
function eventConflicts(e){return events.some(o=>o.id!=e.id&&o.date===e.date&&e.time<o.endTime&&e.endTime>o.time)}
function allowDrop(e){e.preventDefault()}
function dragEvent(e,id){e.dataTransfer.setData('text/plain',String(id))}
function dropEvent(e,date){e.preventDefault();const id=e.dataTransfer.getData('text/plain');if(id)moveEventDate(id,date)}
