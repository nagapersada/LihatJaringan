const supabaseUrl = 'https://hysjbwysizpczgcsqvuv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5c2pid3lzaXpwY3pnY3NxdnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjA2MTYsImV4cCI6MjA3OTQ5NjYxNn0.sLSfXMn9htsinETKUJ5IAsZ2l774rfeaNNmB7mVQcR4';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

// VARIABLES
let globalData=[], myTeamData=[], globalHistory=[], globalAchievers=[], globalFailures=[], sortState={col:'joinDate',dir:'asc'};
let vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
let achieverTxtContent = "";
let currentGap = 0; 
let globalTarget = 0;

// KONFIGURASI RANK
// Level, Min Team, Req VIP di bawahnya
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

// CACHE OPTIMIZATION
let rankCache = {}; 
let downlineCache = {};
let legCache = {}; 

document.addEventListener('DOMContentLoaded',async()=>{
    const a=window.location.pathname;
    const b=sessionStorage.getItem('isLoggedIn');
    if(!b&&!a.includes('index.html')){window.location.href='index.html';return}
    if(b) await loadData();
    
    if(a.includes('index.html')) document.getElementById('loginButton').addEventListener('click',doLogin);
    else if(a.includes('dashboard.html')) renderDashboard();
    else if(a.includes('list.html')){ prepareMyTeamData(); initList(); }
    else if(a.includes('network.html')){ prepareMyTeamData(); initNetwork(); }
});

// LOAD DATA
async function loadData() {
    try {
        const [membersRes, historyRes] = await Promise.all([
            db.from('members').select('*'),
            db.from('vip_history').select('*')
        ]);

        if (membersRes.error) throw membersRes.error;
        globalData = membersRes.data.map(a => ({
            uid: String(a.UID || a.uid).trim(),
            name: (a.Nama || a.nama || a.name || '-').trim(),
            upline: a.Upline || a.upline ? String(a.Upline || a.upline).trim() : "",
            joinDate: new Date(a.TanggalBergabung || a.tanggalbergabung || a.joinDate)
        }));

        if (historyRes.data) globalHistory = historyRes.data;
        
        // Reset Cache
        rankCache = {}; downlineCache = {}; legCache = {};

    } catch (a) {
        console.error("Load Error:", a);
        alert("Gagal memuat data. Cek koneksi internet.");
    }
}

// ============================================================
// LOGIKA PERIODE (31-15 & 16-30)
// ============================================================

function getPeriodRange(date) {
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    
    let start, end, label;
    const monthNames = ["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"];

    if (d >= 16 && d <= 30) {
        // PERIODE 2: Tgl 16 - 30 (Bulan Ini)
        start = new Date(y, m, 16);
        end = new Date(y, m, 30, 23, 59, 59);
        label = `PERIODE 2 (${monthNames[m]} ${y})`;
    } else {
        // PERIODE 1: Tgl 31 (Bulan Lalu) - 15 (Bulan Ini)
        if (d <= 15) {
            // Kita berada di tgl 1-15
            let pm = m - 1, py = y;
            if (pm < 0) { pm = 11; py--; }
            const lastDayPrev = new Date(py, pm + 1, 0).getDate();
            // Start tgl 31 bulan lalu (jika ada), atau tgl terakhir bulan lalu
            start = new Date(py, pm, lastDayPrev === 31 ? 31 : lastDayPrev);
            end = new Date(y, m, 15, 23, 59, 59);
            label = `PERIODE 1 (${monthNames[m]} ${y})`;
        } else {
            // Kita berada di tgl 31 (Start Periode 1 Bulan Depan)
            start = new Date(y, m, 31);
            let nm = m + 1, ny = y;
            if (nm > 11) { nm = 0; ny++; }
            end = new Date(ny, nm, 15, 23, 59, 59);
            label = `PERIODE 1 (${monthNames[nm]} ${ny})`;
        }
    }
    return { start, end, label };
}

function getPreviousPeriodRange(currentStartDate) {
    // Mundur 1 detik dari start date saat ini untuk mendapatkan end date periode lalu
    const prevEndDate = new Date(currentStartDate.getTime() - 1000);
    return getPeriodRange(prevEndDate);
}

