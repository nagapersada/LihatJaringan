const supabaseUrl = 'https://hysjbwysizpczgcsqvuv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5c2pid3lzaXpwY3pnY3NxdnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjA2MTYsImV4cCI6MjA3OTQ5NjYxNn0.sLSfXMn9htsinETKUJ5IAsZ2l774rfeaNNmB7mVQcR4';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let globalData=[], myTeamData=[], globalHistory=[], globalAchievers=[], globalFailures=[], sortState={col:'joinDate',dir:'asc'};
let vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
let achieverTxtContent = "";

// VARIABEL GLOBAL DASHBOARD
let currentGap = 0; 
let globalTarget = 0;

// CONFIG PERINGKAT
// Level: Peringkat, Min: Jumlah Tim, ReqVip: Level VIP yg dibutuhkan, ReqCount: Jumlah VIP yg dibutuhkan
const RANK_RULES = [
    { level: 9, min: 3501, reqVip: 8 },
    { level: 8, min: 1601, reqVip: 7 },
    { level: 7, min: 901, reqVip: 6 },
    { level: 6, min: 501, reqVip: 5 },
    { level: 5, min: 351, reqVip: 4 },
    { level: 4, min: 201, reqVip: 3 },
    { level: 3, min: 101, reqVip: 2 },
    { level: 2, min: 31, reqVip: 1 },
    { level: 1, min: 5, reqVip: 0 }
];

document.addEventListener('DOMContentLoaded',async()=>{const a=window.location.pathname,b=sessionStorage.getItem('isLoggedIn');if(!b&&!a.includes('index.html')){window.location.href='index.html';return}if(b)await loadData();if(a.includes('index.html'))document.getElementById('loginButton').addEventListener('click',doLogin);else if(a.includes('dashboard.html'))renderDashboard();else if(a.includes('list.html')){prepareMyTeamData();initList()}else if(a.includes('network.html')){prepareMyTeamData();initNetwork()}});

// CACHE & LOADING
let rankCache = {}; 
let downlineCache = {};
let legCache = {}; // Cache untuk pengecekan jalur

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

        // Reset Cache saat data baru dimuat
        rankCache = {}; downlineCache = {}; legCache = {};

    } catch (a) {
        console.error("Load Error:", a);
        alert("Gagal memuat data. Cek koneksi internet.");
    }
}

function prepareMyTeamData(){const a=sessionStorage.getItem('userUid'),b=globalData.find(b=>b.uid===a);if(b){const c=getDownlinesRecursive(a);myTeamData=[b,...c]}}

function getDownlinesRecursive(uid){
    if(downlineCache[uid]) return downlineCache[uid];
    let b=[];
    const c=globalData.filter(b=>b.upline===uid);
    c.forEach(a=>{ b.push(a); b=b.concat(getDownlinesRecursive(a.uid)); });
    downlineCache[uid] = b;
    return b;
}

function getDirectDownlines(uid) {
    return globalData.filter(m => m.upline === uid);
}

function getTotalGroupCount(a){const b=getDownlinesRecursive(a);return 1+b.length}

// ============================================================
// LOGIKA PERINGKAT BARU (CORE)
// ============================================================

