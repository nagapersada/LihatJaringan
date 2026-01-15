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

        // Reset Cache
        rankCache = {}; histRankCache = {}; downlineCache = {};

    } catch (a) {
        console.error("Login Error:", a);
        alert("Gagal memuat data. Cek koneksi internet.");
    }
}

// CACHE VARS
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

    const totalAccumulatedPrev = g.filter(a => a.joinDate <= m).length;
    const currentGrowth = g.filter(a => a.joinDate >= l).length;
    const target = Math.ceil(totalAccumulatedPrev / 2);
    let gap = target - currentGrowth; 
    if(gap < 0) gap = 0;
    
    currentGap = gap; globalTarget = target; 

    document.getElementById('prevPeriodCount').innerText = totalAccumulatedPrev;
    document.getElementById('targetCount').innerText = target;
    document.getElementById('newMemberCount').innerText = currentGrowth;
    document.getElementById('gapCount').innerText = gap;

    const chartGrowthPrev = g.filter(a => a.joinDate >= chartStartPrev && a.joinDate <= chartEndPrev).length;
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

function countSpecificVipInTeam(teamMembers, targetLevel) {
    let count = 0;
    for (let i = 1; i < teamMembers.length; i++) {
        const downlineRank = getRankLevel(teamMembers[i].uid); 
        if (downlineRank >= targetLevel) { count++; }
    }
    return count;
}

function getRankLevel(uid){
    if (rankCache[uid] !== undefined) return rankCache[uid];
    const teamMembers = [globalData.find(member => member.uid === uid), ...getDownlinesRecursive(uid)];
    const totalMembers = teamMembers.length;
    const directDownlinesCount = globalData.filter(b=>b.upline===uid).length;
    const vip2InTeam = countSpecificVipInTeam(teamMembers, 2); 
    const vip1InTeam = countSpecificVipInTeam(teamMembers, 1);
    const rankTiers = [{level:9,min:3501,reqVip:2,reqLevel:2},{level:8,min:1601,reqVip:2,reqLevel:2},{level:7,min:901,reqVip:2,reqLevel:2},{level:6,min:501,reqVip:2,reqLevel:2},{level:5,min:351,reqVip:2,reqLevel:2},{level:4,min:201,reqVip:2,reqLevel:2},{level:3,min:101,reqVip:2,reqLevel:2},{level:2,min:31,reqVip:2,reqLevel:1}];
    let result = 0;
    if (directDownlinesCount >= 5) result = 1;
    for(const tier of rankTiers) {
        if (totalMembers >= tier.min) {
            let currentVips = (tier.level >= 3) ? vip2InTeam : vip1InTeam;
            if (currentVips >= tier.reqVip) { result = tier.level; break; }
        }
    }
    rankCache[uid] = result;
    return result;
}

function getHistoricalRankLevel(uid, cutoffDate) {
    const cacheKey = uid + "_" + cutoffDate.getTime();
    if (histRankCache[cacheKey] !== undefined) return histRankCache[cacheKey];
    const allDownlines = getDownlinesRecursive(uid);
    const historicalDownlines = allDownlines.filter(m => new Date(m.joinDate) <= cutoffDate);
    const memberSelf = globalData.find(m => m.uid === uid);
    if(!memberSelf) return 0;
    const teamMembers = [memberSelf, ...historicalDownlines];
    const totalMembers = teamMembers.length; 
    const directDownlinesCount = globalData.filter(b => b.upline === uid && new Date(b.joinDate) <= cutoffDate).length;
    let result = 0;
    if (directDownlinesCount >= 5) result = 1;
    histRankCache[cacheKey] = result;
    return result;
}

async function checkAndSaveHistory(uid, level) {
    const exists = globalHistory.find(h => h.uid === uid && h.vip_level === level);
    if (!exists) {
        const now = new Date().toISOString();
        globalHistory.push({ uid: uid, vip_level: level, achieved_at: now });
        db.from('vip_history').insert([{ uid: uid, vip_level: level, achieved_at: now }])
          .then(({ error }) => { if (error) console.log("Save Err:", error); });
    }
}

async function checkAndSaveAchiever(uid, period, target, actual, rank) {
    const exists = globalAchievers.find(h => h.uid === uid && h.period === period);
    if (!exists) {
        const now = new Date().toISOString();
        globalAchievers.push({ uid, period, target, actual, rank, created_at: now });
        db.from('achiever_history').insert([{ uid, period, target, actual, rank }])
          .then(({ error }) => { if (error) console.log("Save Achiever Err:", error); });
    }
}

async function checkAndSaveFailure(uid, period, target, actual, rank) {
    const exists = globalFailures.find(h => h.uid === uid && h.period === period);
    if (!exists) {
        const now = new Date().toISOString();
        globalFailures.push({ uid, period, target, actual, rank, created_at: now });
        db.from('failure_history').insert([{ uid, period, target, actual, rank }])
          .then(({ error }) => { if (error) console.log("Save Failure Err:", error); });
    }
}