// ============================================================
// LOGIKA STRUKTUR & PERINGKAT (CORE)
// ============================================================

function getDownlinesRecursive(uid){
    if(downlineCache[uid]) return downlineCache[uid];
    let b=[];
    const c=globalData.filter(b=>b.upline===uid);
    c.forEach(a=>{ b.push(a); b=b.concat(getDownlinesRecursive(a.uid)); });
    downlineCache[uid] = b;
    return b;
}

function getRankLevel(uid) {
    if (rankCache[uid] !== undefined) return rankCache[uid];

    const team = getDownlinesRecursive(uid);
    const directDownlines = globalData.filter(m => m.upline === uid);
    const totalTeam = team.length + 1; // +1 diri sendiri jika diperlukan, tapi rules biasanya base on downline count
    
    // Khusus VIP 1: 5 Anggota Langsung/Downline Langsung (Sesuai Prompt)
    if (totalTeam < 5) { rankCache[uid] = 0; return 0; }
    
    // Cek VIP 1 (Minimal 5 Downline Langsung atau Tim)
    // Prompt: "VIP 1 : 5 anggota langsung/downline langsung" -> Asumsi Direct Referral
    if (directDownlines.length < 5 && team.length < 5) { // Hybrid check safe
         rankCache[uid] = 0; return 0;
    }

    let currentLevel = 1; // Base is VIP 1 if passed above

    // Cek Level 2 ke atas
    for (const rule of RANK_RULES) {
        if (rule.level === 1) continue; // Skip VIP 1 processed above

        if (team.length >= rule.min) {
            // Syarat 1: Struktur (2 Jalur Berbeda)
            const hasStructure = checkStructureCondition(uid, rule.reqVip);
            
            if (hasStructure) {
                currentLevel = Math.max(currentLevel, rule.level);
                continue; // Cek level lebih tinggi
            }

            // Syarat 2: Growth 50% 2 Periode Berturut-turut
            const hasGrowth = checkGrowthCondition(uid, rule.min);
            if (hasGrowth) {
                currentLevel = Math.max(currentLevel, rule.level);
                continue;
            }
        }
    }

    rankCache[uid] = currentLevel;
    return currentLevel;
}

function checkStructureCondition(uid, requiredVipLevel) {
    const key = `${uid}_legs_${requiredVipLevel}`;
    if (legCache[key] !== undefined) return legCache[key];

    const directs = globalData.filter(m => m.upline === uid);
    let validLegs = 0;

    for (const direct of directs) {
        if (hasVipInTree(direct.uid, requiredVipLevel)) {
            validLegs++;
        }
        if (validLegs >= 2) break;
    }

    const result = (validLegs >= 2);
    legCache[key] = result;
    return result;
}

function hasVipInTree(uid, targetLevel) {
    // Cek user ini sendiri
    if (getRankLevel(uid) >= targetLevel) return true;
    
    // Cek recursive downlines (tapi ini bisa lambat, pakai cache rank)
    const directs = globalData.filter(m => m.upline === uid);
    for (const d of directs) {
        if (hasVipInTree(d.uid, targetLevel)) return true;
    }
    return false;
}

function checkGrowthCondition(uid, minMembersReq) {
    // Mencari 2 periode terakhir (Previous dan Current/Before Previous)
    // Logika simplified: Jika user tidak punya struktur, dia harus punya history growth bagus.
    // Karena keterbatasan snapshot history, kita hitung growth real berdasarkan joinDate.
    
    const now = new Date();
    const pCurrent = getPeriodRange(now);
    const pPrev = getPreviousPeriodRange(pCurrent.start);
    const pPrev2 = getPreviousPeriodRange(pPrev.start);

    // Cek Growth Periode Lalu
    const gPrev = calculateTargetGrowth(uid, pPrev.start, pPrev.end);
    // Cek Growth 2 Periode Lalu
    const gPrev2 = calculateTargetGrowth(uid, pPrev2.start, pPrev2.end);

    return (gPrev.passed && gPrev2.passed);
}

// ============================================================
// KALKULASI TARGET & GROWTH (SESUAI RUMUS)
// ============================================================