function getRankLevel(uid) {
    if (rankCache[uid] !== undefined) return rankCache[uid];

    const team = getDownlinesRecursive(uid);
    const totalTeam = team.length + 1; // +1 diri sendiri jika dihitung (biasanya tim = downline). Di sini kita pakai downline count.
    // Jika "anggota" termasuk diri sendiri, gunakan +1. Jika tidak, hapus. 
    // Berdasarkan "Total Anggota Tim" di dashboard biasanya downline. 
    // Namun aturan "5 anggota" biasanya termasuk downline saja. Kita pakai downline count.
    
    let currentLevel = 0;

    // Cek dari level tertinggi (9) ke bawah
    for (const rule of RANK_RULES) {
        if (team.length >= rule.min) {
            
            // VIP 1 Cuma butuh jumlah
            if (rule.level === 1) {
                currentLevel = 1;
                break;
            }

            // Level > 1 butuh Syarat Struktur ATAU Growth
            // 1. Cek Struktur (2 Jalur Berbeda)
            const hasStructure = checkStructureCondition(uid, rule.reqVip);
            
            if (hasStructure) {
                currentLevel = rule.level;
                break;
            }

            // 2. Jika Struktur Gagal, Cek Growth (50% 2x berturut-turut)
            const hasGrowth = checkGrowthCondition(uid, team, rule.min);
            
            if (hasGrowth) {
                currentLevel = rule.level;
                break;
            }
        }
    }

    rankCache[uid] = currentLevel;
    return currentLevel;
}

// Cek apakah memiliki 2 kaki berbeda yang mengandung minimal VIP Level X
function checkStructureCondition(uid, requiredVipLevel) {
    const cacheKey = `${uid}_leg_${requiredVipLevel}`;
    if (legCache[cacheKey] !== undefined) return legCache[cacheKey];

    const directs = getDirectDownlines(uid);
    let qualifiedLegs = 0;

    for (const direct of directs) {
        // Cek apakah direct ini atau downline-nya ada yang memenuhi syarat
        if (legHasVip(direct.uid, requiredVipLevel)) {
            qualifiedLegs++;
        }
        if (qualifiedLegs >= 2) break;
    }

    const result = (qualifiedLegs >= 2);
    legCache[cacheKey] = result;
    return result;
}

// Rekursif cek apakah dalam satu kaki ada yang levelnya >= target
function legHasVip(uid, targetLevel) {
    // Cek level user ini dulu (TAPI hati-hati infinite recursion, gunakan versi simple atau cache)
    // Kita panggil getRankLevel secara rekursif. 
    // Agar tidak loop, pastikan logika base case (member count) dijalankan dulu di getRankLevel.
    
    // Optimasi: Jika member count dia kurang dari syarat minimal targetLevel, skip satu kaki ini (kecuali ada upline placement, tapi asumsi murni tree).
    // Kita gunakan rankCache jika ada.
    
    if (getRankLevel(uid) >= targetLevel) return true;

    const directs = getDirectDownlines(uid);
    for (const d of directs) {
        if (legHasVip(d.uid, targetLevel)) return true;
    }
    return false;
}

// Cek Growth 50% 2 Periode Berturut-turut sejak syarat jumlah terpenuhi
function checkGrowthCondition(uid, teamMembers, minMembersReq) {
    // 1. Cari kapan user mencapai jumlah member minimum
    // Urutkan member berdasarkan joinDate
    const sortedTeam = [...teamMembers].sort((a, b) => a.joinDate - b.joinDate);
    
    // Member ke-N (index N-1) adalah penentu tanggal kualifikasi jumlah
    if (sortedTeam.length < minMembersReq) return false;
    
    const triggeringMember = sortedTeam[minMembersReq - 1]; 
    const dateLimitReached = new Date(triggeringMember.joinDate);

    // 2. Tentukan Periode Awal (Periode saat limit tercapai)
    let periodStart = getPeriodFromDate(dateLimitReached);
    
    // Kita harus mengecek 2 periode *setelah* atau *mulai dari* saat itu.
    // Prompt: "terhitung saat syarat jumlah anggota terpenuhi"
    // Artinya: Periode saat tercapai (P1) dan Periode berikutnya (P2).
    
    // Cek P1
    const p1 = calculatePeriodGrowth(uid, periodStart.start, periodStart.end);
    if (!p1.passed) return false;

    // Cek P2 (Periode setelah P1)
    const nextPeriodDates = getNextPeriodDates(periodStart.end);
    
    // Pastikan P2 sudah selesai (tanggal hari ini > end date P2)
    // Jika P2 belum selesai, user belum sah naik pangkat via jalur growth
    if (new Date() < nextPeriodDates.end) return false; 

    const p2 = calculatePeriodGrowth(uid, nextPeriodDates.start, nextPeriodDates.end);
    
    return p2.passed;
}

