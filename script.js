const supabaseUrl = 'https://hysjbwysizpczgcsqvuv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5c2pid3lzaXpwY3pnY3NxdnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjA2MTYsImV4cCI6MjA3OTQ5NjYxNn0.sLSfXMn9htsinETKUJ5IAsZ2l774rfeaNNmB7mVQcR4';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let globalData=[], myTeamData=[], globalHistory=[], globalAchievers=[], globalFailures=[], sortState={col:'joinDate',dir:'asc'};
let vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
let achieverTxtContent = "";
let currentGap = 0; 
let globalTarget = 0;

document.addEventListener('DOMContentLoaded',async()=>{const a=window.location.pathname,b=sessionStorage.getItem('isLoggedIn');if(!b&&!a.includes('index.html')){window.location.href='index.html';return}if(b)await loadData();if(a.includes('index.html'))document.getElementById('loginButton').addEventListener('click',doLogin);else if(a.includes('dashboard.html'))renderDashboard();else if(a.includes('list.html')){prepareMyTeamData();initList()}else if(a.includes('network.html')){prepareMyTeamData();initNetwork()}});

async function loadData() {
    try {
        const [membersRes, historyRes, achieverRes, failureRes] = await Promise.all([
            db.from('members').select('*'),
            db.from('vip_history').select('*'),
            db.from('achiever_history').select('*'),
            db.from('failure_history').select('*')
        ]);
        if (membersRes.error) throw membersRes.error;
        globalData = membersRes.data.map(a => ({
            uid: String(a.UID || a.uid).trim(),
            name: (a.Nama || a.nama || a.name || '-').trim(),
            upline: a.Upline || a.upline ? String(a.Upline || a.upline).trim() : "",
            joinDate: new Date(a.TanggalBergabung || a.tanggalbergabung || a.joinDate)
        }));
        globalHistory = historyRes.data || [];
        globalAchievers = achieverRes.data || [];
        globalFailures = failureRes.data || [];
        rankCache = {}; histRankCache = {}; downlineCache = {};
    } catch (a) { console.error("Login Error:", a); alert("Gagal memuat data."); }
}

let rankCache = {}; let histRankCache = {}; let downlineCache = {};

function prepareMyTeamData(){const a=sessionStorage.getItem('userUid'),b=globalData.find(m=>m.uid===a);if(b){myTeamData=[b,...getDownlinesRecursive(a)]}}

function getDownlinesRecursive(uid){
    if(downlineCache[uid]) return downlineCache[uid];
    let b=[];
    const c=globalData.filter(m=>m.upline===uid);
    c.forEach(a=>{ b.push(a); b=b.concat(getDownlinesRecursive(a.uid)); });
    downlineCache[uid] = b;
    return b;
}

async function doLogin(){
    const a=document.getElementById('loginUid').value.trim(),b=document.getElementById('loginButton'),c=document.getElementById('error');
    if(!a)return void(c.innerText="Masukkan UID");
    b.innerText="..."; b.disabled=!0;
    await loadData(); 
    const d=globalData.find(m=>m.uid===a);
    if(d){ sessionStorage.setItem('isLoggedIn','true'); sessionStorage.setItem('userUid',d.uid); window.location.href='dashboard.html'; } 
    else { c.innerText="UID Tidak Terdaftar"; b.innerText="MASUK"; b.disabled=!1; }
}

function logout(){sessionStorage.clear(); window.location.href='index.html'}

