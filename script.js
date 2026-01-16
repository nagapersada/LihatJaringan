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

// [FITUR TURBO] LOAD DATA PARALEL
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
    myTeamData = [b,...d]; 
    countVipStats(myTeamData); 
    
    const h=new Date,i=h.getDate(),j=h.getMonth(),k=h.getFullYear();let l,m,n;
    let countDownTarget;
    let chartStartPrev, chartEndPrev;

    let prevM = j - 1, prevY = k;
    if (prevM < 0) { prevM = 11; prevY--; }
    const daysInPrevMonth = new Date(prevY, prevM + 1, 0).getDate();

    if (i === 31) {
        l = new Date(k, j, 31); 
        m = new Date(k, j, 30, 23, 59, 59); 
        n = "PERIODE 1 (BLN DEPAN)";
        countDownTarget = new Date(k, j + 1, 15, 23, 59, 59);
        chartStartPrev = new Date(k, j, 16); chartEndPrev = new Date(k, j, 30, 23, 59, 59);
    } else if (i <= 15) {
        l = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 31) : new Date(k, j, 1); 
        m = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 30, 23, 59, 59) : new Date(k, j, 0, 23, 59, 59);
        n = `PERIODE 1 (${getMonthName(j)})`;
        countDownTarget = new Date(k, j, 15, 23, 59, 59);
        chartStartPrev = new Date(prevY, prevM, 16); chartEndPrev = m;
    } else {
        l = new Date(k, j, 16); 
        m = new Date(k, j, 15, 23, 59, 59); 
        n = `PERIODE 2 (${getMonthName(j)})`; 
        countDownTarget = new Date(k, j, 30, 23, 59, 59); 
        chartStartPrev = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 31) : new Date(k, j, 1);
        chartEndPrev = new Date(k, j, 15, 23, 59, 59);
    }
    
    document.getElementById('currentPeriodLabel').innerText=n;
    startCountdown(countDownTarget);
    showMotivation();

    const totalAccumulatedPrev = myTeamData.filter(a => a.joinDate <= m).length;
    const currentGrowth = myTeamData.filter(a => a.joinDate >= l).length;
    const target = Math.ceil(totalAccumulatedPrev / 2);
    let gap = target - currentGrowth; 
    if(gap < 0) gap = 0;
    
    currentGap = gap; globalTarget = target; 

    document.getElementById('prevPeriodCount').innerText = totalAccumulatedPrev;
    document.getElementById('targetCount').innerText = target;
    document.getElementById('newMemberCount').innerText = currentGrowth;
    document.getElementById('gapCount').innerText = gap;

    const chartGrowthPrev = myTeamData.filter(a => a.joinDate >= chartStartPrev && a.joinDate <= chartEndPrev).length;
    renderChart(chartGrowthPrev, currentGrowth);
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

function countVipsInPaths(uid, targetLevel) {
    const directDownlines = globalData.filter(m => m.upline === uid);
    let count = 0;
    for (const direct of directDownlines) {
        const branch = [direct, ...getDownlinesRecursive(direct.uid)];
        if (branch.some(m => getRankLevel(m.uid) >= targetLevel)) count++;
    }
    return count;
}

function checkConsecutiveGrowth(uid) {
    const userSuccess = globalAchievers.filter(a => a.uid === uid);
    return userSuccess.length >= 2;
}

function getRankLevel(uid){
    if (rankCache[uid] !== undefined) return rankCache[uid];
    const team = [globalData.find(m => m.uid === uid), ...getDownlinesRecursive(uid)];
    const total = team.length;
    const direct = globalData.filter(b=>b.upline===uid).length;
    
    const rankTiers = [
        {level:9,min:3501,reqLevel:8}, {level:8,min:1601,reqLevel:7}, {level:7,min:901,reqLevel:6},
        {level:6,min:501,reqLevel:5}, {level:5,min:351,reqLevel:4}, {level:4,min:201,reqLevel:3},
        {level:3,min:101,reqLevel:2}, {level:2,min:31,reqLevel:1}
    ];
    
    let result = (direct >= 5) ? 1 : 0;
    for(const tier of rankTiers) {
        if (total >= tier.min) {
            const pathCount = countVipsInPaths(uid, tier.reqLevel);
            if (pathCount >= 2 || checkConsecutiveGrowth(uid)) { 
                result = tier.level; 
                break; 
            }
        }
    }
    rankCache[uid] = result;
    return result;
}

function getHistoricalRankLevel(uid, cutoffDate) {
    const cacheKey = uid + "_" + cutoffDate.getTime();
    if (histRankCache[cacheKey] !== undefined) return histRankCache[cacheKey];
    const team = [globalData.find(m => m.uid === uid), ...getDownlinesRecursive(uid)].filter(m => m.joinDate <= cutoffDate);
    const direct = globalData.filter(b => b.upline === uid && b.joinDate <= cutoffDate).length;
    let result = (direct >= 5) ? 1 : 0;
    histRankCache[cacheKey] = result;
    return result;
}