// Helper: Menghitung tanggal start/end periode berdasarkan tanggal input
// Aturan: Tgl 31 (prev) - 15 (curr) DAN Tgl 16 - 30 (curr)
function getPeriodFromDate(date) {
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    
    let start, end;

    if (d >= 16 && d <= 30) {
        // Periode 2: 16 - 30 (bulan ini)
        start = new Date(y, m, 16);
        end = new Date(y, m, 30, 23, 59, 59); // Tanggal 30 cutoff
    } else {
        // Periode 1: 31 (bulan lalu) - 15 (bulan ini)
        // Jika d <= 15, berarti ikut periode bulan ini
        if (d <= 15) {
            // Startnya tanggal 31 bulan lalu
            let pm = m - 1; let py = y;
            if (pm < 0) { pm = 11; py--; }
            const lastDayPrev = new Date(py, pm + 1, 0).getDate();
            // Jika bulan lalu ada tgl 31, mulai tgl 31. Jika cuma 30, mulai tgl 1? 
            // Prompt bilang "dimulai tanggal 31". Kita asumsikan tgl terakhir bulan lalu.
            start = new Date(py, pm, lastDayPrev === 31 ? 31 : lastDayPrev); 
            end = new Date(y, m, 15, 23, 59, 59);
        } else {
            // Tanggal 31, masuk periode 1 bulan DEPAN
            start = new Date(y, m, 31);
            let nm = m + 1; let ny = y;
            if (nm > 11) { nm = 0; ny++; }
            end = new Date(ny, nm, 15, 23, 59, 59);
        }
    }
    return { start, end };
}

function getNextPeriodDates(prevPeriodEndDate) {
    // Tambah 1 detik dari end date sebelumnya
    const nextStart = new Date(prevPeriodEndDate.getTime() + 1000);
    return getPeriodFromDate(nextStart);
}

function calculatePeriodGrowth(uid, startDate, endDate) {
    const team = getDownlinesRecursive(uid);
    // Base: Jumlah member SEBELUM start date (+1 diri sendiri jika mau, tapi biasanya base team)
    const baseCount = team.filter(m => m.joinDate < startDate).length + 1; // +1 biar target gak 0
    const newCount = team.filter(m => m.joinDate >= startDate && m.joinDate <= endDate).length;
    
    const target = Math.ceil(baseCount / 2); // 50%
    return {
        passed: newCount >= target,
        actual: newCount,
        target: target
    };
}

// ============================================================
// FUNGSI DASHBOARD & LAINNYA
// ============================================================

function doLogin(){
    const a=document.getElementById('loginUid').value.trim(),b=document.getElementById('loginButton'),c=document.getElementById('error');
    if(!a)return void(c.innerText="Masukkan UID");
    b.innerText="..."; b.disabled=!0; c.innerText="";
    loadData().then(() => {
        const d=globalData.find(m=>m.uid===a);
        if(d){
            sessionStorage.setItem('isLoggedIn','true');
            sessionStorage.setItem('userUid',d.uid);
            window.location.href='dashboard.html';
        } else {
            c.innerText="UID Tidak Terdaftar"; b.innerText="MASUK"; b.disabled=!1;
        }
    });
}

function logout(){sessionStorage.clear(),window.location.href='index.html'}