function renderDashboard(){
    const a=sessionStorage.getItem('userUid'); if(!globalData.length)return; const b=globalData.find(m=>m.uid===a); if(!b) return logout();
    document.getElementById('mName').innerText=b.name; document.getElementById('mUid').innerText=b.uid;
    const c=globalData.find(m=>m.uid===b.upline); document.getElementById('mRefUid').innerText=c?c.uid:'-';
    
    const d=getDownlinesRecursive(a); myTeamData = [b,...d];
    document.getElementById('totalMembers').innerText=myTeamData.length;
    calculateMyRank(myTeamData.length, globalData.filter(m=>m.upline===a).length, a);
    countVipStats(myTeamData); 
    
    const h=new Date(),i=h.getDate(),j=h.getMonth(),k=h.getFullYear();let l,m,n,countDownTarget;
    let prevM = j - 1, prevY = k; if (prevM < 0) { prevM = 11; prevY--; }
    const daysInPrevMonth = new Date(prevY, prevM + 1, 0).getDate();

    if (i === 31) {
        l = new Date(k, j, 31); m = new Date(k, j, 30, 23, 59, 59);
        n = "PERIODE 1 (BLN DEPAN)"; countDownTarget = new Date(k, j + 1, 15, 23, 59, 59);
    } else if (i <= 15) {
        l = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 31) : new Date(k, j, 1);
        m = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 30, 23, 59, 59) : new Date(k, j, 0, 23, 59, 59);
        n = `PERIODE 1 (${getMonthName(j)})`; countDownTarget = new Date(k, j, 15, 23, 59, 59);
    } else {
        l = new Date(k, j, 16); m = new Date(k, j, 15, 23, 59, 59);
        n = `PERIODE 2 (${getMonthName(j)})`; countDownTarget = new Date(k, j, 30, 23, 59, 59);
    }
    
    document.getElementById('currentPeriodLabel').innerText=n;
    startCountdown(countDownTarget);
    showMotivation();

    const base = myTeamData.filter(x => x.joinDate <= m).length;
    const grow = myTeamData.filter(x => x.joinDate >= l).length;
    const target = Math.ceil(base / 2);
    let gap = target - grow; if(gap < 0) gap = 0;
    currentGap = gap; globalTarget = target; 

    document.getElementById('prevPeriodCount').innerText = base;
    document.getElementById('targetCount').innerText = target;
    document.getElementById('newMemberCount').innerText = grow;
    document.getElementById('gapCount').innerText = gap;
    renderChart(0, grow);
}

function getRankLevel(uid){
    if (rankCache[uid] !== undefined) return rankCache[uid];
    const team = [globalData.find(m => m.uid === uid), ...getDownlinesRecursive(uid)];
    const direct = globalData.filter(m=>m.upline===uid).length;
    const rankTiers = [
        {level:9, min:3501, req:8}, {level:8, min:1601, req:7}, {level:7, min:901, req:6},
        {level:6, min:501, req:5}, {level:5, min:351, req:4}, {level:4, min:201, req:3},
        {level:3, min:101, req:2}, {level:2, min:31, req:1}
    ];
    let res = (direct >= 5) ? 1 : 0;
    for(const t of rankTiers){
        if(team.length >= t.min){
            const paths = globalData.filter(m=>m.upline===uid).filter(d => 
                [d, ...getDownlinesRecursive(d.uid)].some(m => getRankLevel(m.uid) >= t.req)
            ).length;
            const growthSuccess = globalAchievers.filter(a => a.uid === uid).length >= 2;
            if(paths >= 2 || growthSuccess) { res = t.level; break; }
        }
    }
    rankCache[uid] = res; return res;
}

function countVipStats(team){
    let counts = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0}; vipLists = {1:[],2:[],3:[],4:[],5:[],6:[],7:[],8:[],9:[]};
    team.forEach(m => { const lvl = getRankLevel(m.uid); if(lvl >= 1){ counts[lvl]++; vipLists[lvl].push(m); } });
    for(let i=1; i<=9; i++){ const el = document.getElementById(`cVIP${i}`); if(el) el.innerText = counts[i]; }
}