async function checkAndSaveHistory(uid, level) {
    const exists = globalHistory.find(h => h.uid === uid && h.vip_level === level);
    if (!exists) {
        const now = new Date().toISOString();
        globalHistory.push({ uid: uid, vip_level: level, achieved_at: now });
        db.from('vip_history').insert([{ uid: uid, vip_level: level, achieved_at: now }]).then(({ error }) => { if (error) console.log("Save Err:", error); });
    }
}

function countVipStats(a){
    rankCache = {}; 
    let b={1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
    a.forEach(m=>{
        let c=getRankLevel(m.uid);
        if(c>=1&&c<=9){ b[c]++; vipLists[c].push(m); checkAndSaveHistory(m.uid, c); }
    });
    for(let i=1;i<=9;i++){
        const el=document.getElementById(`cVIP${i}`);
        if(el) el.innerText=b[i];
    }
}

window.openVipModal = function(level) {
    const modal = document.getElementById('vipModal'), body = document.getElementById('modalBody'), title = document.getElementById('modalTitle');
    title.innerText = `DAFTAR V.I.P ${level}`; body.innerHTML = ''; 
    if (vipLists[level].length > 0) {
        vipLists[level].forEach(m => {
            body.innerHTML += `<div class="v-item"><span class="v-n">${m.name}</span><span class="v-u">${m.uid}</span></div>`;
        });
    } else { body.innerHTML = '<div class="v-empty">Belum ada anggota.</div>'; }
    modal.style.display = 'flex';
}
window.closeVipModal = function() { document.getElementById('vipModal').style.display = 'none'; }

function calculateMyRank(currentTeamSize, directDownlineCount, uid) {
    const curLevel = getRankLevel(uid); 
    document.getElementById('rankName').innerText = curLevel > 0 ? "V.I.P " + curLevel : "MEMBER";
    document.getElementById('rankNextGoal').innerText = curLevel < 9 ? "Menuju V.I.P " + (curLevel + 1) : "Top Level";
}

function initList(){window.sortData=a=>{sortState.col===a?sortState.dir='asc'===sortState.dir?'desc':'asc':(sortState.col=a,sortState.dir='asc'),renderTable()},renderTable()}function renderTable(){const a=document.getElementById('membersTableBody'),{col:b,dir:c}=sortState,d=[...myTeamData].sort((a,d)=>{let e=a[b],f=d[b];return'joinDate'===b?'asc'===c?e-f:f-e:(e=e.toLowerCase(),f=f.toLowerCase(),'asc'===c?e<f?-1:1:e>f?1:-1)});let e='';d.forEach((a,b)=>{const c=a.joinDate,d=`${String(c.getDate()).padStart(2,'0')}/${String(c.getMonth()+1).padStart(2,'0')}/${c.getFullYear()}`,f=a.upline?a.upline:'-';e+=`<tr><td class="col-no">${b+1}</td><td class="col-name">${a.name}</td><td class="col-uid">${a.uid}</td><td class="col-ref">${f}</td><td class="col-date">${d}</td></tr>`}),a.innerHTML=e}

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
        const rank = getRankLevel(a.uid); let starStr = ""; if(rank > 0) { starStr = "⭐".repeat(rank) + " "; }
        return { key:a.uid, label:`${starStr}${a.uid} / ${a.name} / ${c}`, strokeColor:"#ffffff",strokeWidth:1 }
    });
    const e=myTeamData.filter(a=>a.upline&&""!==a.upline).map(a=>({from:a.upline,to:a.uid}));
    c.model=new go.GraphLinksModel(d,e);
    const f=c.findNodeForKey(a);f&&(c.centerRect(f.actualBounds),f.isSelected=!0),window.downloadNetworkImage=function(){const a=c.makeImage({scale:2,background:"#000",maxSize:new go.Size(Infinity,Infinity),padding:new go.Margin(50)}),b=document.createElement("a");b.href=a.src,b.download="jaringan_dvteam.png",document.body.appendChild(b),b.click(),document.body.removeChild(b)}
};

function getMonthName(a){return["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"][a]}

