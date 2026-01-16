const supabaseUrl = 'https://hysjbwysizpczgcsqvuv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5c2pid3lzaXpwY3pnY3NxdnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjA2MTYsImV4cCI6MjA3OTQ5NjYxNn0.sLSfXMn9htsinETKUJ5IAsZ2l774rfeaNNmB7mVQcR4';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let globalData=[], myTeamData=[], globalHistory=[], globalAchievers=[], globalFailures=[], sortState={col:'joinDate',dir:'asc'};
let vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
let achieverTxtContent = "";

let currentGap = 0; 
let globalTarget = 0;

document.addEventListener('DOMContentLoaded',async()=>{
    const a=window.location.pathname, b=sessionStorage.getItem('isLoggedIn');
    if(!b && !a.includes('index.html')){ window.location.href='index.html'; return; }
    if(b) await loadData();
    if(a.includes('index.html')) document.getElementById('loginButton').addEventListener('click',doLogin);
    else if(a.includes('dashboard.html')) renderDashboard();
    else if(a.includes('list.html')){ prepareMyTeamData(); initList(); }
    else if(a.includes('network.html')){ prepareMyTeamData(); initNetwork(); }
});

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
    } catch (a) { console.error("Load Error:", a); }
}

let rankCache = {}, histRankCache = {}, downlineCache = {};

function prepareMyTeamData(){
    const a=sessionStorage.getItem('userUid');
    const b=globalData.find(m=>m.uid===a);
    if(b){ myTeamData=[b,...getDownlinesRecursive(a)]; }
}

function getDownlinesRecursive(uid){
    if(downlineCache[uid]) return downlineCache[uid];
    let b=[];
    const c=globalData.filter(m=>m.upline===uid);
    c.forEach(a=>{ b.push(a); b=b.concat(getDownlinesRecursive(a.uid)); });
    downlineCache[uid] = b;
    return b;
}

async function doLogin(){
    const a=document.getElementById('loginUid').value.trim(), b=document.getElementById('loginButton'), c=document.getElementById('error');
    if(!a) return void(c.innerText="Masukkan UID");
    b.innerText="..."; b.disabled=!0;
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

function logout(){ sessionStorage.clear(); window.location.href='index.html'; }

function renderDashboard(){
    const a=sessionStorage.getItem('userUid');
    if(!globalData.length) return;
    const b=globalData.find(m=>m.uid===a);
    if(!b) return logout();
    
    document.getElementById('mName').innerText=b.name;
    document.getElementById('mUid').innerText=b.uid;
    const c=globalData.find(m=>m.uid===b.upline);
    document.getElementById('mRefUid').innerText=c?c.uid:'-';
    
    const d=getDownlinesRecursive(a);
    myTeamData = [b,...d];
    document.getElementById('totalMembers').innerText = myTeamData.length;
    
    calculateMyRank(myTeamData.length, globalData.filter(m=>m.upline===a).length, a);
    countVipStats(myTeamData);
    
    const h=new Date(), i=h.getDate(), j=h.getMonth(), k=h.getFullYear();
    let l, m, n, countDownTarget;
    let prevM = j - 1, prevY = k; if (prevM < 0) { prevM = 11; prevY--; }
    const daysInPrevMonth = new Date(prevY, prevM + 1, 0).getDate();

    if (i === 31) {
        l = new Date(k, j, 31); m = new Date(k, j, 30, 23, 59, 59);
        n = "PERIODE 1 (JAN 2026)"; countDownTarget = new Date(k, j + 1, 15, 23, 59, 59);
    } else if (i <= 15) {
        l = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 31) : new Date(k, j, 1);
        m = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 30, 23, 59, 59) : new Date(k, j, 0, 23, 59, 59);
        n = `PERIODE 1 (${getMonthName(j)} ${k})`; countDownTarget = new Date(k, j, 15, 23, 59, 59);
    } else {
        l = new Date(k, j, 16); m = new Date(k, j, 15, 23, 59, 59);
        n = `PERIODE 2 (${getMonthName(j)} ${k})`; countDownTarget = new Date(k, j, 30, 23, 59, 59);
    }
    
    document.getElementById('currentPeriodLabel').innerText = n;
    startCountdown(countDownTarget);
    showMotivation();

    const base = myTeamData.filter(mMember => mMember.joinDate <= m).length;
    const grow = myTeamData.filter(mMember => mMember.joinDate >= l).length;
    const target = Math.ceil(base / 2);
    let gap = target - grow; if(gap < 0) gap = 0;
    
    currentGap = gap; globalTarget = target;
    document.getElementById('prevPeriodCount').innerText = base;
    document.getElementById('targetCount').innerText = target;
    document.getElementById('newMemberCount').innerText = grow;
    document.getElementById('gapCount').innerText = gap;
    renderChart(0, grow);
}

