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
        if (historyRes.data) globalHistory = historyRes.data;
        if (achieverRes.data) globalAchievers = achieverRes.data;
        if (failureRes.data) globalFailures = failureRes.data;
        rankCache = {}; histRankCache = {}; downlineCache = {};
    } catch (a) { console.error("Login Error:", a); alert("Gagal memuat data."); }
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
    b.innerText="..."; b.disabled=!0;
    await loadData(); 
    const d=globalData.find(m=>m.uid===a);
    if(d){ sessionStorage.setItem('isLoggedIn','true'); sessionStorage.setItem('userUid',d.uid); window.location.href='dashboard.html'; } 
    else { c.innerText="UID Tidak Terdaftar"; b.innerText="MASUK"; b.disabled=!1; }
}

function logout(){sessionStorage.clear(),window.location.href='index.html'}

function renderDashboard(){
    const a=sessionStorage.getItem('userUid');if(!globalData.length)return void location.reload();const b=globalData.find(b=>b.uid===a);if(!b)return logout();
    document.getElementById('mName').innerText=b.name,document.getElementById('mUid').innerText=b.uid;
    const c=globalData.find(a=>a.uid===b.upline);document.getElementById('mRefUid').innerText=c?c.uid:'-';
    const d=getDownlinesRecursive(a),e=1+d.length;
    document.getElementById('totalMembers').innerText=e;
    const f=globalData.filter(b=>b.upline===a).length;
    calculateMyRank(e,f,b.uid);
    myTeamData = [b,...d]; 
    countVipStats(myTeamData); 
    
    const h=new Date,i=h.getDate(),j=h.getMonth(),k=h.getFullYear();let l,m,n;
    let countDownTarget;
    let prevM = j - 1, prevY = k; if (prevM < 0) { prevM = 11; prevY--; }
    const daysInPrevMonth = new Date(prevY, prevM + 1, 0).getDate();

    if (i === 31) {
        l = new Date(k, j, 31); m = new Date(k, j, 30, 23, 59, 59); n = "PERIODE 1 (BLN DEPAN)";
        countDownTarget = new Date(k, j + 1, 15, 23, 59, 59);
    } else if (i <= 15) {
        l = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 31) : new Date(k, j, 1);
        m = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 30, 23, 59, 59) : new Date(k, j, 0, 23, 59, 59);
        n = `PERIODE 1 (${getMonthName(j)})`;
        countDownTarget = new Date(k, j, 15, 23, 59, 59);
    } else {
        l = new Date(k, j, 16); m = new Date(k, j, 15, 23, 59, 59); n = `PERIODE 2 (${getMonthName(j)})`;
        countDownTarget = new Date(k, j, 30, 23, 59, 59); 
    }
    
    document.getElementById('currentPeriodLabel').innerText=n;
    startCountdown(countDownTarget);
    showMotivation();

    const totalAccumulatedPrev = myTeamData.filter(a => a.joinDate <= m).length;
    const currentGrowth = myTeamData.filter(a => a.joinDate >= l).length;
    const target = Math.ceil(totalAccumulatedPrev / 2);
    let gap = target - currentGrowth; if(gap < 0) gap = 0;
    
    currentGap = gap; globalTarget = target;
    document.getElementById('prevPeriodCount').innerText = totalAccumulatedPrev;
    document.getElementById('targetCount').innerText = target;
    document.getElementById('newMemberCount').innerText = currentGrowth;
    document.getElementById('gapCount').innerText = gap;
    renderChart(0, currentGrowth);
}

