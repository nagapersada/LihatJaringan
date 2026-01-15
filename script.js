const supabaseUrl = 'https://hysjbwysizpczgcsqvuv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5c2pid3lzaXpwY3pnY3NxdnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjA2MTYsImV4cCI6MjA3OTQ5NjYxNn0.sLSfXMn9htsinETKUJ5IAsZ2l774rfeaNNmB7mVQcR4';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let globalData=[], myTeamData=[], globalHistory=[], globalAchievers=[], globalFailures=[], rankCache={}, downlineCache={}, achieverTxtContent = "";
let globalTarget=0, currentGap=0, intervalId;

const RANK_RULES = {
    1: { name: "V.I.P 1", level: 1, min: 5, reqVipCount: 0 },
    2: { name: "V.I.P 2", level: 2, min: 31, reqVipCount: 2, reqLevel: 1 },
    3: { name: "V.I.P 3", level: 3, min: 101, reqVipCount: 2, reqLevel: 2 },
    4: { name: "V.I.P 4", level: 4, min: 201, reqVipCount: 2, reqLevel: 3 },
    5: { name: "V.I.P 5", level: 5, min: 351, reqVipCount: 2, reqLevel: 4 },
    6: { name: "V.I.P 6", level: 6, min: 501, reqVipCount: 2, reqLevel: 5 },
    7: { name: "V.I.P 7", level: 7, min: 901, reqVipCount: 2, reqLevel: 6 },
    8: { name: "V.I.P 8", level: 8, min: 1601, reqVipCount: 2, reqLevel: 7 },
    9: { name: "V.I.P 9", level: 9, min: 3501, reqVipCount: 2, reqLevel: 8 }
};

document.addEventListener('DOMContentLoaded', async () => {
    const path = window.location.pathname;
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');

    if (!isLoggedIn && !path.includes('index.html')) {
        window.location.href = 'index.html';
        return;
    }

    await loadData();

    if (path.includes('index.html')) {
        document.getElementById('loginButton').addEventListener('click', doLogin);
    } else if (path.includes('dashboard.html')) {
        renderDashboard();
    } else if (path.includes('list.html')) {
        prepareMyTeamData();
        initList();
    } else if (path.includes('network.html')) {
        prepareMyTeamData();
        initNetwork();
    }
});

async function loadData() {
    try {
        const [m, h, a, f] = await Promise.all([
            db.from('members').select('*'),
            db.from('vip_history').select('*'),
            db.from('achiever_history').select('*'),
            db.from('failure_history').select('*')
        ]);
        globalData = m.data.map(x => ({
            uid: String(x.UID || x.uid).trim(),
            name: (x.Nama || x.nama || '-').trim(),
            upline: String(x.Upline || x.upline || '').trim(),
            joinDate: new Date(x.TanggalBergabung || x.joinDate)
        }));
        globalHistory = h.data || [];
        globalAchievers = a.data || [];
        globalFailures = f.data || [];
        rankCache = {}; downlineCache = {};
    } catch (e) { console.error("Load Error:", e); }
}

async function doLogin(){
    const a=document.getElementById('loginUid').value.trim(), b=document.getElementById('loginButton'), c=document.getElementById('error');
    if(!a) return void(c.innerText="Masukkan UID");
    b.innerText="..."; b.disabled=true; c.innerText="";
    await loadData(); 
    const d=globalData.find(m=>m.uid===a);
    if(d){
        sessionStorage.setItem('isLoggedIn','true');
        sessionStorage.setItem('userUid', d.uid);
        window.location.href='dashboard.html';
    } else {
        c.innerText="UID Tidak Terdaftar"; b.innerText="MASUK"; b.disabled=false;
    }
}

function getDownlinesRecursive(uid) {
    if(downlineCache[uid]) return downlineCache[uid];
    let results = globalData.filter(x => x.upline === uid);
    let all = [...results];
    results.forEach(child => { all = all.concat(getDownlinesRecursive(child.uid)); });
    downlineCache[uid] = all;
    return all;
}

function countSpecificVipInTeam(uid, targetLevel) {
    let count = 0;
    const directs = globalData.filter(x => x.upline === uid);
    directs.forEach(d => {
        const branch = [d, ...getDownlinesRecursive(d.uid)];
        if(branch.some(m => getRankLevel(m.uid) >= targetLevel)) count++;
    });
    return count;
}

function checkGrowthStreak(uid) {
    const success = globalAchievers.filter(x => x.uid === uid).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    return success.length >= 2; 
}

function getRankLevel(uid) {
    if(rankCache[uid] !== undefined) return rankCache[uid];
    const team = [globalData.find(x => x.uid === uid), ...getDownlinesRecursive(uid)];
    const total = team.length;
    let rank = 0;
    for(let i=9; i>=1; i--) {
        const r = RANK_RULES[i];
        if(total >= r.min) {
            const vips = (i > 1) ? countSpecificVipInTeam(uid, r.reqLevel) : 0;
            if(i === 1 || vips >= r.reqVipCount || checkGrowthStreak(uid)) { rank = i; break; }
        }
    }
    rankCache[uid] = rank;
    return rank;
}

