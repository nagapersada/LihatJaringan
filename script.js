const supabaseUrl = 'https://hysjbwysizpczgcsqvuv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5c2pid3lzaXpwY3pnY3NxdnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjA2MTYsImV4cCI6MjA3OTQ5NjYxNn0.sLSfXMn9htsinETKUJ5IAsZ2l774rfeaNNmB7mVQcR4';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let globalData=[], myTeamData=[], globalHistory=[], globalAchievers=[], globalFailures=[], sortState={col:'joinDate',dir:'asc'};
let vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
let achieverTxtContent = "";

// VARIABEL GLOBAL
let currentGap = 0; 
let globalTarget = 0;

document.addEventListener('DOMContentLoaded',async()=>{const a=window.location.pathname,b=sessionStorage.getItem('isLoggedIn');if(!b&&!a.includes('index.html')){window.location.href='index.html';return}if(b)await loadData();if(a.includes('index.html'))document.getElementById('loginButton').addEventListener('click',doLogin);else if(a.includes('dashboard.html'))renderDashboard();else if(a.includes('list.html')){prepareMyTeamData();initList()}else if(a.includes('network.html')){prepareMyTeamData();initNetwork()}});

// [FITUR TURBO & AMAN] LOAD DATA PARALEL
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

        if (historyRes.data) globalHistory = historyRes.data;
        if (achieverRes.data) globalAchievers = achieverRes.data;
        if (failureRes.data) globalFailures = failureRes.data;

        rankCache = {}; histRankCache = {}; downlineCache = {};

    } catch (a) {
        console.error("Login Error:", a);
        alert("Gagal memuat data. Cek koneksi internet.");
    }
}

let rankCache = {}; let histRankCache = {}; let downlineCache = {};

function prepareMyTeamData(){const a=sessionStorage.getItem('userUid'),b=globalData.find(b=>b.uid===a);if(b){const c=getDownlinesRecursive(a);myTeamData=[b,...c]}}

function getDownlinesRecursive(uid){
    if(downlineCache[uid]) return downlineCache[uid];
    let b=[];
    const c=globalData.filter(b=>b.upline===uid);
    c.forEach(a=>{ b.push(a); b=b.concat(getDownlinesRecursive(a.uid)); });
    downlineCache[uid] = b;
    return b;
}

function getTotalGroupCount(a){const b=getDownlinesRecursive(a);return 1+b.length}

async function doLogin(){
    const a=document.getElementById('loginUid').value.trim(),b=document.getElementById('loginButton'),c=document.getElementById('error');
    if(!a)return void(c.innerText="Masukkan UID");
    b.innerText="..."; b.disabled=!0; c.innerText="";
    await loadData(); 
    const d=globalData.find(m=>m.uid===a);
    if(d){
        sessionStorage.setItem('isLoggedIn','true');
        sessionStorage.setItem('userUid',d.uid);
        window.location.href='dashboard.html';
    } else {
        c.innerText="UID Tidak Terdaftar"; b.innerText="MASUK"; b.disabled=!1;
    }
}

function logout(){sessionStorage.clear(),window.location.href='index.html'}