function renderChart(prevVal, currVal){
    const ctx = document.getElementById('growthChart').getContext('2d');
    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, { type: 'bar', data: { labels: ['LALU', 'SAAT INI'], datasets: [{ label: 'Growth', data: [prevVal, currVal], backgroundColor: ['#333', '#D4AF37'], borderColor: '#D4AF37', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#333' }, ticks: { display: false } }, x: { grid: { display: false }, ticks: { color: '#888', font: { size: 10 } } } }, plugins: { legend: { display: false } } } });
}

function getRankLevel(uid){
    if (rankCache[uid] !== undefined) return rankCache[uid];
    const team = [globalData.find(m => m.uid === uid), ...getDownlinesRecursive(uid)];
    const direct = globalData.filter(b=>b.upline===uid).length;
    const v2 = team.filter(m => m.uid !== uid && rankCache[m.uid] >= 2).length;
    const v1 = team.filter(m => m.uid !== uid && rankCache[m.uid] >= 1).length;
    const tiers = [{level:9,min:3501,reqVip:2},{level:8,min:1601,reqVip:2},{level:7,min:901,reqVip:2},{level:6,min:501,reqVip:2},{level:5,min:351,reqVip:2},{level:4,min:201,reqVip:2},{level:3,min:101,reqVip:2},{level:2,min:31,reqVip:2}];
    let res = (direct >= 5) ? 1 : 0;
    for(const t of tiers) { if (team.length >= t.min) { let cv = (t.level >= 3) ? v2 : v1; if (cv >= t.reqVip) { res = t.level; break; } } }
    rankCache[uid] = res; return res;
}

function getHistoricalRankLevel(uid, cutoff) {
    const team = [globalData.find(m => m.uid === uid), ...getDownlinesRecursive(uid)].filter(m => m && m.joinDate <= cutoff);
    const direct = globalData.filter(b => b.upline === uid && b.joinDate <= cutoff).length;
    let res = (direct >= 5) ? 1 : 0;
    return res;
}

function countVipStats(a){
    let b={1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0}; vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
    a.forEach(m=>{
        let c=getRankLevel(m.uid);
        if(c>=1&&c<=9){ b[c]++; vipLists[c].push(m); }
    });
    for(let i=1;i<=9;i++){ const el=document.getElementById(`cVIP${i}`); if(el) el.innerText=b[i]; }
}

function openVipModal(level) {
    const modal = document.getElementById('vipModal'), body = document.getElementById('modalBody'), title = document.getElementById('modalTitle');
    title.innerText = `DAFTAR V.I.P ${level}`; body.innerHTML = ''; 
    vipLists[level].forEach(m => {
        body.innerHTML += `<div class="v-item"><span class="v-n">${m.name}</span><span class="v-u">${m.uid}</span></div>`;
    });
    modal.style.display = 'flex';
}
function closeVipModal() { document.getElementById('vipModal').style.display = 'none'; }

// ============================================================
// LOGIKA PERIODE 1: 31 s/d 15 | PERIODE 2: 16 s/d 30
// ============================================================
function openAchieverModal() {
    const modal = document.getElementById('achieverModal'), body = document.getElementById('achieverBody'), title = document.getElementById('achieverTitle'), btnDl = document.getElementById('btnDlAchiever');
    modal.style.display = 'flex'; body.innerHTML = '<div class="v-empty">Sedang menghitung data peraih...</div>';
    
    const now = new Date(), d = now.getDate(), m = now.getMonth(), y = now.getFullYear();
    let startP, endP, plabel, baseCutoff;

    // JIKA TGL 16-30: MENAMPILKAN PERAIH PERIODE 1 (31 s/d 15)
    if (d >= 16 && d <= 30) {
        let lastDayPrev = new Date(y, m, 0);
        // Start Periode 1 adalah tgl 31 bulan lalu (jika ada) atau tgl 1
        startP = (lastDayPrev.getDate() === 31) ? new Date(y, m - 1, 31) : new Date(y, m, 1);
        endP = new Date(y, m, 15, 23, 59, 59);
        // Dasar target (Base) adalah total anggota sebelum startP (sampai tgl 30 bulan lalu)
        baseCutoff = new Date(y, m - 1, 30, 23, 59, 59);
        plabel = `PERIODE 1 (${getMonthName(m)} ${y})`;
    } 
    // JIKA TGL 31 s/d 15: MENAMPILKAN PERAIH PERIODE 2 BULAN LALU (16 s/d 30)
    else {
        let tM = m - 1, tY = y; 
        if (d === 31) tM = m; 
        else if (tM < 0) { tM = 11; tY--; }
        startP = new Date(tY, tM, 16); 
        endP = new Date(tY, tM, 30, 23, 59, 59); 
        // Dasar target (Base) adalah total anggota sebelum startP (sampai tgl 15 bulan tersebut)
        baseCutoff = new Date(tY, tM, 15, 23, 59, 59);
        plabel = `PERIODE 2 (${getMonthName(tM)} ${tY})`;
    }

    title.innerText = `REPORT GROWTH - ${plabel}`;
    setTimeout(() => {
        let successList = [], failureList = [];
        myTeamData.forEach(mem => {
            if (mem.joinDate > endP) return;
            const dls = getDownlinesRecursive(mem.uid);
            
            // LOGIKA 50%: Total seluruh anggota + Anda sampai akhir periode lalu
            const baseCount = dls.filter(dl => dl.joinDate <= baseCutoff).length + 1;
            const growCount = dls.filter(dl => dl.joinDate >= startP && dl.joinDate <= endP).length;
            const targetVal = Math.ceil(baseCount / 2);
            const rankStatus = getHistoricalRankLevel(mem.uid, endP);

            if (targetVal > 0 && rankStatus >= 1) {
                if (growCount >= targetVal) successList.push({name: mem.name, uid: mem.uid, target: targetVal, actual: growCount, rank: rankStatus});
                else failureList.push({name: mem.name, uid: mem.uid, target: targetVal, actual: growCount, rank: rankStatus});
            }
        });
        renderAchieverList(successList, failureList, body, btnDl);
    }, 100);
}

function renderAchieverList(s, f, body, btn) {
    btn.style.display = 'block'; let html = '';
    if (s.length > 0) {
        html += `<div style="padding:10px; background:#112211; color:#00ff00; font-weight:bold; border-bottom:1px solid #333;">🏆 PERAIH TARGET (SUKSES)</div>`;
        s.forEach((a, i) => { html += `<div class="achiever-item"><div style="display:flex; justify-content:space-between;"><span class="v-n">${i+1}. ${a.name}</span><span class="v-u">${a.uid}</span></div><div style="font-size:10px; color:#888;">Target: <b>${a.target}</b> | Capaian: <b style="color:#00ff00;">${a.actual}</b></div></div>`; });
    }
    if (f.length > 0) {
        html += `<div style="padding:10px; background:#221111; color:#ff4444; font-weight:bold; border-bottom:1px solid #333; margin-top:10px;">⚠️ BELUM TERCAPAI</div>`;
        f.forEach((a, i) => { html += `<div class="achiever-item"><div style="display:flex; justify-content:space-between;"><span class="v-n">${i+1}. ${a.name}</span><span class="v-u">${a.uid}</span></div><div style="font-size:10px; color:#888;">Target: <b>${a.target}</b> | Capaian: <b style="color:#ff4444;">${a.actual}</b></div></div>`; });
    }
    body.innerHTML = html || '<div class="v-empty">Tidak ada data peraih untuk periode ini.</div>';
}

function calculateMyRank(currentTeamSize, directDownlineCount, uid) {
    const curLevel = getRankLevel(uid);
    document.getElementById('rankName').innerText = (curLevel > 0) ? `V.I.P ${curLevel}` : "MEMBER";
    document.getElementById('rankNextGoal').innerText = (curLevel < 9) ? `Menuju V.I.P ${curLevel + 1}` : "TOP LEVEL";
    document.getElementById('nextLevelGap').innerText = "-";
}

function getMonthName(a){return["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"][a]}
function startCountdown(t){ if (intervalId) clearInterval(intervalId); function u(){ const n = new Date().getTime(); const d = t.getTime() - n; if (d < 0) return; const days = Math.floor(d / 86400000); document.getElementById("cdDays").textContent=days; } u(); intervalId = setInterval(u, 1000); }
let intervalId;
function showMotivation() { document.getElementById('motivationModal').style.display = 'flex'; }
window.closeMotivation = function() { document.getElementById('motivationModal').style.display = 'none'; }
function openShareModal() { document.getElementById('shareModal').style.display = 'flex'; }
function closeShareModal() { document.getElementById('shareModal').style.display = 'none'; }