function countVipStats(a){
    rankCache = {}; 
    let b={1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
    a.forEach(m=>{
        let c=getRankLevel(m.uid);
        if(c>=1&&c<=9){
            b[c]++;
            vipLists[c].push(m);
            checkAndSaveHistory(m.uid, c);
        }
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

// ============================================================
// PERBAIKAN LOGIKA PERAIH (Berdasarkan Instruksi Terakhir)
// ============================================================
function openAchieverModal() {
    const modal = document.getElementById('achieverModal'), body = document.getElementById('achieverBody'), title = document.getElementById('achieverTitle'), btnDl = document.getElementById('btnDlAchiever');
    modal.style.display = 'flex'; body.innerHTML = '<div class="v-empty">Sedang memproses data...</div>'; btnDl.style.display = 'none'; achieverTxtContent = "";
    
    const now = new Date(), d = now.getDate(), m = now.getMonth(), y = now.getFullYear();
    let startP, endP, plabel, baseCutoff;

    // JIKA TGL 16-30: MENAMPILKAN HASIL PERIODE 1 (31 s/d 15)
    if (d >= 16 && d <= 30) {
        let lastDayPrev = new Date(y, m, 0);
        startP = (lastDayPrev.getDate() === 31) ? new Date(y, m - 1, 31) : new Date(y, m, 1);
        endP = new Date(y, m, 15, 23, 59, 59);
        baseCutoff = new Date(y, m - 1, 30, 23, 59, 59); // Dasar target sampai tgl 30 jam 23.59.59
        plabel = `PERIODE 1 (${getMonthName(m)} ${y})`;
    } 
    // JIKA TGL 31 s/d 15: MENAMPILKAN HASIL PERIODE 2 (16 s/d 30)
    else {
        let tM = m - 1, tY = y; 
        if (d === 31) tM = m; else if (tM < 0) { tM = 11; tY--; }
        startP = new Date(tY, tM, 16); endP = new Date(tY, tM, 30, 23, 59, 59);
        baseCutoff = new Date(tY, tM, 15, 23, 59, 59); // Dasar target sampai tgl 15 jam 23.59.59
        plabel = `PERIODE 2 (${getMonthName(tM)} ${tY})`;
    }

    title.innerText = `REPORT GROWTH - ${plabel}`; achieverTxtContent = `REPORT GROWTH 50%\n${plabel}\n================\n\n`;

    setTimeout(() => {
        let successList = [], failureList = [];
        myTeamData.forEach(mem => {
            if (new Date(mem.joinDate) > endP) return;
            const dls = getDownlinesRecursive(mem.uid);
            // LOGIKA: Total anggota + Anda (Base) sampai cutoff periode lalu
            const baseCount = dls.filter(dl => dl.joinDate <= baseCutoff).length + 1;
            const growCount = dls.filter(dl => dl.joinDate >= startP && dl.joinDate <= endP).length;
            const targetVal = Math.ceil(baseCount / 2); // Pembulatan ke atas tepat di angka 7
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
        s.forEach((a, i) => { html += `<div class="achiever-item"><span>${i+1}. ${a.name}</span><br><small>Target: ${a.target} | Capai: ${a.actual}</small></div>`; });
    }
    if (f.length > 0) {
        html += `<div style="padding:10px; background:#221111; color:#ff4444; font-weight:bold; border-bottom:1px solid #333; margin-top:10px;">⚠️ BELUM TERCAPAI</div>`;
        f.forEach((a, i) => { html += `<div class="achiever-item"><span>${i+1}. ${a.name}</span><br><small>Target: ${a.target} | Capai: ${a.actual}</small></div>`; });
    }
    body.innerHTML = html || '<div class="v-empty">Tidak ada data peraih.</div>';
}

function downloadAchieverData() { if(!achieverTxtContent) return; const blob=new Blob([achieverTxtContent],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='laporan_growth.txt'; a.click(); }
function closeAchieverModal() { document.getElementById('achieverModal').style.display = 'none'; }

let intervalId; 
function startCountdown(targetDate) {
    if (intervalId) clearInterval(intervalId);
    function updateTimer() {
        const now = new Date().getTime(); const distance = targetDate.getTime() - now;
        if (distance < 0) { clearInterval(intervalId); return; }
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        document.getElementById("cdDays").textContent=days<10?"0"+days:days;
    }
    updateTimer(); intervalId = setInterval(updateTimer, 1000);
}

function showMotivation() { document.getElementById('motivationModal').style.display = 'flex'; }
window.closeMotivation = function() { document.getElementById('motivationModal').style.display = 'none'; }
window.openShareModal = function() { document.getElementById('shareModal').style.display = 'flex'; }
window.closeShareModal = function() { document.getElementById('shareModal').style.display = 'none'; }