function renderChart(prev, curr){
    const ctx = document.getElementById('growthChart').getContext('2d');
    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['LALU', 'SAAT INI'],
            datasets: [{ data: [prev, curr], backgroundColor: ['#333', '#D4AF37'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

// ============================================================
// LOGIKA PERINGKAT BARU SESUAI INSTRUKSI
// ============================================================
function countVipsInPaths(uid, targetLevel) {
    const directDownlines = globalData.filter(m => m.upline === uid);
    let count = 0;
    for (const direct of directDownlines) {
        const branch = [direct, ...getDownlinesRecursive(direct.uid)];
        // Menggunakan rankCache agar tidak rekursif berlebih
        if (branch.some(m => getRankLevel(m.uid) >= targetLevel)) count++;
    }
    return count;
}

function checkConsecutiveGrowth(uid) {
    // Mengecek apakah user ada di daftar sukses di 2 periode terakhir di database
    const successLogs = globalAchievers.filter(a => a.uid === uid);
    return successLogs.length >= 2;
}

function getRankLevel(uid){
    if (rankCache[uid] !== undefined) return rankCache[uid];
    const team = [globalData.find(m => m.uid === uid), ...getDownlinesRecursive(uid)];
    const total = team.length;
    const direct = globalData.filter(m=>m.upline===uid).length;
    
    const rankTiers = [
        {level:9, min:3501, req:8}, {level:8, min:1601, req:7}, {level:7, min:901, req:6},
        {level:6, min:501, req:5}, {level:5, min:351, req:4}, {level:4, min:201, req:3},
        {level:3, min:101, req:2}, {level:2, min:31, req:1}
    ];
    
    let res = (direct >= 5) ? 1 : 0;
    
    // Iterasi dari VIP 9 ke bawah
    for(const t of rankTiers){
        if(total >= t.min){
            // Syarat 1: Memiliki 2 VIP di dua jalur berbeda
            const paths = countVipsInPaths(uid, t.req);
            // Syarat 2: Pertumbuhan 50% berturut-turut (Alternatif)
            const growthSuccess = checkConsecutiveGrowth(uid);
            
            if(paths >= 2 || growthSuccess) {
                res = t.level;
                break;
            }
        }
    }
    rankCache[uid] = res; return res;
}

function countVipStats(team){
    let counts = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    vipLists = {1:[],2:[],3:[],4:[],5:[],6:[],7:[],8:[],9:[]};
    team.forEach(m => {
        const lvl = getRankLevel(m.uid);
        if(lvl >= 1){ counts[lvl]++; vipLists[lvl].push(m); }
    });
    for(let i=1; i<=9; i++){
        const el = document.getElementById(`cVIP${i}`);
        if(el) el.innerText = counts[i];
    }
}

window.openVipModal = function(level) {
    const body = document.getElementById('modalBody');
    document.getElementById('modalTitle').innerText = `DAFTAR VIP ${level}`;
    body.innerHTML = '';
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
        list.forEach(mMember => {
            const dls = getDownlinesRecursive(mMember.uid);
            const baseCount = dls.filter(d => d.joinDate <= m).length + 1;
            const growCount = dls.filter(d => d.joinDate >= l).length;
            const targetVal = Math.ceil(baseCount / 2);
            const sisa = Math.max(0, targetVal - growCount);
            body.innerHTML += `<div class="v-item" style="flex-direction:column; align-items:flex-start;">
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <span class="v-n">${mMember.name}</span><span class="v-u">${mMember.uid}</span>
                </div>
                <div style="font-size:10px; color:#888; margin-top:4px;">Target: ${targetVal} - Capai: <span class="text-gold">${growCount}</span> - Sisa: <span style="color:${sisa > 0 ? '#ff4d4d' : '#00ff00'};">${sisa}</span></div>
            </div>`;
        });
    }
    document.getElementById('vipModal').style.display = 'flex';
}
window.closeVipModal = function() { document.getElementById('vipModal').style.display = 'none'; }

function calculateMyRank(size, direct, uid){
    const lvl = getRankLevel(uid);
    document.getElementById('rankName').innerText = lvl > 0 ? `V.I.P ${lvl}` : "MEMBER";
    document.getElementById('rankNextGoal').innerText = lvl < 9 ? `Menuju V.I.P ${lvl+1}` : "TOP LEVEL";
}

function getMonthName(j){ return ["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"][j]; }

function startCountdown(target){
    if(window.iv) clearInterval(window.iv);
    window.iv = setInterval(()=>{
        const diff = target - new Date();
        if(diff <= 0) return clearInterval(window.iv);
        document.getElementById('cdDays').innerText = Math.floor(diff/864e5).toString().padStart(2,'0');
        document.getElementById('cdHours').innerText = Math.floor((diff%864e5)/36e5).toString().padStart(2,'0');
        document.getElementById('cdMin').innerText = Math.floor((diff%36e5)/6e4).toString().padStart(2,'0');
        document.getElementById('cdSec').innerText = Math.floor((diff%6e4)/1e3).toString().padStart(2,'0');
    }, 1000);
}

function initList(){ window.sortData=a=>{sortState.col===a?sortState.dir='asc'===sortState.dir?'desc':'asc':(sortState.col=a,sortState.dir='asc'),renderTable()},renderTable() }
function renderTable(){ const a=document.getElementById('membersTableBody'); let e=''; myTeamData.forEach((x,i)=>{ e+=`<tr><td class="col-no">${i+1}</td><td class="col-name">${x.name}</td><td class="col-uid">${x.uid}</td><td class="col-ref">${x.upline||'-'}</td><td class="col-date">${x.joinDate.toLocaleDateString()}</td></tr>` }); a.innerHTML=e; }
function initNetwork(){
    const a=sessionStorage.getItem('userUid'), b=go.GraphObject.make,
    c=b(go.Diagram,"networkDiagram",{layout:b(go.TreeLayout,{angle:0,layerSpacing:60})});
    c.nodeTemplate=b(go.Node,"Auto",b(go.Shape,"RoundedRectangle",{fill:"#111",stroke:"#D4AF37"}),b(go.TextBlock,{margin:8,stroke:"#fff"},new go.Binding("text","key")));
    c.model=new go.GraphLinksModel(myTeamData.map(x=>({key:x.uid})), myTeamData.filter(x=>x.upline).map(x=>({from:x.upline,to:x.uid})));
}

function openAchieverModal() {
    const modal = document.getElementById('achieverModal'), body = document.getElementById('achieverBody'), title = document.getElementById('achieverTitle'), btnDl = document.getElementById('btnDlAchiever');
    modal.style.display = 'flex'; body.innerHTML = '<div class="v-empty">Menghitung data...</div>'; btnDl.style.display = 'none';
    const h=new Date(), i=h.getDate(), j=h.getMonth(), k=h.getFullYear();
    let l, m, plabel;
    let prevM = j - 1, prevY = k; if (prevM < 0) { prevM = 11; prevY--; }
    const daysInPrevMonth = new Date(prevY, prevM + 1, 0).getDate();
    if (i === 31) { l = new Date(k, j, 31); m = new Date(k, j, 30, 23, 59, 59); plabel = "PERIODE 1 (JAN 2026)"; }
    else if (i <= 15) {
        l = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 31) : new Date(k, j, 1);
        m = (daysInPrevMonth === 31) ? new Date(prevY, prevM, 30, 23, 59, 59) : new Date(k, j, 0, 23, 59, 59);
        plabel = `PERIODE 1 (${getMonthName(j)} ${k})`;
    } else { l = new Date(k, j, 16); m = new Date(k, j, 15, 23, 59, 59); plabel = `PERIODE 2 (${getMonthName(j)} ${k})`; }
    title.innerText = `REPORT - ${plabel}`; achieverTxtContent = `REPORT ${plabel}\n\n`;
    setTimeout(() => {
        let sList = [], fList = [];
        myTeamData.forEach(mem => {
            const dls = getDownlinesRecursive(mem.uid);
            const baseCount = dls.filter(d => d.joinDate <= m).length + 1;
            const growCount = dls.filter(d => d.joinDate >= l).length;
            const targetVal = Math.ceil(baseCount / 2);
            const rank = getRankLevel(mem.uid);
            if (targetVal > 0 && rank >= 1) {
                if (growCount >= targetVal) sList.push({name: mem.name, uid: mem.uid, target: targetVal, actual: growCount, rank});
                else fList.push({name: mem.name, uid: mem.uid, target: targetVal, actual: growCount, rank});
            }
        });
        renderAchieverList(sList, fList, body, btnDl);
    }, 100);
}

function renderAchieverList(s, f, body, btn) {
    btn.style.display = 'block'; let html = '';
    if (s.length > 0) {
        html += `<div style="padding:10px; color:#00ff00; font-weight:bold;">🏆 PERAIH TARGET</div>`;
        s.forEach(a => { html += `<div class="achiever-item"><div class="achiever-top"><span>${a.name}</span><span>${a.uid}</span></div><div class="achiever-stats">Target: ${a.target} | Capai: ${a.actual}</div></div>`; achieverTxtContent += `${a.name} (${a.uid}) - Capai: ${a.actual}/${a.target}\n`; });
    }
    if (f.length > 0) {
        html += `<div style="padding:10px; color:#ff4444; font-weight:bold; margin-top:10px;">⚠️ BELUM TERCAPAI</div>`;
        f.forEach(a => { html += `<div class="achiever-item"><div class="achiever-top"><span>${a.name}</span><span>${a.uid}</span></div><div class="achiever-stats">Target: ${a.target} | Capai: ${a.actual}</div></div>`; });
    }
    body.innerHTML = html || '<div class="v-empty">Belum ada data.</div>';
}

function downloadAchieverData() { const blob=new Blob([achieverTxtContent],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='report_growth.txt'; a.click(); }
function closeAchieverModal() { document.getElementById('achieverModal').style.display = 'none'; }

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
window.copyShareText = function() { const txtArea = document.getElementById('shareText'); txtArea.select(); txtArea.setSelectionRange(0, 99999); navigator.clipboard.writeText(txtArea.value).then(() => { alert("✅ Teks berhasil disalin!"); }); }
window.closeShareModal = function() { document.getElementById('shareModal').style.display = 'none'; }