function calculateTargetGrowth(uid, startDate, endDate) {
    const team = getDownlinesRecursive(uid);
    // Total Anggota = Anda (1) + Anggota bergabung SEBELUM periode dimulai
    const oldMembers = team.filter(m => m.joinDate < startDate).length;
    const totalBase = 1 + oldMembers; 
    
    // Target 50%
    const target = Math.ceil(totalBase / 2);
    
    // Pencapaian (Bergabung DALAM periode)
    const achievement = team.filter(m => m.joinDate >= startDate && m.joinDate <= endDate).length;
    
    // Sisa
    let gap = target - achievement;
    if (gap < 0) gap = 0;

    return {
        target: target,
        actual: achievement,
        gap: gap,
        passed: achievement >= target
    };
}

// ============================================================
// DASHBOARD & UI
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
function prepareMyTeamData(){const a=sessionStorage.getItem('userUid'),b=globalData.find(b=>b.uid===a);if(b){const c=getDownlinesRecursive(a);myTeamData=[b,...c]}}

function renderDashboard(){
    const uid = sessionStorage.getItem('userUid');
    if(!globalData.length) return location.reload();
    
    const user = globalData.find(u => u.uid === uid);
    if(!user) return logout();

    // Fill Info
    document.getElementById('mName').innerText = user.name;
    document.getElementById('mUid').innerText = user.uid;
    const upline = globalData.find(u => u.uid === user.upline);
    document.getElementById('mRefUid').innerText = upline ? upline.uid : '-';

    // Kalkulasi Tim & Rank
    rankCache = {}; legCache = {}; // Reset untuk hitungan baru
    const downlines = getDownlinesRecursive(uid);
    document.getElementById('totalMembers').innerText = downlines.length + 1; // +1 Diri sendiri (Total Tim)

    calculateMyRankDashboard(downlines.length + 1, uid);
    
    // Hitung Stats VIP untuk Kotak-Kotak
    myTeamData = [user, ...downlines];
    countVipStats(myTeamData);

    // =========================================
    // DATA PERIODE BERJALAN (DASHBOARD UTAMA)
    // =========================================
    const now = new Date();
    const pInfo = getPeriodRange(now);
    document.getElementById('currentPeriodLabel').innerText = pInfo.label;
    
    // Hitung Target Growth Periode Ini
    const growthStats = calculateTargetGrowth(uid, pInfo.start, pInfo.end);

    document.getElementById('prevPeriodCount').innerText = (growthStats.target * 2); // Reverse engineer base count (approx) or use logic inside func
    document.getElementById('targetCount').innerText = growthStats.target;
    document.getElementById('newMemberCount').innerText = growthStats.actual;
    document.getElementById('gapCount').innerText = growthStats.gap;

    currentGap = growthStats.gap; 
    globalTarget = growthStats.target;

    startCountdown(pInfo.end);
    showMotivation();
    
    // Grafik: Bandingkan Pencapaian Periode Lalu vs Sekarang
    const pPrev = getPreviousPeriodRange(pInfo.start);
    const prevStats = calculateTargetGrowth(uid, pPrev.start, pPrev.end);
    renderChart(prevStats.actual, growthStats.actual);
}

function calculateMyRankDashboard(teamSize, uid) {
    const curLevel = getRankLevel(uid);
    document.getElementById('rankName').innerText = curLevel > 0 ? `V.I.P ${curLevel}` : "MEMBER";
    
    const nextLevel = curLevel + 1;
    const nextRule = RANK_RULES.find(r => r.level === nextLevel);
    
    const nextGoalEl = document.getElementById('rankNextGoal');
    const gapEl = document.getElementById('nextLevelGap');
    
    if (nextRule) {
        const gap = Math.max(0, nextRule.min - teamSize);
        gapEl.innerText = gap;
        if (gap > 0) {
             nextGoalEl.innerText = `Menuju VIP ${nextLevel} (Kurang Member)`;
        } else {
             nextGoalEl.innerText = `Syarat: 2 Jalur @VIP${nextRule.reqVip} ATAU Growth 50%`;
             nextGoalEl.style.color = "#ff4444";
        }
    } else {
        nextGoalEl.innerText = "Top Rank";
        gapEl.innerText = "0";
    }
}