function renderDashboard() {
    const uid = sessionStorage.getItem('userUid');
    const user = globalData.find(x => x.uid === uid);
    if(!user) return;
    const team = [user, ...getDownlinesRecursive(uid)];

    const now = new Date();
    const d = now.getDate();
    let start, end, label;
    if(d <= 15 || d === 31) {
        start = (d === 31) ? new Date(now.getFullYear(), now.getMonth(), 31) : (new Date(now.getFullYear(), now.getMonth(), 1));
        if(d !== 31 && (new Date(now.getFullYear(), now.getMonth(), 0).getDate() === 31)) start = new Date(now.getFullYear(), now.getMonth()-1, 31);
        end = new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59);
        label = "PERIODE 1";
    } else {
        start = new Date(now.getFullYear(), now.getMonth(), 16);
        end = new Date(now.getFullYear(), now.getMonth(), 30, 23, 59, 59);
        label = "PERIODE 2";
    }

    const totalMembers = team.filter(x => x.joinDate <= end).length;
    const growth = team.filter(x => x.joinDate >= start && x.joinDate <= end).length;
    const target = Math.ceil(totalMembers / 2); // Target 50%
    const gap = Math.max(0, target - growth);

    globalTarget = target; currentGap = gap;
    document.getElementById('mName').innerText = user.name;
    document.getElementById('mUid').innerText = user.uid;
    document.getElementById('mRefUid').innerText = user.upline || '-';
    document.getElementById('totalMembers').innerText = totalMembers;
    document.getElementById('currentPeriodLabel').innerText = label;
    document.getElementById('prevPeriodCount').innerText = totalMembers;
    document.getElementById('targetCount').innerText = target;
    document.getElementById('newMemberCount').innerText = growth;
    document.getElementById('gapCount').innerText = gap;

    updateVipStats(team, start, end);
    calculateNextRank(uid, totalMembers);
    startCountdown(end);
    renderChart(0, growth);
    showMotivation();
}

function updateVipStats(team, startP, endP) {
    for(let i=1; i<=9; i++) {
        const members = team.filter(x => getRankLevel(x.uid) === i);
        const el = document.getElementById(`cVIP${i}`);
        if(el) {
            el.innerText = members.length;
            const h = globalHistory.find(x => x.vip_level === i && (new Date() - new Date(x.achieved_at) < 86400000));
            if(h) el.parentElement.classList.add('new-alert');
        }
    }
}

function calculateNextRank(uid, currentSize) {
    const curLevel = getRankLevel(uid);
    const next = RANK_RULES[curLevel + 1];
    let sg = "", gap = 0;
    if (curLevel === 9) sg = "Top Level";
    else if (next) {
        const vips = (next.level > 1) ? countSpecificVipInTeam(uid, next.reqLevel) : 0;
        sg = (vips < next.reqVipCount) ? `Tambahan ${next.reqVipCount - vips} @VIP ${next.reqLevel} di jalur berbeda` : `Menuju ${next.name}`;
        gap = Math.max(0, next.min - currentSize);
    }
    document.getElementById('rankName').innerText = RANK_RULES[curLevel]?.name || "MEMBER";
    document.getElementById('rankNextGoal').innerText = sg;
    document.getElementById('nextLevelGap').innerText = gap;
}

function openVipModal(level) {
    const uid = sessionStorage.getItem('userUid');
    const team = [globalData.find(x => x.uid === uid), ...getDownlinesRecursive(uid)];
    const vips = team.filter(x => getRankLevel(x.uid) === level).sort((a,b) => {
        const ha = globalHistory.find(h => h.uid === a.uid && h.vip_level === level);
        const hb = globalHistory.find(h => h.uid === b.uid && h.vip_level === level);
        return (hb?new Date(hb.achieved_at):0) - (ha?new Date(ha.achieved_at):0);
    });

    const body = document.getElementById('modalBody');
    body.innerHTML = vips.length ? '' : '<div class="v-empty">Belum ada anggota.</div>';
    
    const now = new Date();
    const d = now.getDate();
    let start;
    if(d <= 15 || d === 31) start = (d === 31) ? new Date(now.getFullYear(), now.getMonth(), 31) : new Date(now.getFullYear(), now.getMonth(), 1);
    else start = new Date(now.getFullYear(), now.getMonth(), 16);

    vips.forEach(m => {
        const h = globalHistory.find(x => x.uid === m.uid && x.vip_level === level);
        const isNew = h && (new Date() - new Date(h.achieved_at) < 86400000);
        const dls = getDownlinesRecursive(m.uid);
        const base = dls.filter(dl => dl.joinDate < start).length + 1;
        const target = Math.ceil(base / 2);
        const actual = dls.filter(dl => dl.joinDate >= start).length;
        const sisa = Math.max(0, target - actual);

        body.innerHTML += `<div class="v-item ${isNew?'new-name-alert':''}">
            <div style="display:flex; flex-direction:column; width:100%;">
                <div style="display:flex; justify-content:space-between;">
                    <span class="v-n">${m.name} ${isNew?'🔥':''}</span><span class="v-u">${m.uid}</span>
                </div>
                <div style="display:flex; gap:10px; font-size:9px; border-top:1px dashed #333; margin-top:5px; padding-top:4px;">
                    <span>Tgt: <b>${target}</b></span><span>Capai: <b>${actual}</b></span><span>Sisa: <b>${sisa}</b></span>
                </div>
            </div></div>`;
    });
    document.getElementById('vipModal').style.display='flex';
}