function renderDashboard(){
    const a=sessionStorage.getItem('userUid');if(!globalData.length)return void location.reload();const b=globalData.find(b=>b.uid===a);if(!b)return logout();
    document.getElementById('mName').innerText=b.name,document.getElementById('mUid').innerText=b.uid;const c=globalData.find(a=>a.uid===b.upline);document.getElementById('mRefUid').innerText=c?c.uid:'-';
    
    rankCache = {}; legCache = {}; // Reset cache
    const d=getDownlinesRecursive(a),e=d.length; // Total tim bawah
    document.getElementById('totalMembers').innerText=e;
    
    // Hitung Rank Sendiri
    calculateMyRank(e, b.uid);
    
    const g=[b,...d];
    myTeamData = g; 
    countVipStats(g); 
    
    // LOGIKA PERIODE DASHBOARD (TAMPILAN)
    const now = new Date();
    const pInfo = getPeriodFromDate(now);
    
    // Label Periode
    const pName = (now.getDate() >= 16 && now.getDate() <= 30) ? "PERIODE 2" : "PERIODE 1";
    document.getElementById('currentPeriodLabel').innerText = `${pName} (${getMonthName(now.getMonth())})`;
    
    startCountdown(pInfo.end);
    showMotivation();

    // Hitung Data Periode Ini (Untuk Dashboard)
    const calc = calculatePeriodGrowth(a, pInfo.start, pInfo.end);
    const baseTotal = getDownlinesRecursive(a).filter(m => m.joinDate < pInfo.start).length; // Base tanpa user
    
    // Tampilan Dashboard
    document.getElementById('prevPeriodCount').innerText = baseTotal; // Base Tim Awal Periode
    document.getElementById('targetCount').innerText = calc.target;
    document.getElementById('newMemberCount').innerText = calc.actual;
    
    let gap = calc.target - calc.actual;
    if (gap < 0) gap = 0;
    document.getElementById('gapCount').innerText = gap;

    currentGap = gap; globalTarget = calc.target;

    // Grafik (Simulasi Prev vs Curr)
    // Prev Period
    const prevPEnd = new Date(pInfo.start.getTime() - 1000);
    const prevPInfo = getPeriodFromDate(prevPEnd);
    const prevCalc = calculatePeriodGrowth(a, prevPInfo.start, prevPInfo.end);
    
    renderChart(prevCalc.actual, calc.actual);
}

function calculateMyRank(currentTeamSize, uid) {
    const curLevel = getRankLevel(uid);
    const curRankName = curLevel > 0 ? `V.I.P ${curLevel}` : "MEMBER";
    
    document.getElementById('rankName').innerText = curRankName;

    // Next Goal Logic
    const nextLvl = curLevel + 1;
    const nextRule = RANK_RULES.find(r => r.level === nextLvl);
    const goalEl = document.getElementById('rankNextGoal');
    const gapEl = document.getElementById('nextLevelGap');

    if (nextRule) {
        const gapMember = Math.max(0, nextRule.min - currentTeamSize);
        gapEl.innerText = gapMember;
        
        if (gapMember > 0) {
            goalEl.innerText = `Menuju VIP ${nextLvl} (Kurang Member)`;
            goalEl.style.color = "#ccc";
        } else {
            // Member sudah cukup, berarti kurang syarat Struktur/Growth
            goalEl.innerText = `Syarat: 2 Jalur @VIP${nextRule.reqVip} ATAU Growth 50%`;
            goalEl.style.color = "#ff4444";
            gapEl.innerText = "0";
        }
    } else {
        goalEl.innerText = "Top Level";
        gapEl.innerText = "0";
    }
}