function renderDashboard(){
    const a=sessionStorage.getItem('userUid');if(!globalData.length)return void location.reload();const b=globalData.find(b=>b.uid===a);if(!b)return logout();
    document.getElementById('mName').innerText=b.name,document.getElementById('mUid').innerText=b.uid;const c=globalData.find(a=>a.uid===b.upline);document.getElementById('mRefUid').innerText=c?c.uid:'-';
    
    rankCache = {}; 
    const d=getDownlinesRecursive(a),e=1+d.length;
    document.getElementById('totalMembers').innerText=e;
    const f=globalData.filter(b=>b.upline===a).length;
    calculateMyRank(e,f,b.uid);
    const g=[b,...d];
    myTeamData = g; 
    countVipStats(g); 
    
    const h=new Date,i=h.getDate(),j=h.getMonth(),k=h.getFullYear();let l,m,n;
    let countDownTarget;
    let chartStartPrev, chartEndPrev;

    let prevM = j - 1, prevY = k;
    if (prevM < 0) { prevM = 11; prevY--; }
    const daysInPrevMonth = new Date(prevY, prevM + 1, 0).getDate();

    if (i === 31) {
        l = new Date(k, j, 31); m = new Date(k, j, 30, 23, 59, 59);
        n = "PERIODE 1 (JAN 2026)"; countDownTarget = new Date(k, j + 1, 15, 23, 59, 59);
        chartStartPrev = new Date(k, j, 16); chartEndPrev = new Date(k, j, 30, 23, 59, 59);
    } else if (i <= 15) {
        l = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 31) : new Date(k, j, 1);
        m = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 30, 23, 59, 59) : new Date(k, j, 0, 23, 59, 59);
        n = `PERIODE 1 (${getMonthName(j)} ${k})`; countDownTarget = new Date(k, j, 15, 23, 59, 59);
        chartStartPrev = new Date(prevY, prevM, 16); chartEndPrev = m;
    } else {
        l = new Date(k, j, 16); m = new Date(k, j, 15, 23, 59, 59);
        n = `PERIODE 2 (${getMonthName(j)} ${k})`; countDownTarget = new Date(k, j, 30, 23, 59, 59);
        chartStartPrev = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 31) : new Date(k, j, 1);
        chartEndPrev = new Date(k, j, 15, 23, 59, 59);
    }
    
    document.getElementById('currentPeriodLabel').innerText=n;
    startCountdown(countDownTarget);
    showMotivation();

    const baseCount = g.filter(a => a.joinDate <= m).length;
    const growCount = g.filter(a => a.joinDate >= l).length;
    const targetVal = Math.ceil(baseCount / 2);
    let gap = targetVal - growCount; if(gap < 0) gap = 0;
    
    currentGap = gap; globalTarget = targetVal; 
    document.getElementById('prevPeriodCount').innerText = baseCount;
    document.getElementById('targetCount').innerText = targetVal;
    document.getElementById('newMemberCount').innerText = growCount;
    document.getElementById('gapCount').innerText = gap;

    const chartGrowthPrev = g.filter(a => a.joinDate >= chartStartPrev && a.joinDate <= chartEndPrev).length;
    renderChart(chartGrowthPrev, growCount);
}

function renderChart(prevVal, currVal){
    const ctx = document.getElementById('growthChart').getContext('2d');
    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['LALU', 'SAAT INI'],
            datasets: [{ label: 'Growth', data: [prevVal, currVal], backgroundColor: ['#333', '#D4AF37'], borderColor: '#D4AF37', borderWidth: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#333' }, ticks: { display: false } }, x: { grid: { display: false }, ticks: { color: '#888', font: { size: 10 } } } }, plugins: { legend: { display: false } } }
    });
}

function getRankLevel(uid){
    if (rankCache[uid] !== undefined) return rankCache[uid];
    const team = [globalData.find(m => m.uid === uid), ...getDownlinesRecursive(uid)];
    const direct = globalData.filter(b=>b.upline===uid).length;
    const rankTiers = [{level:9,min:3501,req:8},{level:8,min:1601,req:7},{level:7,min:901,req:6},{level:6,min:501,req:5},{level:5,min:351,req:4},{level:4,min:201,req:3},{level:3,min:101,req:2},{level:2,min:31,req:1}];
    let res = (direct >= 5) ? 1 : 0;
    for(const t of rankTiers) {
        if (team.length >= t.min) {
            const paths = globalData.filter(m=>m.upline===uid).filter(d => {
                const branch = [d, ...getDownlinesRecursive(d.uid)];
                return branch.some(m => getRankLevel(m.uid) >= t.req);
            }).length;
            if (paths >= 2 || globalAchievers.filter(a => a.uid === uid).length >= 2) { res = t.level; break; }
        }
    }
    rankCache[uid] = res; return res;
}

function getHistoricalRankLevel(uid, cutoffDate) {
    const team = [globalData.find(m => m.uid === uid), ...getDownlinesRecursive(uid)].filter(m => m.joinDate <= cutoffDate);
    const direct = globalData.filter(b => b.upline === uid && b.joinDate <= cutoffDate).length;
    return (direct >= 5) ? 1 : 0;
}

function countVipStats(a){
    rankCache = {}; let b={1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0}; vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
    a.forEach(m=>{
        let c=getRankLevel(m.uid);
        if(c>=1&&c<=9){ b[c]++; vipLists[c].push(m); }
    });
    for(let i=1;i<=9;i++){ const el=document.getElementById(`cVIP${i}`); if(el) el.innerText=b[i]; }
}