async function openAchieverModal() {
    const body = document.getElementById('achieverBody');
    body.innerHTML = "Memuat data...";
    document.getElementById('achieverTitle').innerText = "DAFTAR PERAIH PERIODE LALU";
    document.getElementById('btnRefreshData').onclick = async () => {
        if(confirm("Hapus dan catat ulang daftar anggota ke Supabase?")) {
            await db.from('achiever_history').delete().neq('uid', '0');
            location.reload();
        }
    };
    const res = globalAchievers.map(x => `
        <div class="achiever-item">
            <div class="achiever-top"><span class="v-n">${x.uid} <small>(VIP ${x.rank})</small></span></div>
            <div class="achiever-stats"><span>Target: <b>${x.target}</b></span><span>Capai: <b>${x.actual}</b></span><span>Sisa: <b>0</b></span></div>
        </div>`).join('');
    body.innerHTML = res || "Belum ada data.";
    document.getElementById('achieverModal').style.display='flex';
}

function openHistoryModal() {
    const uid = sessionStorage.getItem('userUid');
    const body = document.getElementById('achieverBody');
    document.getElementById('achieverTitle').innerText = "RIWAYAT PENCAPAIAN SAYA";
    document.getElementById('btnRefreshData').onclick = async () => {
        if(confirm("Hapus dan catat ulang riwayat pencapaian Anda?")) {
            await db.from('achiever_history').delete().eq('uid', uid);
            await db.from('failure_history').delete().eq('uid', uid);
            location.reload();
        }
    };
    const h = [...globalAchievers, ...globalFailures].filter(x => x.uid === uid).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    body.innerHTML = h.map(x => `
        <div class="achiever-item" style="border-left: 3px solid ${x.actual >= x.target ? '#D4AF37':'#ff4444'}">
            <b>${x.period}</b><br>
            <div class="achiever-stats"><span>Target: <b>${x.target}</b></span><span>Capai: <b>${x.actual}</b></span><span>Status: <b>${x.actual >= x.target ? 'SUCCESS':'FAIL'}</b></span></div>
        </div>`).join('') || "Belum ada riwayat.";
    document.getElementById('achieverModal').style.display='flex';
}

function startCountdown(t){if(intervalId)clearInterval(intervalId);intervalId=setInterval(()=>{const d=t-new Date();if(d<=0)return clearInterval(intervalId);document.getElementById('cdDays').innerText=Math.floor(d/86400000).toString().padStart(2,'0');document.getElementById('cdHours').innerText=Math.floor((d%86400000)/3600000).toString().padStart(2,'0');document.getElementById('cdMin').innerText=Math.floor((d%3600000)/60000).toString().padStart(2,'0');document.getElementById('cdSec').innerText=Math.floor((d%60000)/1000).toString().padStart(2,'0')},1000)}
function renderChart(p,c){const ctx=document.getElementById('growthChart').getContext('2d');if(window.myChart)window.myChart.destroy();window.myChart=new Chart(ctx,{type:'bar',data:{labels:['Lalu','Kini'],datasets:[{data:[p,c],backgroundColor:['#333','#D4AF37']}]},options:{maintainAspectRatio:!1,plugins:{legend:{display:!1}},scales:{y:{display:!1},x:{ticks:{color:'#888',font:{size:9}}}}}})}
function logout(){sessionStorage.clear(); window.location.href='index.html'}
function closeVipModal(){document.getElementById('vipModal').style.display='none'}
function closeAchieverModal(){document.getElementById('achieverModal').style.display='none'}
function closeMotivation(){document.getElementById('motivationModal').style.display='none'}
function closeShareModal(){document.getElementById('shareModal').style.display='none'}
function openShareModal(){generateShareText();document.getElementById('shareModal').style.display='flex'}
function generateShareText(){const t=document.getElementById('shareText'); t.value=`🔥 UPDATE DVTEAM NP 🔥\nTarget 50%: ${globalTarget}\nPencapaian: ${globalTarget-currentGap}\nSisa: ${currentGap}`;}
function copyShareText(){const t=document.getElementById('shareText'); t.select(); navigator.clipboard.writeText(t.value).then(()=>alert("Disalin!"));}
function showMotivation(){const m=document.getElementById('motivationModal');if(m){document.getElementById('dailyMotivation').innerText="Tetap fokus pada target 50%!"; m.style.display='flex';}}
function getMonthName(a){return["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"][a]}

// List & Network Functions
function prepareMyTeamData(){const a=sessionStorage.getItem('userUid'),b=globalData.find(b=>b.uid===a);if(b){const c=getDownlinesRecursive(a);myTeamData=[b,...c]}}
function initList(){/* ... renderTable logic ... */}
function initNetwork(){/* ... GoJS logic ... */}