function countVipStats(teamMembers) {
    // Reset lists
    vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
    let counts = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    
    teamMembers.forEach(m => {
        // Skip user login dari list notifikasi (opsional)
        if (m.uid === sessionStorage.getItem('userUid')) return;

        const r = getRankLevel(m.uid);
        if (r > 0) {
            counts[r]++;
            vipLists[r].push(m);
        }
    });

    // Update UI Badges & Blink
    const now = new Date().getTime();
    for (let i = 1; i <= 9; i++) {
        const el = document.getElementById(`cVIP${i}`);
        if (el) {
            el.innerText = counts[i];
            
            // Cek notifikasi 24 jam untuk badge merah berkedip
            // Cek apakah ada member di list ini yg baru achieve (joinDate or history) < 24 jam
            const hasNew = vipLists[i].some(m => {
                // Gunakan history jika ada, jika tidak gunakan joinDate (sebagai fallback untuk member baru lgsg VIP)
                const hist = globalHistory.find(h => h.uid === m.uid && h.vip_level === i);
                const time = hist ? new Date(hist.achieved_at).getTime() : m.joinDate.getTime();
                return (now - time) < (24 * 60 * 60 * 1000);
            });
            
            if (hasNew) el.parentElement.classList.add('new-alert');
            else el.parentElement.classList.remove('new-alert');
        }
    }
}

function renderChart(prev, curr){
    const ctx = document.getElementById('growthChart').getContext('2d');
    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: ['LALU', 'SAAT INI'], datasets: [{ label: 'Growth', data: [prev, curr], backgroundColor: ['#333', '#D4AF37'], borderColor: '#D4AF37', borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { display:false }, x: { grid:{display:false}, ticks:{color:'#888'} } }, plugins: { legend: { display: false } } }
    });
}

// ============================================================
// MODAL VIP (PERIODE BERJALAN)
// ============================================================
// "Setiap kotak akan menampilkan daftar anggota... pada periode bulan yg sedang berjalan"

window.openVipModal = function(level) {
    const modal = document.getElementById('vipModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');
    
    // Tentukan Periode Berjalan
    const pInfo = getPeriodRange(new Date());
    
    title.innerText = `VIP ${level} - ${pInfo.label}`; 
    body.innerHTML = ''; 

    let list = vipLists[level] || [];
    
    // Urutkan dari yang terbaru (joinDate desc)
    list.sort((a,b) => b.joinDate - a.joinDate);
    
    if (list.length === 0) {
        body.innerHTML = '<div class="v-empty">Belum ada anggota.</div>';
    } else {
        const nowMs = new Date().getTime();

        list.forEach(m => {
            // Hitung Growth di Periode Berjalan
            const stat = calculateTargetGrowth(m.uid, pInfo.start, pInfo.end);
            
            // Cek Status Baru (24 Jam)
            const hist = globalHistory.find(h => h.uid === m.uid && h.vip_level === level);
            const time = hist ? new Date(hist.achieved_at).getTime() : m.joinDate.getTime();
            const isNew = (nowMs - time) < (24 * 60 * 60 * 1000);
            
            const badge = isNew ? `<span class="badge-new">🔥 BARU</span>` : '';
            const borderClass = isNew ? 'new-name-alert' : '';

            body.innerHTML += `
            <div class="v-item ${borderClass}">
                <div style="width:100%">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="v-n">${m.name} ${badge}</span>
                        <span class="v-u">${m.uid}</span>
                    </div>
                    <div style="display:flex; gap:10px; font-size:9px; border-top:1px dashed #333; padding-top:4px; margin-top:4px;">
                        <span style="color:#aaa;">Target: <b style="color:#fff;">${stat.target}</b></span>
                        <span style="color:#aaa;">Capai: <b style="color:var(--gold);">${stat.actual}</b></span>
                        <span style="color:#aaa;">Sisa: <b style="color:${stat.gap > 0 ? '#ff4444' : '#00ff00'};">${stat.gap}</b></span>
                    </div>
                </div>
            </div>`;
        });
    }
    modal.style.display = 'flex';
}
window.closeVipModal = function() { document.getElementById('vipModal').style.display = 'none'; }