window.openVipModal = function(level) {
    const body = document.getElementById('modalBody');
    document.getElementById('modalTitle').innerText = `DAFTAR VIP ${level}`; body.innerHTML = '';
    const h=new Date(), i=h.getDate(), j=h.getMonth(), k=h.getFullYear();
    let l, m;
    let prevM = j - 1, prevY = k; if (prevM < 0) { prevM = 11; prevY--; }
    const daysInPrevMonth = new Date(prevY, prevM + 1, 0).getDate();
    if (i === 31) { l = new Date(k, j, 31); m = new Date(k, j, 30, 23, 59, 59); }
    else if (i <= 15) {
        l = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 31) : new Date(k, j, 1);
        m = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 30, 23, 59, 59) : new Date(k, j, 0, 23, 59, 59);
    } else { l = new Date(k, j, 16); m = new Date(k, j, 15, 23, 59, 59); }

    let list = [...vipLists[level]].sort((a,b) => {
        const hA = globalHistory.find(x=>x.uid===a.uid && x.vip_level===level);
        const hB = globalHistory.find(x=>x.uid===b.uid && x.vip_level===level);
        return (hB ? new Date(hB.achieved_at) : 0) - (hA ? new Date(hA.achieved_at) : 0);
    });

    if(!list.length) body.innerHTML = '<div class="v-empty">Belum ada data.</div>';
    else {
        list.forEach(mem => {
            const dls = getDownlinesRecursive(mem.uid);
            const target = Math.ceil((dls.filter(d => d.joinDate <= m).length + 1) / 2);
            const grow = dls.filter(d => d.joinDate >= l).length;
            const sisa = Math.max(0, target - grow);
            body.innerHTML += `<div class="v-item" style="flex-direction:column; align-items:flex-start;">
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <span class="v-n">${mem.name}</span><span class="v-u">${mem.uid}</span>
                </div>
                <div style="font-size:10px; color:#888; margin-top:4px;">Target: ${target} - Capai: <span style="color:var(--gold);">${grow}</span> - Sisa: <span style="color:${sisa > 0 ? '#ff4d4d' : '#00ff00'};">${sisa}</span></div>
            </div>`;
        });
    }
    document.getElementById('vipModal').style.display = 'flex';
}

function initNetwork(){
    const a=sessionStorage.getItem('userUid'),b=go.GraphObject.make,
    c=b(go.Diagram,"networkDiagram",{padding:new go.Margin(150),scrollMode:go.Diagram.InfiniteScroll,layout:b(go.TreeLayout,{angle:0,layerSpacing:60,nodeSpacing:10}),initialContentAlignment:go.Spot.Center});
    c.nodeTemplate=b(go.Node,"Horizontal",b(go.Panel,"Auto",b(go.Shape,"RoundedRectangle",{fill:"#000",stroke:"#D4AF37"}),b(go.TextBlock,{margin:5,stroke:"#fff"},new go.Binding("text","label"))));
    c.linkTemplate=b(go.Link,b(go.Shape,{stroke:"#fff"}));
    c.model=new go.GraphLinksModel(myTeamData.map(m=>({key:m.uid, label:m.name})), myTeamData.filter(m=>m.upline).map(m=>({from:m.upline,to:m.uid})));
}

function openAchieverModal() {
    const modal = document.getElementById('achieverModal'), body = document.getElementById('achieverBody'), btnDl = document.getElementById('btnDlAchiever');
    modal.style.display = 'flex'; body.innerHTML = 'Memproses...';
    const h=new Date(), i=h.getDate(), j=h.getMonth(), k=h.getFullYear();
    let l, m, plabel;
    if (i >= 16 && i <= 30) { l = new Date(k, j, 1); m = new Date(k, j, 15, 23, 59, 59); plabel = "PERIODE 1"; }
    else { let pM = j-1, pY = k; if(pM<0){pM=11;pY--} l = new Date(pY, pM, 16); m = new Date(pY, pM, 30, 23, 59, 59); plabel = "PERIODE 2"; }
    setTimeout(() => {
        let sList = [], fList = [];
        myTeamData.forEach(mem => {
            const dls = getDownlinesRecursive(mem.uid);
            const target = Math.ceil((dls.filter(d => d.joinDate <= l).length + 1) / 2);
            const grow = dls.filter(d => d.joinDate >= l && d.joinDate <= m).length;
            if (getRankLevel(mem.uid) >= 1 && target > 0) {
                if (grow >= target) sList.push({name: mem.name, target, actual: grow});
                else fList.push({name: mem.name, target, actual: grow});
            }
        });
        renderAchieverList(sList, fList, body, btnDl);
    }, 100);
}

