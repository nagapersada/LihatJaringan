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
const RANK_RULES = [
    { level: 9, min: 3501, reqVip: 8 },
    { level: 8, min: 1601, reqVip: 7 },
    { level: 7, min: 901, reqVip: 6 },
    { level: 6, min: 501, reqVip: 5 },
    { level: 5, min: 351, reqVip: 4 },
    { level: 4, min: 201, reqVip: 3 },
    { level: 3, min: 101, reqVip: 2 },
    { level: 2, min: 31, reqVip: 1 },
    { level: 1, min: 5, reqVip: 0 } // VIP 1 Khusus: Cek Direct Downline
];

// CACHE
let rankCache = {}; 
let downlineCache = {};
let legCache = {}; 

document.addEventListener('DOMContentLoaded',async()=>{const a=window.location.pathname,b=sessionStorage.getItem('isLoggedIn');if(!b&&!a.includes('index.html')){window.location.href='index.html';return}if(b)await loadData();if(a.includes('index.html'))document.getElementById('loginButton').addEventListener('click',doLogin);else if(a.includes('dashboard.html'))renderDashboard();else if(a.includes('list.html')){prepareMyTeamData();initList()}else if(a.includes('network.html')){prepareMyTeamData();initNetwork()}});

async function loadData() {
    try {
        const [membersRes] = await Promise.all([ db.from('members').select('*') ]);
        if (membersRes.error) throw membersRes.error;
        
        globalData = membersRes.data.map(a => ({
            uid: String(a.UID || a.uid).trim(),
            name: (a.Nama || a.nama || a.name || '-').trim(),
            upline: a.Upline || a.upline ? String(a.Upline || a.upline).trim() : "",
            joinDate: new Date(a.TanggalBergabung || a.tanggalbergabung || a.joinDate)
        }));

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

// ============================================================
// 1. LOGIKA PERINGKAT (DIPERBARUI)
// ============================================================

function getRankLevel(uid) {
    if (rankCache[uid] !== undefined) return rankCache[uid];

    const team = getDownlinesRecursive(uid);
    const totalTeam = team.length; // Hitung downline saja
    const directs = getDirectDownlines(uid);
    
    let currentLevel = 0;

    for (const rule of RANK_RULES) {
        // VIP 1: Spesifik 5 Anggota Langsung
        if (rule.level === 1) {
            if (directs.length >= rule.min) { // Min 5 Direct
                currentLevel = Math.max(currentLevel, 1);
            }
            continue; // Lanjut cek level atasnya
        }

        // VIP 2-9: Total Tim + (Struktur OR Growth)
        if (totalTeam >= rule.min) {
            // Cek 1: Struktur (2 Kaki Berbeda)
            if (checkStructureCondition(uid, rule.reqVip)) {
                currentLevel = rule.level;
                break; // Ketemu level tertinggi, stop
            }
            
            // Cek 2: Growth (50% 2 Periode Berturut)
            // Asumsi: Kita cek 2 periode terakhir yang sudah SELESAI
            if (checkConsecutiveGrowth(uid)) {
                currentLevel = rule.level;
                break;
            }
        }
    }

    rankCache[uid] = currentLevel;
    return currentLevel;
}

// Cek Struktur: 2 Kaki memiliki VIP X
function checkStructureCondition(uid, requiredVipLevel) {
    const cacheKey = `${uid}_leg_${requiredVipLevel}`;
    if (legCache[cacheKey] !== undefined) return legCache[cacheKey];

    const directs = getDirectDownlines(uid);
    let qualifiedLegs = 0;

    for (const direct of directs) {
        if (legHasVip(direct.uid, requiredVipLevel)) {
            qualifiedLegs++;
        }
        if (qualifiedLegs >= 2) break;
    }

    const result = (qualifiedLegs >= 2);
    legCache[cacheKey] = result;
    return result;
}

function legHasVip(uid, targetLevel) {
    if (getRankLevel(uid) >= targetLevel) return true;
    const directs = getDirectDownlines(uid);
    for (const d of directs) {
        if (legHasVip(d.uid, targetLevel)) return true;
    }
    return false;
}

// Cek Growth: 2 Periode Terakhir (Selesai) harus >= 50%
function checkConsecutiveGrowth(uid) {
    const now = new Date();
    // Cari Periode Selesai Terakhir (P1)
    let p1Info = getPreviousPeriodDates(now);
    // Cari Periode Selesai Sebelum P1 (P2)
    let p2End = new Date(p1Info.start.getTime() - 1000);
    let p2Info = getPeriodFromDate(p2End);

    const growth1 = calculatePeriodGrowth(uid, p1Info.start, p1Info.end);
    const growth2 = calculatePeriodGrowth(uid, p2Info.start, p2Info.end);

    return (growth1.passed && growth2.passed);
}

// ============================================================
// 2. PERHITUNGAN PERIODE & GROWTH
// ============================================================

// Mendapatkan rentang tanggal periode berdasarkan input tanggal
function getPeriodFromDate(date) {
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    let start, end;

    if (d >= 16 && d <= 30) { // Periode 2: 16-30
        start = new Date(y, m, 16);
        end = new Date(y, m + 1, 0, 23, 59, 59); // Akhir bulan
    } else { // Periode 1: 31 (Lalu) - 15 (Kini)
        if (d <= 15) {
            // Start dari tgl 31 bulan lalu (atau akhir bulan lalu)
            let pm = m - 1, py = y;
            if (pm < 0) { pm = 11; py--; }
            const lastDayPrev = new Date(py, pm + 1, 0).getDate();
            start = new Date(py, pm, lastDayPrev === 31 ? 31 : lastDayPrev);
            end = new Date(y, m, 15, 23, 59, 59);
        } else {
            // Tgl 31 bulan ini -> Masuk Periode 1 Bulan Depan
            start = new Date(y, m, 31);
            let nm = m + 1, ny = y;
            if (nm > 11) { nm = 0; ny++; }
            end = new Date(ny, nm, 15, 23, 59, 59);
        }
    }
    return { start, end };
}

// Mendapatkan tanggal periode SEBELUM tanggal referensi
function getPreviousPeriodDates(refDate) {
    const currentPeriod = getPeriodFromDate(refDate);
    // Mundur 1 detik dari start periode sekarang untuk dapat end periode lalu
    const prevEnd = new Date(currentPeriod.start.getTime() - 1000);
    return getPeriodFromDate(prevEnd);
}

function calculatePeriodGrowth(uid, startDate, endDate) {
    const team = getDownlinesRecursive(uid);
    // Base: Jumlah member yg gabung SEBELUM start date
    const baseCount = team.filter(m => m.joinDate < startDate).length; 
    // New: Member yg gabung ANTARA start dan end
    const newCount = team.filter(m => m.joinDate >= startDate && m.joinDate <= endDate).length;
    
    // Target: 50% dari Base. (Jika Base 0, Target 0 atau 1? Kita set minimal 1 jika tim kosong agar ada aktivitas)
    // Sesuai request: "Growth 50%".
    let target = Math.ceil(baseCount / 2);
    if(baseCount === 0) target = 1; // Paksa target 1 jika belum punya member

    return {
        passed: newCount >= target,
        actual: newCount,
        target: target,
        base: baseCount
    };
}

// ============================================================
// 3. FUNGSI DASHBOARD & CHART
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
    
    rankCache = {}; legCache = {};
    const d=getDownlinesRecursive(a);
    const totalTeam=d.length; 
    
    document.getElementById('totalMembers').innerText=totalTeam;
    calculateMyRank(totalTeam, b.uid);
    
    const g=[b,...d];
    myTeamData = g; 
    countVipStats(g); 
    
    // --- Periode Berjalan ---
    const now = new Date();
    const pInfo = getPeriodFromDate(now);
    
    const pName = (now.getDate() >= 16 && now.getDate() <= 30) ? "PERIODE 2" : "PERIODE 1";
    document.getElementById('currentPeriodLabel').innerText = `${pName} (${getMonthName(now.getMonth())})`;
    startCountdown(pInfo.end);
    showMotivation();

    // Stats Dashboard
    const calc = calculatePeriodGrowth(a, pInfo.start, pInfo.end);
    
    document.getElementById('prevPeriodCount').innerText = calc.base; 
    document.getElementById('targetCount').innerText = calc.target;
    document.getElementById('newMemberCount').innerText = calc.actual;
    
    let gap = calc.target - calc.actual;
    if (gap < 0) gap = 0;
    document.getElementById('gapCount').innerText = gap;

    currentGap = gap; globalTarget = calc.target;

    // Chart: Prev vs Curr
    const prevP = getPreviousPeriodDates(now);
    const prevCalc = calculatePeriodGrowth(a, prevP.start, prevP.end);
    renderChart(prevCalc.actual, calc.actual);
}

function calculateMyRank(currentTeamSize, uid) {
    const curLevel = getRankLevel(uid);
    const curRankName = curLevel > 0 ? `V.I.P ${curLevel}` : "MEMBER";
    document.getElementById('rankName').innerText = curRankName;

    const nextLvl = curLevel + 1;
    const nextRule = RANK_RULES.find(r => r.level === nextLvl);
    const goalEl = document.getElementById('rankNextGoal');
    const gapEl = document.getElementById('nextLevelGap');

    if (nextRule) {
        if (nextLvl === 1) {
             const directs = getDirectDownlines(uid).length;
             const gap = Math.max(0, 5 - directs);
             gapEl.innerText = gap;
             goalEl.innerText = gap > 0 ? "Kurang Direct Downline" : "Syarat Terpenuhi";
        } else {
            const gapMember = Math.max(0, nextRule.min - currentTeamSize);
            gapEl.innerText = gapMember;
            if (gapMember > 0) {
                goalEl.innerText = `Menuju VIP ${nextLvl}`;
                goalEl.style.color = "#ccc";
            } else {
                goalEl.innerText = `Butuh: 2 Jalur VIP${nextRule.reqVip} / Growth 50%`;
                goalEl.style.color = "#ff4444";
                gapEl.innerText = "0";
            }
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

function countVipStats(team){
    let counts = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
    team.forEach(m => {
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

// ============================================================
// 4. MODAL PERAIH TARGET (RESTORED)
// ============================================================

window.openAchieverModal = function() {
    const modal = document.getElementById('achieverModal'), body = document.getElementById('achieverBody'), title = document.getElementById('achieverTitle'), btnDl = document.getElementById('btnDlAchiever');
    modal.style.display = 'flex'; 
    body.innerHTML = '<div class="v-empty">Menghitung Periode Lalu...</div>'; 
    btnDl.style.display = 'none'; 
    achieverTxtContent = "";

    // 1. Tentukan Periode Sebelumnya
    const now = new Date();
    const prevP = getPreviousPeriodDates(now);
    const startStr = `${prevP.start.getDate()}/${prevP.start.getMonth()+1}`;
    const endStr = `${prevP.end.getDate()}/${prevP.end.getMonth()+1}/${prevP.end.getFullYear()}`;
    const periodLabel = `PERIODE (${startStr} - ${endStr})`;

    title.innerText = `REPORT ${periodLabel}`;
    achieverTxtContent = `REPORT PERAIH TARGET 50%\n${periodLabel}\n====================\n\n`;

    // 2. Filter & Hitung
    // Kita gunakan setTimeout agar UI render dulu sebelum proses berat
    setTimeout(() => {
        let successList = []; 
        let failureList = [];
        const myUid = sessionStorage.getItem('userUid');

        // Loop seluruh tim (atau globalData jika ingin melihat seluruh perusahaan, 
        // tapi biasanya user hanya melihat timnya. Kita pakai myTeamData).
        // Tapi syarat: "Anggota yg masuk daftar adalah yg SUDAH VIP".
        
        myTeamData.forEach(mem => {
            // Hitung Rank member (Status saat ini)
            const rank = getRankLevel(mem.uid);
            
            // Hanya proses jika sudah VIP 1 ke atas
            if (rank >= 1) {
                // Hitung Growth di Periode Lalu
                const stats = calculatePeriodGrowth(mem.uid, prevP.start, prevP.end);
                
                const dataObj = {
                    name: mem.name,
                    uid: mem.uid,
                    rank: rank,
                    target: stats.target,
                    actual: stats.actual,
                    base: stats.base
                };

                if (stats.passed) {
                    successList.push(dataObj);
                } else {
                    failureList.push(dataObj);
                }
            }
        });

        renderAchieverList(successList, failureList, body, btnDl, myUid);
    }, 100);
}

function renderAchieverList(successList, failureList, body, btnDl, myUid) {
    // Sort by Actual Growth Highest
    successList.sort((a,b) => b.actual - a.actual);
    failureList.sort((a,b) => b.actual - a.actual);

    let html = '';
    
    // --- List Sukses ---
    if (successList.length > 0) {
        html += `<div style="padding:10px 15px; background:#112211; color:#00ff00; font-weight:bold; border-bottom:1px solid #333; font-size:11px;">🏆 LOLOS TARGET (VIP ONLY)</div>`;
        achieverTxtContent += `[ SUKSES ]\n`;
        
        successList.forEach((a, i) => {
            const isMe = (a.uid === myUid);
            html += `
            <div class="achiever-item" style="border-left:3px solid #00ff00; background:${isMe ? '#0f1a0f' : 'transparent'}">
                <div class="achiever-top">
                    <span class="v-n">${i+1}. ${a.name} ${isMe?'(ANDA)':''} <small style="color:var(--gold)">[VIP ${a.rank}]</small></span>
                    <span class="v-u">${a.uid}</span>
                </div>
                <div class="achiever-stats">
                    <span>Base: ${a.base}</span>
                    <span>Target: <b class="val-target">${a.target}</b></span>
                    <span>Actual: <b class="val-actual" style="color:#00ff00;">${a.actual}</b></span>
                </div>
            </div>`;
            achieverTxtContent += `${i+1}. ${a.name} (VIP ${a.rank}) | Target: ${a.target} | Capai: ${a.actual}\n`;
        });
        achieverTxtContent += `\n`;
    }

    // --- List Gagal ---
    if (failureList.length > 0) {
        html += `<div style="padding:10px 15px; background:#221111; color:#ff4444; font-weight:bold; border-bottom:1px solid #333; margin-top:10px; font-size:11px;">⚠️ BELUM LOLOS</div>`;
        achieverTxtContent += `[ BELUM LOLOS ]\n`;

        failureList.forEach((a, i) => {
            const isMe = (a.uid === myUid);
            const gap = a.target - a.actual;
            html += `
            <div class="achiever-item" style="border-left:3px solid #ff4444; background:${isMe ? '#1a0f0f' : 'transparent'}">
                <div class="achiever-top">
                    <span class="v-n">${i+1}. ${a.name} ${isMe?'(ANDA)':''} <small style="color:#666">[VIP ${a.rank}]</small></span>
                    <span class="v-u">${a.uid}</span>
                </div>
                <div class="achiever-stats">
                    <span>Target: <b class="val-target">${a.target}</b></span>
                    <span>Actual: <b style="color:#ff4444;">${a.actual}</b> (Kurang ${gap})</span>
                </div>
            </div>`;
            achieverTxtContent += `${i+1}. ${a.name} (VIP ${a.rank}) | Target: ${a.target} | Capai: ${a.actual} (Kurang ${gap})\n`;
        });
    }

    if (successList.length === 0 && failureList.length === 0) {
        html = '<div class="v-empty">Belum ada anggota VIP di tim.</div>';
    }

    body.innerHTML = html;
    btnDl.style.display = 'block';
}

function downloadAchieverData() { if(!achieverTxtContent) return; const blob=new Blob([achieverTxtContent],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='report_growth_vip.txt'; a.click(); }
function closeAchieverModal() { document.getElementById('achieverModal').style.display = 'none'; }


// ============================================================
// UTILS & LAINNYA
// ============================================================

window.openVipModal = function(level) {
    const modal = document.getElementById('vipModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');
    title.innerText = `DAFTAR V.I.P ${level}`; body.innerHTML = ''; 
    const list = vipLists[level];
    if (list.length > 0) {
        list.forEach(m => {
            const now = new Date(); const p = getPeriodFromDate(now);
            const perf = calculatePeriodGrowth(m.uid, p.start, p.end);
            const gap = perf.target - perf.actual;
            body.innerHTML += `<div class="v-item"><div style="width:100%;"><div style="display:flex; justify-content:space-between;"><span class="v-n">${m.name}</span><span class="v-u">${m.uid}</span></div><div style="display:flex; gap:10px; font-size:9px; border-top:1px dashed #333; padding-top:4px; margin-top:4px;"><span style="color:#aaa;">Target: <b style="color:#fff;">${perf.target}</b></span><span style="color:#aaa;">Capai: <b style="color:var(--gold);">${perf.actual}</b></span><span style="color:#aaa;">Sisa: <b style="color:${gap > 0 ? '#ff4444' : '#00ff00'};">${gap > 0 ? gap : 0}</b></span></div></div></div>`;
        });
    } else { body.innerHTML = '<div class="v-empty">Kosong.</div>'; }
    modal.style.display = 'flex';
}
window.closeVipModal = function() { document.getElementById('vipModal').style.display = 'none'; }

function getMonthName(a){return["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"][a]}
function initList(){window.sortData=a=>{sortState.col===a?sortState.dir='asc'===sortState.dir?'desc':'asc':(sortState.col=a,sortState.dir='asc'),renderTable()},renderTable()}
function renderTable(){const a=document.getElementById('membersTableBody'),{col:b,dir:c}=sortState,d=[...myTeamData].sort((a,d)=>{let e=a[b],f=d[b];return'joinDate'===b?'asc'===c?e-f:f-e:(e=e.toLowerCase(),f=f.toLowerCase(),'asc'===c?e<f?-1:1:e>f?1:-1)});let e='';d.forEach((a,b)=>{const c=a.joinDate,d=`${String(c.getDate()).padStart(2,'0')}/${String(c.getMonth()+1).padStart(2,'0')}/${c.getFullYear()}`,f=a.upline?a.upline:'-';e+=`<tr><td class="col-no">${b+1}</td><td class="col-name">${a.name}</td><td class="col-uid">${a.uid}</td><td class="col-ref">${f}</td><td class="col-date">${d}</td></tr>`}),a.innerHTML=e}

function initNetwork(){
    const a=sessionStorage.getItem('userUid'),b=go.GraphObject.make,c=b(go.Diagram,"networkDiagram",{padding:new go.Margin(150),scrollMode:go.Diagram.InfiniteScroll,layout:b(go.TreeLayout,{angle:0,layerSpacing:60,nodeSpacing:10}),undoManager:{isEnabled:!0},initialContentAlignment:go.Spot.Center,minScale:.1,maxScale:2});
    c.nodeTemplate=b(go.Node,"Horizontal",{selectionObjectName:"PANEL"},b(go.Panel,"Auto",{name:"PANEL"},b(go.Shape,"RoundedRectangle",{fill:"#000",strokeWidth:1},new go.Binding("stroke","strokeColor"),new go.Binding("strokeWidth","strokeWidth")),b(go.TextBlock,{margin:new go.Margin(2,6,2,6),stroke:"#fff",font:"11px sans-serif",textAlign:"center",maxLines:1,overflow:go.TextBlock.OverflowEllipsis},new go.Binding("text","label"))),b("TreeExpanderButton",{width:14,height:14,alignment:go.Spot.Right,margin:new go.Margin(0,0,0,4),"ButtonBorder.fill":"#222","ButtonBorder.stroke":"#D4AF37","ButtonIcon.stroke":"white"}));
    c.linkTemplate=b(go.Link,{routing:go.Link.Orthogonal,corner:5},b(go.Shape,{strokeWidth:1,stroke:"white"}));
    const d=myTeamData.map(a=>{
        const b=a.joinDate; const c=`${String(b.getDate()).padStart(2,'0')}-${String(b.getMonth()+1).padStart(2,'0')}-${String(b.getFullYear()).slice(-2)}`;
        const rank = getRankLevel(a.uid); const isVip = rank >= 1;
        let starStr = ""; if(rank > 0) { starStr = "⭐".repeat(rank) + " "; }
        return { key:a.uid, label:`${starStr}${a.uid} / ${a.name} / ${c}`, strokeColor:isVip?"#ffd700":"#ffffff",strokeWidth:isVip?2:1 }
    });
    const e=myTeamData.filter(a=>a.upline&&""!==a.upline).map(a=>({from:a.upline,to:a.uid})); c.model=new go.GraphLinksModel(d,e);
    const f=c.findNodeForKey(a);f&&(c.centerRect(f.actualBounds),f.isSelected=!0),window.downloadNetworkImage=function(){const a=c.makeImage({scale:2,background:"#000",maxSize:new go.Size(Infinity,Infinity),padding:new go.Margin(50)}),b=document.createElement("a");b.href=a.src,b.download="jaringan_dvteam.png",document.body.appendChild(b),b.click(),document.body.removeChild(b)}
};

let intervalId; 
function startCountdown(targetDate) {
    if (intervalId) clearInterval(intervalId);
    function updateTimer() {
        const now = new Date().getTime(); const distance = targetDate.getTime() - now;
        if (distance < 0) { document.getElementById("cdDays").textContent="00"; document.getElementById("cdHours").textContent="00"; document.getElementById("cdMin").textContent="00"; document.getElementById("cdSec").textContent="00"; return; }
        const days = Math.floor(distance / (1000 * 60 * 60 * 24)); const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)); const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        document.getElementById("cdDays").textContent=days<10?"0"+days:days; document.getElementById("cdHours").textContent=hours<10?"0"+hours:hours; document.getElementById("cdMin").textContent=minutes<10?"0"+minutes:minutes; document.getElementById("cdSec").textContent=seconds<10?"0"+seconds:seconds;
    }
    updateTimer(); intervalId = setInterval(updateTimer, 1000);
}
const wordBank = { openings: ["🔥 SAYA SIAP BERTEMPUR!", "⚠️ PERINGATAN KERAS!", "🚀 JANGAN LENGAH!", "🦁 BANGKITLAH PEMENANG!"], conditions: ["Hari ini musuhmu sedang bekerja keras,", "Target tidak akan menunggu kamu siap,", "Kemiskinan sedang mengintip di depan pintu,"], actions: ["maka HANCURKAN rasa malasmu sekarang!", "segera RAPATKAN BARISAN!", "buktikan kamu bukan PENGECUT!"], closings: ["PASTI BISA!", "GASPOLL!", "TUNTASKAN!", "REBUT!"] };
function generateDynamicQuote() { const r = (arr) => arr[Math.floor(Math.random() * arr.length)]; return `"${r(wordBank.openings)} ${r(wordBank.conditions)} ${r(wordBank.actions)} ${r(wordBank.closings)}"`; }
function showMotivation() { if (!sessionStorage.getItem('isLoggedIn')) return; const modal = document.getElementById('motivationModal'); const textEl = document.getElementById('dailyMotivation'); if (modal && textEl) { textEl.innerText = generateDynamicQuote(); modal.style.display = 'flex'; } }
window.closeMotivation = function() { const modal = document.getElementById('motivationModal'); if (modal) { modal.style.opacity = '0'; setTimeout(() => { modal.style.display = 'none'; modal.style.opacity = '1'; }, 300); } }
const groupWords = { headers: ["🔥 UPDATE MEMBARA", "🚀 INFO PENTING TIM"], intros: ["Keberhasilan tim bukan dinilai dari seberapa cepat kita berlari.", "Jangan biarkan mimpi mati hanya karena malas."], alerts: ["Tetap fokus pada pertumbuhan 50%", "Kejar target 50%"], closings: ["Gaaass..!! 💪🏻", "Buktikan kita bisa..!! 🚀"] };
window.openShareModal = function() { generateShareText(); document.getElementById('shareModal').style.display = 'flex'; }
window.generateShareText = function() { const txtArea = document.getElementById('shareText'); const r = (arr) => arr[Math.floor(Math.random() * arr.length)]; const now = new Date(); const finalTxt = `${r(groupWords.headers)} \nDVTEAM NP 🔥\n\n📅 ${now.toLocaleDateString()}\n👥 Target 50%: *${globalTarget} Anggota*\n\n"${r(groupWords.intros)}"\n\n🚀 ${r(groupWords.alerts)} = sisa ${currentGap} anggota..!!\n${r(groupWords.closings)}`; txtArea.value = finalTxt; }
window.copyShareText = function() { const txtArea = document.getElementById('shareText'); txtArea.select(); txtArea.setSelectionRange(0, 99999); navigator.clipboard.writeText(txtArea.value).then(() => { alert("✅ Teks berhasil disalin!"); }); }
window.closeShareModal = function() { document.getElementById('shareModal').style.display = 'none'; }