// ============================================================
// MODAL PERAIH (PERIODE SEBELUMNYA)
// ============================================================
// "Tombol Navigasi bawah dengan label Peraih... akan menampilkan seluruh anggota yg berhasil mencapai target pertumbuhan 50% pada periode sebelumnya"

window.openAchieverModal = function() {
    const modal = document.getElementById('achieverModal');
    const body = document.getElementById('achieverBody');
    const title = document.getElementById('achieverTitle');
    const btnDl = document.getElementById('btnDlAchiever');
    
    // Tentukan Periode SEBELUMNYA
    const pCurr = getPeriodRange(new Date());
    const pPrev = getPreviousPeriodRange(pCurr.start);

    title.innerText = `PERAIH - ${pPrev.label}`;
    body.innerHTML = '<div class="v-empty">Memproses data...</div>';
    achieverTxtContent = `REPORT PERAIH GROWTH 50%\n${pPrev.label}\n====================\n\n`;

    setTimeout(() => {
        let successList = [];
        let failList = [];
        const myUid = sessionStorage.getItem('userUid');

        // Loop SEMUA anggota Naga Persada yang VIP
        // (Bisa pakai globalData atau myTeamData tergantung requirement "Daftar seluruh anggota Naga Persada".
        // Biasanya user hanya bisa lihat timnya sendiri, tapi jika prompt bilang seluruh, kita pakai globalData jika role admin, 
        // tapi aman-nya pakai myTeamData (Tim user) atau globalData jika diizinkan).
        // Kita gunakan myTeamData (Jaringan user) agar konsisten.
        
        myTeamData.forEach(m => {
            const rank = getRankLevel(m.uid);
            if (rank > 0) {
                // Hitung Growth di Periode LALU
                const stat = calculateTargetGrowth(m.uid, pPrev.start, pPrev.end);
                
                const item = {
                    name: m.name,
                    uid: m.uid,
                    rank: rank,
                    target: stat.target,
                    actual: stat.actual,
                    gap: stat.gap
                };

                if (stat.passed) successList.push(item);
                else failList.push(item);
            }
        });

        // RENDER HASIL
        let html = '';
        
        // SUKSES
        if (successList.length > 0) {
            html += `<div style="padding:8px; background:#112211; color:#0f0; font-weight:bold; font-size:10px; border-bottom:1px solid #333;">🏆 LOLOS TARGET (${successList.length})</div>`;
            achieverTxtContent += `[ LOLOS TARGET ]\n`;
            
            successList.sort((a,b) => b.rank - a.rank || b.actual - a.actual); // Sort by Rank lalu Actual
            
            successList.forEach((x, i) => {
                const nameDisplay = (x.uid === myUid) ? `${x.name} (ANDA)` : x.name;
                html += `
                <div class="achiever-item" style="border-left:3px solid #0f0;">
                    <div class="achiever-top">
                        <span class="v-n">${i+1}. ${nameDisplay} <small style="color:var(--gold)">VIP ${x.rank}</small></span>
                        <span class="v-u">${x.uid}</span>
                    </div>
                    <div class="achiever-stats">
                        <span>Target: <b class="val-target">${x.target}</b></span>
                        <span>Capai: <b style="color:#0f0;">${x.actual}</b></span>
                    </div>
                </div>`;
                achieverTxtContent += `${i+1}. ${x.name} (${x.uid}) VIP ${x.rank} | T:${x.target} C:${x.actual}\n`;
            });
            achieverTxtContent += `\n`;
        }

        // GAGAL
        if (failList.length > 0) {
            html += `<div style="padding:8px; background:#221111; color:#f44; font-weight:bold; font-size:10px; border-bottom:1px solid #333; margin-top:10px;">⚠️ GAGAL TARGET (${failList.length})</div>`;
            achieverTxtContent += `[ GAGAL TARGET ]\n`;
            
            failList.sort((a,b) => b.rank - a.rank || b.gap - a.gap);

            failList.forEach((x, i) => {
                const nameDisplay = (x.uid === myUid) ? `${x.name} (ANDA)` : x.name;
                html += `
                <div class="achiever-item" style="border-left:3px solid #f44;">
                    <div class="achiever-top">
                        <span class="v-n">${i+1}. ${nameDisplay} <small style="color:#888">VIP ${x.rank}</small></span>
                        <span class="v-u">${x.uid}</span>
                    </div>
                    <div class="achiever-stats">
                        <span>Target: <b class="val-target">${x.target}</b></span>
                        <span>Capai: <b style="color:#f44;">${x.actual}</b> (Kurang ${x.gap})</span>
                    </div>
                </div>`;
                achieverTxtContent += `${i+1}. ${x.name} (${x.uid}) VIP ${x.rank} | T:${x.target} C:${x.actual} Gap:${x.gap}\n`;
            });
        }

        if (successList.length === 0 && failList.length === 0) {
            html = '<div class="v-empty">Tidak ada data VIP di periode lalu.</div>';
        }

        body.innerHTML = html;
        btnDl.style.display = 'block';

    }, 100);

    modal.style.display = 'flex';
}