window.openVipModal = function(level) {
    const modal = document.getElementById('vipModal'), body = document.getElementById('modalBody'), title = document.getElementById('modalTitle');
    const h=new Date(), i=h.getDate(), j=h.getMonth(), k=h.getFullYear();
    let l, m;
    let prevM = j - 1, prevY = k; if (prevM < 0) { prevM = 11; prevY--; }
    const daysInPrevMonth = new Date(prevY, prevM + 1, 0).getDate();

    if (i === 31) { l = new Date(k, j, 31); m = new Date(k, j, 30, 23, 59, 59); }
    else if (i <= 15) {
        l = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 31) : new Date(k, j, 1);
        m = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 30, 23, 59, 59) : new Date(k, j, 0, 23, 59, 59);
    } else { l = new Date(k, j, 16); m = new Date(k, j, 15, 23, 59, 59); }

    title.innerText = `DAFTAR V.I.P ${level}`; body.innerHTML = ''; 
    let sorted = [...vipLists[level]].sort((a, b) => {
        const hA = globalHistory.find(x=>x.uid===a.uid && x.vip_level===level);
        const hB = globalHistory.find(x=>x.uid===b.uid && x.vip_level===level);
        return (hB ? new Date(hB.achieved_at) : 0) - (hA ? new Date(hA.achieved_at) : 0);
    });

    if (sorted.length > 0) {
        sorted.forEach(mem => {
            const dls = getDownlinesRecursive(mem.uid);
            const base = dls.filter(d => d.joinDate <= m).length + 1;
            const grow = dls.filter(d => d.joinDate >= l).length;
            const target = Math.ceil(base / 2);
            const sisa = Math.max(0, target - grow);
            body.innerHTML += `<div class="v-item" style="flex-direction:column; align-items:flex-start;">
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <span class="v-n">${mem.name}</span><span class="v-u">${mem.uid}</span>
                </div>
                <div style="font-size:10px; color:#888; margin-top:4px;">Target: ${target} - Capai: <b style="color:var(--gold);">${grow}</b> - Sisa: <b style="color:${sisa > 0 ? '#ff4d4d' : '#00ff00'};">${sisa}</b></div>
            </div>`;
        });
    } else { body.innerHTML = '<div class="v-empty">Belum ada anggota.</div>'; }
    modal.style.display = 'flex';
}
window.closeVipModal = function() { document.getElementById('vipModal').style.display = 'none'; }

function calculateMyRank(size, direct, uid) {
    const lvl = getRankLevel(uid);
    document.getElementById('rankName').innerText = lvl > 0 ? "V.I.P " + lvl : "MEMBER";
    document.getElementById('rankNextGoal').innerText = lvl < 9 ? "Menuju V.I.P " + (lvl + 1) : "Top Level";
}

function initNetwork(){
    const b=go.GraphObject.make, c=b(go.Diagram,"networkDiagram",{padding:new go.Margin(150),layout:b(go.TreeLayout,{angle:0,layerSpacing:60})});
    c.nodeTemplate=b(go.Node,"Horizontal",b(go.Panel,"Auto",b(go.Shape,"RoundedRectangle",{fill:"#000",stroke:"#D4AF37"}),b(go.TextBlock,{margin:5,stroke:"#fff"},new go.Binding("text","label"))));
    c.model=new go.GraphLinksModel(myTeamData.map(m=>({key:m.uid, label:m.name})), myTeamData.filter(m=>m.upline).map(m=>({from:m.upline,to:m.uid})));
}