function renderChart(prevVal, currVal){
    const ctx = document.getElementById('growthChart').getContext('2d');
    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['LALU', 'SAAT INI'],
            datasets: [{
                label: 'Growth',
                data: [prevVal, currVal],
                backgroundColor: ['#333', '#D4AF37'], 
                borderColor: '#D4AF37',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' }, ticks: { display: false } },
                x: { grid: { display: false }, ticks: { color: '#888', font: { size: 10 } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ============================================================
// VIP STATS & LIST
// ============================================================

function countVipStats(team){
    let counts = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
    
    // Kita harus hitung ulang rank setiap member di tim untuk statistik
    // (Bukan pakai cache user login, tapi hitung rank masing-masing)
    // Hati-hati performance. Kita pakai rankCache.
    
    team.forEach(m => {
        // Skip user login dari list statistik (opsional, biasanya dashboard nampilin downline)
        if (m.uid === sessionStorage.getItem('userUid')) return;

        let r = getRankLevel(m.uid);
        if (r >= 1 && r <= 9) {
            counts[r]++;
            vipLists[r].push(m);
        }
    });

    for(let i=1;i<=9;i++){
        const el=document.getElementById(`cVIP${i}`);
        if(el) el.innerText = counts[i];
    }
}

window.openVipModal = function(level) {
    const modal = document.getElementById('vipModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');
    
    title.innerText = `DAFTAR V.I.P ${level}`; 
    body.innerHTML = ''; 

    const list = vipLists[level];
    
    if (list.length > 0) {
        list.forEach(m => {
            // Hitung performa member ini di periode berjalan
            const now = new Date();
            const p = getPeriodFromDate(now);
            const perf = calculatePeriodGrowth(m.uid, p.start, p.end);
            const gap = perf.target - perf.actual;

            body.innerHTML += `
            <div class="v-item">
                <div style="width:100%;">
                    <div style="display:flex; justify-content:space-between;">
                        <span class="v-n">${m.name}</span>
                        <span class="v-u">${m.uid}</span>
                    </div>
                    <div style="font-size:9px; color:#666; margin-top:2px;">
                        Join: ${m.joinDate.toLocaleDateString()}
                    </div>
                    <div style="display:flex; gap:10px; font-size:9px; border-top:1px dashed #333; padding-top:4px; margin-top:4px;">
                        <span style="color:#aaa;">Target: <b style="color:#fff;">${perf.target}</b></span>
                        <span style="color:#aaa;">Capai: <b style="color:var(--gold);">${perf.actual}</b></span>
                        <span style="color:#aaa;">Sisa: <b style="color:${gap > 0 ? '#ff4444' : '#00ff00'};">${gap > 0 ? gap : 0}</b></span>
                    </div>
                </div>
            </div>`;
        });
    } else { 
        body.innerHTML = '<div class="v-empty">Belum ada anggota di level ini.</div>'; 
    }
    modal.style.display = 'flex';
}
window.closeVipModal = function() { document.getElementById('vipModal').style.display = 'none'; }


// ============================================================
// UTILS & LIST
// ============================================================

function getMonthName(a){return["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"][a]}

function initList(){window.sortData=a=>{sortState.col===a?sortState.dir='asc'===sortState.dir?'desc':'asc':(sortState.col=a,sortState.dir='asc'),renderTable()},renderTable()}
function renderTable(){
    const a=document.getElementById('membersTableBody'),{col:b,dir:c}=sortState,d=[...myTeamData].sort((a,d)=>{let e=a[b],f=d[b];return'joinDate'===b?'asc'===c?e-f:f-e:(e=e.toLowerCase(),f=f.toLowerCase(),'asc'===c?e<f?-1:1:e>f?1:-1)});
    let e='';
    d.forEach((a,b)=>{
        const c=a.joinDate,d=`${String(c.getDate()).padStart(2,'0')}/${String(c.getMonth()+1).padStart(2,'0')}/${c.getFullYear()}`,f=a.upline?a.upline:'-';
        e+=`<tr><td class="col-no">${b+1}</td><td class="col-name">${a.name}</td><td class="col-uid">${a.uid}</td><td class="col-ref">${f}</td><td class="col-date">${d}</td></tr>`
    });
    a.innerHTML=e;
}

function initNetwork(){
    const a=sessionStorage.getItem('userUid'),b=go.GraphObject.make,
    c=b(go.Diagram,"networkDiagram",{padding:new go.Margin(150),scrollMode:go.Diagram.InfiniteScroll,layout:b(go.TreeLayout,{angle:0,layerSpacing:60,nodeSpacing:10}),undoManager:{isEnabled:!0},initialContentAlignment:go.Spot.Center,minScale:.1,maxScale:2});
    c.nodeTemplate=b(go.Node,"Horizontal",{selectionObjectName:"PANEL"},
        b(go.Panel,"Auto",{name:"PANEL"},
            b(go.Shape,"RoundedRectangle",{fill:"#000",strokeWidth:1},new go.Binding("stroke","strokeColor"),new go.Binding("strokeWidth","strokeWidth")),
            b(go.TextBlock,{margin:new go.Margin(2,6,2,6),stroke:"#fff",font:"11px sans-serif",textAlign:"center",maxLines:1,overflow:go.TextBlock.OverflowEllipsis},new go.Binding("text","label"))
        ),
        b("TreeExpanderButton",{width:14,height:14,alignment:go.Spot.Right,margin:new go.Margin(0,0,0,4),"ButtonBorder.fill":"#222","ButtonBorder.stroke":"#D4AF37","ButtonIcon.stroke":"white"})
    );
    c.linkTemplate=b(go.Link,{routing:go.Link.Orthogonal,corner:5},b(go.Shape,{strokeWidth:1,stroke:"white"}));
    const d=myTeamData.map(a=>{
        const b=a.joinDate;
        const c=`${String(b.getDate()).padStart(2,'0')}-${String(b.getMonth()+1).padStart(2,'0')}-${String(b.getFullYear()).slice(-2)}`;
        
        // Warna Gold jika VIP 1 ke atas
        const rank = getRankLevel(a.uid);
        const isVip = rank >= 1;
        
        let starStr = ""; if(rank > 0) { starStr = "⭐".repeat(rank) + " "; }
        
        return { key:a.uid, label:`${starStr}${a.uid} / ${a.name} / ${c}`, strokeColor:isVip?"#ffd700":"#ffffff",strokeWidth:isVip?2:1 }
    });
    const e=myTeamData.filter(a=>a.upline&&""!==a.upline).map(a=>({from:a.upline,to:a.uid}));
    c.model=new go.GraphLinksModel(d,e);
    const f=c.findNodeForKey(a);f&&(c.centerRect(f.actualBounds),f.isSelected=!0),window.downloadNetworkImage=function(){const a=c.makeImage({scale:2,background:"#000",maxSize:new go.Size(Infinity,Infinity),padding:new go.Margin(50)}),b=document.createElement("a");b.href=a.src,b.download="jaringan_dvteam.png",document.body.appendChild(b),b.click(),document.body.removeChild(b)}
};

// ============================================================
// FITUR PELENGKAP (MOTIVASI, SHARE, COUNTDOWN)
// ============================================================

let intervalId; 
function startCountdown(targetDate) {
    if (intervalId) clearInterval(intervalId);
    function updateTimer() {
        const now = new Date().getTime(); const distance = targetDate.getTime() - now;
        if (distance < 0) { 
            document.getElementById("cdDays").textContent="00"; document.getElementById("cdHours").textContent="00"; document.getElementById("cdMin").textContent="00"; document.getElementById("cdSec").textContent="00"; 
            // Refresh halaman kalau ganti periode (opsional)
            // location.reload();
            return; 
        }
        const days = Math.floor(distance / (1000 * 60 * 60 * 24)); const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)); const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        document.getElementById("cdDays").textContent=days<10?"0"+days:days; document.getElementById("cdHours").textContent=hours<10?"0"+hours:hours; document.getElementById("cdMin").textContent=minutes<10?"0"+minutes:minutes; document.getElementById("cdSec").textContent=seconds<10?"0"+seconds:seconds;
    }
    updateTimer(); intervalId = setInterval(updateTimer, 1000);
}

const wordBank = { openings: ["🔥 SAYA SIAP BERTEMPUR!", "⚠️ PERINGATAN KERAS!", "🚀 JANGAN LENGAH!", "🦁 BANGKITLAH PEMENANG!", "💎 MENTAL JUTAWAN!"], conditions: ["Hari ini musuhmu sedang bekerja keras,", "Target tidak akan menunggu kamu siap,", "Kemiskinan sedang mengintip di depan pintu,", "Orang lain sudah berlari dua kali lebih cepat,"], actions: ["maka HANCURKAN rasa malasmu sekarang!", "segera RAPATKAN BARISAN dan kejar ketertinggalan!", "buktikan kamu bukan PENGECUT!", "ubah keringatmu menjadi EMAS!"], closings: ["PASTI BISA!", "GASPOLL!", "TUNTASKAN!", "REBUT!", "SEKARANG!"] };
function generateDynamicQuote() { const r = (arr) => arr[Math.floor(Math.random() * arr.length)]; return `"${r(wordBank.openings)} ${r(wordBank.conditions)} ${r(wordBank.actions)} ${r(wordBank.closings)}"`; }
function showMotivation() { if (!sessionStorage.getItem('isLoggedIn')) return; const modal = document.getElementById('motivationModal'); const textEl = document.getElementById('dailyMotivation'); if (modal && textEl) { textEl.innerText = generateDynamicQuote(); modal.style.display = 'flex'; } }
window.closeMotivation = function() { const modal = document.getElementById('motivationModal'); if (modal) { modal.style.opacity = '0'; setTimeout(() => { modal.style.display = 'none'; modal.style.opacity = '1'; }, 300); } }

const groupWords = { headers: ["🔥 UPDATE MEMBARA", "🚀 INFO PENTING TIM", "⚠️ SIAGA SATU", "🏆 LAPORAN PERTEMPURAN"], intros: ["Keberhasilan tim bukan dinilai dari seberapa cepat kita berlari, tapi seberapa kuat kita saling menggandeng.", "Jangan biarkan mimpi mati hanya karena malas. INGAT ALASAN KITA MEMULAI!", "Pemenang bukan orang yang tak pernah gagal, tapi yang tak pernah menyerah."], alerts: ["Tetap fokus pada pertumbuhan 50%", "Jangan kasih kendor, kejar target 50%", "Rapatkan barisan, fokus angka 50%"], closings: ["Gow .. Gaaaaass sampai tembus..!! 💪🏻", "Ayo buktikan kita bisa..!! 🚀", "Salam satu komando..!! 🔥"] };
window.openShareModal = function() { generateShareText(); document.getElementById('shareModal').style.display = 'flex'; }
window.generateShareText = function() { const txtArea = document.getElementById('shareText'); const r = (arr) => arr[Math.floor(Math.random() * arr.length)]; const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']; const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']; const now = new Date(); const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`; const finalTxt = `${r(groupWords.headers)} \nDVTEAM NP 🔥\n\n` + `📅 ${dateStr}\n` + `👥 Target 50%: *${globalTarget} Anggota*\n\n` + `"${r(groupWords.intros)}"\n\n` + `🚀 ${r(groupWords.alerts)} = sisa ${currentGap} anggota lagi..!! 🏆\n` + `${r(groupWords.closings)}\n` + `#DVTeamNP #SatuVisi #SatuMisi #SatuKomando`; txtArea.value = finalTxt; }
window.copyShareText = function() { const txtArea = document.getElementById('shareText'); txtArea.select(); txtArea.setSelectionRange(0, 99999); navigator.clipboard.writeText(txtArea.value).then(() => { alert("✅ Teks berhasil disalin! Silakan tempel di Grup WhatsApp."); }); }
window.closeShareModal = function() { document.getElementById('shareModal').style.display = 'none'; }

// Placeholder untuk fitur modal achiever (sudah ada logika di atas, bisa diaktifkan kembali jika needed)
window.openAchieverModal = function() { alert("Fitur Report Growth sedang diperbarui mengikuti aturan Periode baru."); }
window.closeAchieverModal = function() { document.getElementById('achieverModal').style.display = 'none'; }