function downloadAchieverData() { 
    if(!achieverTxtContent) return; 
    const blob=new Blob([achieverTxtContent],{type:'text/plain'}); 
    const a=document.createElement('a'); 
    a.href=URL.createObjectURL(blob); 
    a.download='laporan_peraih.txt'; 
    a.click(); 
}
window.closeAchieverModal = function() { document.getElementById('achieverModal').style.display = 'none'; }


// ============================================================
// UTILITIES LIST & NETWORK
// ============================================================
function initList(){window.sortData=a=>{sortState.col===a?sortState.dir='asc'===sortState.dir?'desc':'asc':(sortState.col=a,sortState.dir='asc'),renderTable()},renderTable()}
function renderTable(){const a=document.getElementById('membersTableBody'),{col:b,dir:c}=sortState,d=[...myTeamData].sort((a,d)=>{let e=a[b],f=d[b];return'joinDate'===b?'asc'===c?e-f:f-e:(e=e.toLowerCase(),f=f.toLowerCase(),'asc'===c?e<f?-1:1:e>f?1:-1)});let e='';d.forEach((a,b)=>{const c=a.joinDate,d=`${String(c.getDate()).padStart(2,'0')}/${String(c.getMonth()+1).padStart(2,'0')}/${c.getFullYear()}`,f=a.upline?a.upline:'-';e+=`<tr><td class="col-no">${b+1}</td><td class="col-name">${a.name}</td><td class="col-uid">${a.uid}</td><td class="col-ref">${f}</td><td class="col-date">${d}</td></tr>`}),a.innerHTML=e}

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
        const r = getRankLevel(a.uid); const isVip = r>=1;
        let star = isVip ? "⭐".repeat(r)+" " : "";
        return { key:a.uid, label:`${star}${a.uid} / ${a.name} / ${c}`, strokeColor:isVip?"#ffd700":"#ffffff",strokeWidth:isVip?2:1 }
    });
    const e=myTeamData.filter(a=>a.upline&&""!==a.upline).map(a=>({from:a.upline,to:a.uid}));
    c.model=new go.GraphLinksModel(d,e);
    window.downloadNetworkImage=function(){const a=c.makeImage({scale:2,background:"#000",maxSize:new go.Size(Infinity,Infinity),padding:new go.Margin(50)}),b=document.createElement("a");b.href=a.src,b.download="jaringan_dvteam.png",document.body.appendChild(b),b.click(),document.body.removeChild(b)}
};