function openAchieverModal() {
    const modal = document.getElementById('achieverModal'), body = document.getElementById('achieverBody'), title = document.getElementById('achieverTitle'), btnDl = document.getElementById('btnDlAchiever');
    modal.style.display = 'flex'; body.innerHTML = 'Memproses...';
    const h=new Date(), i=h.getDate(), j=h.getMonth(), k=h.getFullYear();
    let l, m, plabel, baseCut;
    let prevM = j - 1, prevY = k; if (prevM < 0) { prevM = 11; prevY--; }
    const daysInPrevMonth = new Date(prevY, prevM + 1, 0).getDate();

    if (i >= 16 && i <= 30) {
        l = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 31) : new Date(k, j, 1);
        m = new Date(k, j, 15, 23, 59, 59);
        baseCut = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 30, 23, 59, 59) : new Date(k, j, 0, 23, 59, 59);
        plabel = "PERIODE 1";
    } else {
        l = new Date(prevY, prevM, 16); m = new Date(prevY, prevM, 30, 23, 59, 59);
        baseCut = new Date(prevY, prevM, 15, 23, 59, 59); plabel = "PERIODE 2";
    }

    title.innerText = `REPORT ${plabel}`;
    setTimeout(() => {
        let sList = [], fList = [];
        myTeamData.forEach(mem => {
            const dls = getDownlinesRecursive(mem.uid);
            const baseCount = dls.filter(d => d.joinDate <= baseCut).length + 1;
            const growCount = dls.filter(d => d.joinDate >= l && d.joinDate <= m).length;
            const targetVal = Math.ceil(baseCount / 2);
            if (getRankLevel(mem.uid) >= 1 && targetVal > 0) {
                if (growCount >= targetVal) sList.push({name: mem.name, target: targetVal, actual: growCount});
                else fList.push({name: mem.name, target: targetVal, actual: growCount});
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

function getMonthName(a){return["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"][a]}
function startCountdown(t){if(window.iv)clearInterval(window.iv);window.iv=setInterval(()=>{const d=t-new Date();if(d<0)return;document.getElementById('cdDays').innerText=Math.floor(d/864e5).toString().padStart(2,'0');document.getElementById('cdHours').innerText=Math.floor((d%864e5)/36e5).toString().padStart(2,'0');document.getElementById('cdMin').innerText=Math.floor((d%36e5)/6e4).toString().padStart(2,'0');document.getElementById('cdSec').innerText=Math.floor((d%6e4)/1e3).toString().padStart(2,'0')},1000)}

// KEMBALIKAN SISA FUNGSI MOTIVASI & TOOLKIT ASLI
const wordBank = { openings: ["🔥 SAYA SIAP BERTEMPUR!", "⚠️ PERINGATAN KERAS!", "🚀 JANGAN LENGAH!", "🦁 BANGKITLAH PEMENANG!"], conditions: ["Hari ini musuhmu sedang bekerja keras,", "Target tidak akan menunggu kamu siap,"], actions: ["maka HANCURKAN rasa malasmu sekarang!", "segera RAPATKAN BARISAN!"], closings: ["PASTI BISA!", "GASPOLL!"] };
function generateDynamicQuote() { const r = (arr) => arr[Math.floor(Math.random() * arr.length)]; return `"${r(wordBank.openings)} ${r(wordBank.conditions)} ${r(wordBank.actions)} ${r(wordBank.closings)}"`; }
function showMotivation() { document.getElementById('motivationModal').style.display = 'flex'; document.getElementById('dailyMotivation').innerText = generateDynamicQuote(); }
window.closeMotivation = function() { document.getElementById('motivationModal').style.display = 'none'; }
function initList(){window.sortData=a=>{renderTable()};renderTable()}
function renderTable(){const a=document.getElementById('membersTableBody');a.innerHTML=myTeamData.map((m,i)=>`<tr><td class="col-no">${i+1}</td><td class="col-name">${m.name}</td><td class="col-uid">${m.uid}</td><td class="col-ref">${m.upline||'-'}</td><td class="col-date">${m.joinDate.toLocaleDateString()}</td></tr>`).join('')}

const groupWords = { headers: ["🔥 UPDATE MEMBARA", "🚀 INFO PENTING TIM"], intros: ["Keberhasilan tim bukan dinilai dari seberapa cepat kita berlari."], alerts: ["Tetap fokus pada pertumbuhan 50%"], closings: ["Gow .. Gaaaaass sampai tembus..!! 💪🏻"] };
window.openShareModal = function() { generateShareText(); document.getElementById('shareModal').style.display = 'flex'; }
window.generateShareText = function() { 
    const txtArea = document.getElementById('shareText'); const now = new Date(); 
    txtArea.value = `🔥 UPDATE DVTEAM NP\n📅 ${now.toLocaleDateString()}\n👥 Target 50%: ${globalTarget}\n🚀 Sisa: ${currentGap} lagi!!\nPASTI BISA!`; 
}
window.copyShareText = function() { const txtArea = document.getElementById('shareText'); txtArea.select(); document.execCommand('copy'); alert("✅ Teks disalin!"); }
window.closeShareModal = function() { document.getElementById('shareModal').style.display = 'none'; }