function renderAchieverList(s, f, body, btn) {
    btn.style.display = 'block'; let html = '';
    if (s.length > 0) {
        html += `<div style="padding:10px; color:#00ff00; font-weight:bold;">🏆 LOLOS TARGET</div>`;
        s.forEach(a => html += `<div class="achiever-item"><b>${a.name}</b><br>Target: ${a.target} | Capai: ${a.actual}</div>`);
    }
    if (f.length > 0) {
        html += `<div style="padding:10px; color:#ff4444; font-weight:bold; margin-top:10px;">⚠️ BELUM LOLOS</div>`;
        f.forEach(a => html += `<div class="achiever-item"><b>${a.name}</b><br>Target: ${a.target} | Capai: ${a.actual}</div>`);
    }
    body.innerHTML = html || 'Tidak ada data.';
}

const wordBank = { openings: ["🔥 SAYA SIAP BERTEMPUR!", "🚀 JANGAN LENGAH!", "🦁 BANGKITLAH PEMENANG!"], conditions: ["Hari ini musuhmu sedang bekerja keras,"], actions: ["maka HANCURKAN rasa malasmu sekarang!"], closings: ["PASTI BISA!", "GASPOLL!"] };
function generateDynamicQuote() { const r = (arr) => arr[Math.floor(Math.random() * arr.length)]; return `"${r(wordBank.openings)} ${r(wordBank.conditions)} ${r(wordBank.actions)} ${r(wordBank.closings)}"`; }
function showMotivation() { const modal = document.getElementById('motivationModal'); document.getElementById('dailyMotivation').innerText = generateDynamicQuote(); modal.style.display = 'flex'; }
window.closeMotivation = () => document.getElementById('motivationModal').style.display = 'none';
window.openShareModal = () => { document.getElementById('shareText').value = `DVTEAM UPDATE\nTarget 50%: ${globalTarget}\nSisa: ${currentGap}`; document.getElementById('shareModal').style.display = 'flex'; };
window.closeShareModal = () => document.getElementById('shareModal').style.display = 'none';
window.copyShareText = () => { const t = document.getElementById('shareText'); t.select(); document.execCommand('copy'); alert("Teks disalin!"); };
function downloadAchieverData() { const b = new Blob([achieverTxtContent], {type:'text/plain'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'report.txt'; a.click(); }
function getMonthName(j){ return ["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"][j]; }
function startCountdown(t){ if(window.iv) clearInterval(window.iv); window.iv = setInterval(()=>{ const d = t - new Date(); if(d <= 0) return clearInterval(window.iv); document.getElementById('cdDays').innerText = Math.floor(d/864e5).toString().padStart(2,'0'); }, 1000); }
function calculateMyRank(size, direct, uid){ const lvl = getRankLevel(uid); document.getElementById('rankName').innerText = lvl > 0 ? `V.I.P ${lvl}` : "MEMBER"; document.getElementById('rankNextGoal').innerText = lvl < 9 ? `Menuju V.I.P ${lvl+1}` : "TOP LEVEL"; }
function renderChart(p, c){ const ctx = document.getElementById('growthChart').getContext('2d'); if(window.myChart) window.myChart.destroy(); window.myChart = new Chart(ctx, { type: 'bar', data: { labels: ['LALU', 'SAAT INI'], datasets: [{ data: [p, c], backgroundColor: ['#333', '#D4AF37'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }); }
function initList(){ renderTable() }
function renderTable(){ const a=document.getElementById('membersTableBody'); a.innerHTML=myTeamData.map((m,i)=>`<tr><td>${i+1}</td><td>${m.name}</td><td>${m.uid}</td><td>${m.upline}</td><td>${m.joinDate.toLocaleDateString()}</td></tr>`).join('') }