// ============================================================
// EXTRAS (COUNTDOWN, MOTIVASI, SHARE)
// ============================================================
let intervalId; 
function startCountdown(targetDate) {
    if (intervalId) clearInterval(intervalId);
    function updateTimer() {
        const now = new Date().getTime(); const distance = targetDate.getTime() - now;
        if (distance < 0) { clearInterval(intervalId); document.getElementById("cdDays").textContent="00"; document.getElementById("cdHours").textContent="00"; document.getElementById("cdMin").textContent="00"; document.getElementById("cdSec").textContent="00"; return; }
        const days = Math.floor(distance / (1000 * 60 * 60 * 24)); const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)); const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        document.getElementById("cdDays").textContent=days<10?"0"+days:days; document.getElementById("cdHours").textContent=hours<10?"0"+hours:hours; document.getElementById("cdMin").textContent=minutes<10?"0"+minutes:minutes; document.getElementById("cdSec").textContent=seconds<10?"0"+seconds:seconds;
    }
    updateTimer(); intervalId = setInterval(updateTimer, 1000);
}
const wordBank = { openings: ["🔥 SAYA SIAP BERTEMPUR!", "⚠️ PERINGATAN KERAS!", "🚀 JANGAN LENGAH!", "🦁 BANGKITLAH PEMENANG!", "💎 MENTAL JUTAWAN!"], conditions: ["Hari ini musuhmu sedang bekerja keras,", "Target tidak akan menunggu kamu siap,", "Kemiskinan sedang mengintip di depan pintu,", "Orang lain sudah berlari dua kali lebih cepat,"], actions: ["maka HANCURKAN rasa malasmu sekarang!", "segera RAPATKAN BARISAN dan kejar ketertinggalan!", "buktikan kamu bukan PENGECUT!", "ubah keringatmu menjadi EMAS!"], closings: ["PASTI BISA!", "GASPOLL!", "TUNTASKAN!", "REBUT!", "SEKARANG!"] };
function generateDynamicQuote() { const r = (arr) => arr[Math.floor(Math.random() * arr.length)]; return `"${r(wordBank.openings)} ${r(wordBank.conditions)} ${r(wordBank.actions)} ${r(wordBank.closings)}"`; }
function showMotivation() { if (!sessionStorage.getItem('isLoggedIn')) return; const modal = document.getElementById('motivationModal'); const textEl = document.getElementById('dailyMotivation'); if (modal && textEl) { textEl.innerText = generateDynamicQuote(); modal.style.display = 'flex'; } }
window.closeMotivation = function() { const modal = document.getElementById('motivationModal'); if (modal) { modal.style.opacity = '0'; setTimeout(() => { modal.style.display = 'none'; modal.style.opacity = '1'; }, 300); } }
const groupWords = { headers: ["🔥 UPDATE MEMBARA", "🚀 INFO PENTING TIM", "⚠️ SIAGA SATU", "🏆 LAPORAN PERTEMPURAN"], intros: ["Keberhasilan tim bukan dinilai dari seberapa cepat kita berlari, tapi seberapa kuat kita saling menggandeng.", "Jangan biarkan mimpi mati hanya karena malas. INGAT ALASAN KITA MEMULAI!"], alerts: ["Tetap fokus pada pertumbuhan 50%", "Jangan kasih kendor, kejar target 50%", "Rapatkan barisan, fokus angka 50%"], closings: ["Gow .. Gaaaaass sampai tembus..!! 💪🏻", "Ayo buktikan kita bisa..!! 🚀", "Salam satu komando..!! 🔥"] };
window.openShareModal = function() { generateShareText(); document.getElementById('shareModal').style.display = 'flex'; }
window.generateShareText = function() { const txtArea = document.getElementById('shareText'); const r = (arr) => arr[Math.floor(Math.random() * arr.length)]; const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']; const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']; const now = new Date(); const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`; const finalTxt = `${r(groupWords.headers)} \nDVTEAM NP 🔥\n\n` + `📅 ${dateStr}\n` + `👥 Target 50%: *${globalTarget} Anggota*\n\n` + `"${r(groupWords.intros)}"\n\n` + `🚀 ${r(groupWords.alerts)} = sisa ${currentGap} anggota lagi..!! 🏆\n` + `${r(groupWords.closings)}\n` + `#DVTeamNP #SatuVisi #SatuMisi #SatuKomando`; txtArea.value = finalTxt; }
window.copyShareText = function() { const txtArea = document.getElementById('shareText'); txtArea.select(); txtArea.setSelectionRange(0, 99999); navigator.clipboard.writeText(txtArea.value).then(() => { alert("✅ Teks berhasil disalin! Silakan tempel di Grup WhatsApp."); }); }
window.closeShareModal = function() { document.getElementById('shareModal').style.display = 'none'; }