function openAchieverModal() {
    const modal = document.getElementById('achieverModal'), body = document.getElementById('achieverBody'), title = document.getElementById('achieverTitle'), btnDl = document.getElementById('btnDlAchiever');
    modal.style.display = 'flex'; body.innerHTML = '<div class="v-empty">Sedang menghitung data peraih...</div>'; btnDl.style.display = 'none'; achieverTxtContent = "";
    const now = new Date(), d = now.getDate(), m = now.getMonth(), y = now.getFullYear();
    let startP, endP, plabel, baseCutoff;
    if (d >= 16 && d <= 30) {
        let lastDayPrev = new Date(y, m, 0);
        startP = (lastDayPrev.getDate() === 31) ? new Date(y, m - 1, 31) : new Date(y, m, 1);
        endP = new Date(y, m, 15, 23, 59, 59);
        baseCutoff = new Date(y, m - 1, 30, 23, 59, 59);
        plabel = `PERIODE 1 (${getMonthName(m)} ${y})`;
    } else {
        let tM = m - 1, tY = y; 
        if (d === 31) tM = m; else if (tM < 0) { tM = 11; tY--; }
        startP = new Date(tY, tM, 16); endP = new Date(tY, tM, 30, 23, 59, 59);
        baseCutoff = new Date(tY, tM, 15, 23, 59, 59);
        plabel = `PERIODE 2 (${getMonthName(tM)} ${tY})`;
    }
    title.innerText = `REPORT GROWTH - ${plabel}`; achieverTxtContent = `REPORT GROWTH 50%\n${plabel}\n================\n\n`;
    setTimeout(() => {
        let successList = [], failureList = [];
        myTeamData.forEach(mem => {
            if (new Date(mem.joinDate) > endP) return;
            const dls = getDownlinesRecursive(mem.uid);
            const baseCount = dls.filter(dl => dl.joinDate <= baseCutoff).length + 1;
            const growCount = dls.filter(dl => { const jd = new Date(dl.joinDate); return jd >= startP && jd <= endP; }).length;
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

function renderAchieverList(successList, failureList, body, btnDl) {
    successList.sort((a,b) => b.actual - a.actual); failureList.sort((a,b) => b.actual - a.actual);
    btnDl.style.display = 'block'; let html = ''; const myUid = sessionStorage.getItem('userUid');
    if (successList.length > 0) {
        html += `<div style="padding:10px 15px; background:#112211; color:#00ff00; font-weight:bold; border-bottom:1px solid #333;">🏆 PERAIH TARGET (SUKSES)</div>`;
        successList.forEach((a,i) => { const displayName = (a.uid === myUid) ? a.name + " (ANDA)" : a.name; html += `<div class="achiever-item" style="border-left:3px solid #00ff00;"><div class="achiever-top"><span class="v-n">${i+1}. ${displayName} <small style="color:var(--gold)">(VIP ${a.rank})</small></span><span class="v-u">${a.uid}</span></div><div class="achiever-stats"><span>Target: <b class="val-target">${a.target}</b></span><span>Capaian: <b class="val-actual" style="color:#00ff00;">${a.actual}</b></span></div></div>`; achieverTxtContent += `${i+1}. ${a.name} (${a.uid}) - VIP ${a.rank} | Target: ${a.target} | Actual: ${a.actual}\n`; });
    }
    if (failureList.length > 0) {
        html += `<div style="padding:10px 15px; background:#221111; color:#ff4444; font-weight:bold; border-bottom:1px solid #333; margin-top:10px;">⚠️ BELUM TERCAPAI</div>`;
        failureList.forEach((a,i) => { const displayName = (a.uid === myUid) ? a.name + " (ANDA)" : a.name; const gap = a.target - a.actual; html += `<div class="achiever-item" style="border-left:3px solid #ff4444;"><div class="achiever-top"><span class="v-n">${i+1}. ${displayName} <small style="color:#666">(VIP ${a.rank})</small></span><span class="v-u">${a.uid}</span></div><div class="achiever-stats"><span>Target: <b class="val-target">${a.target}</b></span><span>Capaian: <b style="color:#ff4444;">${a.actual}</b></span></div></div>`; achieverTxtContent += `${i+1}. ${a.name} (${a.uid}) - VIP ${a.rank} | Target: ${a.target} | Actual: ${a.actual}\n`; });
    }
    if (successList.length === 0 && failureList.length === 0) { html = '<div class="v-empty">Belum ada data peraih untuk periode ini.</div>'; }
    body.innerHTML = html;
}

function downloadAchieverData() { if(!achieverTxtContent) return; const blob=new Blob([achieverTxtContent],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='laporan_growth.txt'; a.click(); }
function closeAchieverModal() { document.getElementById('achieverModal').style.display = 'none'; }

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

// BANK KALIMAT MOTIVASI
const wordBank = { 
    openings: ["🔥 SAYA SIAP BERTEMPUR!", "⚠️ PERINGATAN KERAS!", "🚀 JANGAN LENGAH!", "🦁 BANGKITLAH PEMENANG!", "💎 MENTAL JUTAWAN!", "⚡ UPDATE PENTING!", "🏆 MATA TERTUJU PADA PIALA!", "⚔️ SAATNYA SERANGAN BALIK!"], 
    conditions: ["Hari ini musuhmu sedang bekerja keras,", "Target tidak akan menunggu kamu siap,", "Kemiskinan sedang mengintip di depan pintu,", "Orang lain sudah berlari dua kali lebih cepat,", "Jika kamu diam sekarang, kamu akan tertinggal selamanya,", "Dunia tidak peduli dengan alasanmu,", "Ingat janji yang kamu ucapkan pada dirimu sendiri,"], 
    actions: ["maka HANCURKAN rasa malasmu sekarang!", "segera RAPATKAN BARISAN dan kejar ketertinggalan!", "buktikan kamu bukan PENGECUT!", "ubah keringatmu menjadi EMAS!", "berhenti mengeluh dan MULAI BERGERAK!", "tunjukkan siapa RAJA di arena ini!", "jangan pulang sebelum MENANG!"], 
    closings: ["PASTI BISA!", "GASPOLL!", "TUNTASKAN!", "REBUT!", "SEKARANG!", "JANGAN NYERAH!", "LEDAKKAN!"] 
};

function generateDynamicQuote() { const r = (arr) => arr[Math.floor(Math.random() * arr.length)]; return `"${r(wordBank.openings)} ${r(wordBank.conditions)} ${r(wordBank.actions)} ${r(wordBank.closings)}"`; }
function showMotivation() { if (!sessionStorage.getItem('isLoggedIn')) return; const modal = document.getElementById('motivationModal'); const textEl = document.getElementById('dailyMotivation'); if (modal && textEl) { textEl.innerText = generateDynamicQuote(); modal.style.display = 'flex'; } }
window.closeMotivation = function() { const modal = document.getElementById('motivationModal'); if (modal) { modal.style.opacity = '0'; setTimeout(() => { modal.style.display = 'none'; modal.style.opacity = '1'; }, 300); } }

const groupWords = { 
    headers: ["🔥 UPDATE MEMBARA", "🚀 INFO PENTING TIM", "⚠️ SIAGA SATU", "🏆 LAPORAN PERTEMPURAN", "⚡ KABAR DARI GARIS DEPAN"], 
    intros: ["Keberhasilan tim bukan dinilai dari seberapa cepat kita berlari, tapi seberapa kuat kita saling menggandeng.", "Jangan biarkan mimpi mati hanya karena malas. INGAT ALASAN KITA MEMULAI!", "Pemenang bukan orang yang tak pernah gagal, tapi yang tak pernah menyerah.", "Satu orang bisa berjalan cepat, tapi satu tim bisa berjalan jauh.", "Badai ini akan membuat kita makin kuat! Jangan jadi penonton.", "Fokus pada solusi, bukan keluhan. Kita adalah tim pemenang!", "Waktu tidak bisa diputar ulang. Apa yang kita tanam hari ini, kita panen nanti."], 
    alerts: ["Tetap fokus pada pertumbuhan 50%", "Jangan kasih kendor, kejar target 50%", "Rapatkan barisan, fokus angka 50%", "Genjot lagi semangatnya, sasar 50%", "Jangan tidur nyenyak sebelum tembus 50%"], 
    closings: ["Gow .. Gaaaaass sampai tembus..!! 💪🏻", "Ayo buktikan kita bisa..!! 🚀", "Salam satu komando..!! 🔥", "Jangan pulang sebelum menang..!! ⚔️", "Hancurkan rasa malas, gasspoll..!! 💎"] 
};

window.openShareModal = function() { generateShareText(); document.getElementById('shareModal').style.display = 'flex'; }
window.generateShareText = function() { 
    const txtArea = document.getElementById('shareText'); 
    const r = (arr) => arr[Math.floor(Math.random() * arr.length)]; 
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']; 
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']; 
    const now = new Date(); 
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`; 
    const finalTxt = `${r(groupWords.headers)} \nDVTEAM NP 🔥\n\n` + `📅 ${dateStr}\n` + `👥 Target 50%: *${globalTarget} Anggota*\n\n` + `"${r(groupWords.intros)}"\n\n` + `🚀 ${r(groupWords.alerts)} = sisa ${currentGap} anggota lagi..!! 🏆\n` + `${r(groupWords.closings)}\n` + `#DVTeamNP #SatuVisi #SatuMisi #SatuKomando`; 
    txtArea.value = finalTxt; 
}
window.copyShareText = function() { const txtArea = document.getElementById('shareText'); txtArea.select(); txtArea.setSelectionRange(0, 99999); navigator.clipboard.writeText(txtArea.value).then(() => { alert("✅ Teks berhasil disalin! Silakan tempel di Grup WhatsApp."); }); }
window.closeShareModal = function() { document.getElementById('shareModal').style.display = 'none'; }
