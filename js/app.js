import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, setDoc, deleteDoc, updateDoc, getDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCET0_R6120tj389v5C62NhSLrBIk2CbIw",
    authDomain: "qlylaodong-dev.firebaseapp.com",
    projectId: "qlylaodong-dev",
    storageBucket: "qlylaodong-dev.firebasestorage.app",
    messagingSenderId: "789374516793",
    appId: "1:789374516793:web:29fb38ad0913f8b62e17e8",
    measurementId: "G-M2PJEBLMJF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const SUPER_ADMIN_EMAIL = "minhln@dhhp.edu.vn";

// NẠP SẴN CẤU TRÚC PHÂN NHÓM MẪU (Lưu ý: Mảng groups và mảng items riêng biệt)
const DEFAULT_GROUPS = [
    { id: "g1", name: "1. Về tư tưởng chính trị, đạo đức, lối sống, ý thức tổ chức kỷ luật..." },
    { id: "g2", name: "2. Về kết quả thực hiện chức trách, nhiệm vụ được giao" },
    { id: "g3", name: "3. Việc thực hiện cam kết tu dưỡng, rèn luyện, phấn đấu hằng năm" }
];

const DEFAULT_ITEMS = [
    { id: "tc1_1", groupId: "g1", name: "1.1. Tư tưởng chính trị", max: 5 },
    { id: "tc1_2", groupId: "g1", name: "1.2. Phẩm chất đạo đức, lối sống", max: 5 },
    { id: "tc1_3", groupId: "g1", name: "1.3. Ý thức tổ chức kỷ luật", max: 5 },
    { id: "tc1_4", groupId: "g1", name: "1.4. Tác phong, lề lối làm việc", max: 5 },
    { id: "tc2_1", groupId: "g2", name: "2.1. Việc thực hiện nguyên tắc tập trung dân chủ, các quy định, quy chế làm việc...", max: 15 },
    { id: "tc2_2", groupId: "g2", name: "2.2. Kết quả lãnh đạo, chỉ đạo, tổ chức thực hiện các chỉ tiêu, nhiệm vụ...", max: 15 },
    { id: "tc2_3", groupId: "g2", name: "2.3. Kết quả đánh giá, xếp loại các tổ chức, cơ quan, đơn vị...", max: 15 },
    { id: "tc2_4", groupId: "g2", name: "2.4. Năng lực, uy tín; trách nhiệm nêu gương...", max: 15 },
    { id: "tc3_1", groupId: "g3", name: "3.1. Mức độ thực hiện cam kết tu dưỡng, rèn luyện, phấn đấu hằng năm", max: 10 },
    { id: "tc3_2", groupId: "g3", name: "3.2. Kết quả khắc phục những hạn chế, khuyết điểm...", max: 10 }
];

let CRITERIA_GROUPS = [];
let CRITERIA_ITEMS = []; 
let currentStaffData = [];
let userRole = 'guest'; 
let isDhhpUser = false;

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const messageDiv = document.getElementById('message');
const loadingMsg = document.getElementById('loadingMsg');

// Logic Chuyển Tab Chính
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
        if(btn.dataset.target === 'step1') renderStep1();
    });
});

// Logic Chuyển Tab Quản trị
const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
const adminTabContents = document.querySelectorAll('.admin-tab-content');
adminTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        adminTabBtns.forEach(b => b.classList.remove('active'));
        adminTabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

function showMessage(text, isError = false) {
    messageDiv.className = isError ? "error" : "success";
    messageDiv.innerText = text;
    messageDiv.classList.remove('hidden');
    setTimeout(() => { messageDiv.classList.add('hidden'); }, 5000);
}

function handleFirebaseError(err) {
    if (err.message.includes("permission") || err.code === "permission-denied") {
        alert("LỖI PHÂN QUYỀN FIREBASE:\nBạn chưa cấp quyền Rules cho bảng này trên Server!");
    } else { showMessage("Lỗi: " + err.message, true); }
}

// Auth
loginBtn.addEventListener('click', () => signInWithPopup(auth, provider).catch(error => alert("Lỗi: " + error.message)));
logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    userRole = 'guest'; isDhhpUser = false;
    document.getElementById('tabBtnAdmin').classList.add('hidden');

    if (user) {
        const userEmail = user.email;
        isDhhpUser = userEmail?.endsWith('@dhhp.edu.vn');
        loginBtn.classList.add('hidden'); logoutBtn.classList.remove('hidden');

        if (userEmail === SUPER_ADMIN_EMAIL) {
            userRole = 'superadmin'; userInfo.innerText = `Xin chào, ${userEmail} (Super Admin)`;
            document.getElementById('tabBtnAdmin').classList.remove('hidden');
            document.getElementById('tabCritAdmin').classList.remove('hidden');
            document.getElementById('tabRoleAdmin').classList.remove('hidden');
            listenToAdmins();
        } else {
            const adminDoc = await getDoc(doc(db, "DaiHocHaiPhong_Admins", userEmail));
            if (adminDoc.exists()) {
                userRole = 'admin'; userInfo.innerText = `Xin chào, ${userEmail} (Admin)`; 
                document.getElementById('tabBtnAdmin').classList.remove('hidden');
                document.getElementById('tabCritAdmin').classList.add('hidden'); 
                document.getElementById('tabRoleAdmin').classList.add('hidden'); 
            } else {
                userRole = 'guest'; userInfo.innerText = `Xin chào, ${userEmail} ${isDhhpUser ? "(Cán bộ trường)" : "(Khách)"}`;
            }
        }
    } else {
        userInfo.innerText = "Bạn chưa đăng nhập"; loginBtn.classList.remove('hidden'); logoutBtn.classList.add('hidden');
    }
    renderAllViews();
});

// --- LẮNG NGHE & QUẢN LÝ TIÊU CHÍ (HỖ TRỢ PHÂN NHÓM) ---
onSnapshot(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), async (docSnap) => {
    if (docSnap.exists()) { 
        const data = docSnap.data();
        // Kiểm tra xem dữ liệu có phải là phiên bản cũ không (chỉ có array list)
        if (Array.isArray(data.list) && !data.groups) {
            CRITERIA_GROUPS = [{ id: "g_default", name: "Nhóm tiêu chí chung" }];
            CRITERIA_ITEMS = data.list.map(i => ({ ...i, groupId: "g_default" }));
            // Tự động nâng cấp lên format mới
            await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: CRITERIA_GROUPS, items: CRITERIA_ITEMS });
        } else {
            CRITERIA_GROUPS = data.groups || [];
            CRITERIA_ITEMS = data.items || [];
        }
    } else { 
        CRITERIA_GROUPS = DEFAULT_GROUPS; 
        CRITERIA_ITEMS = DEFAULT_ITEMS;
        try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: CRITERIA_GROUPS, items: CRITERIA_ITEMS }); } catch(e) {}
    }
    renderCriteriaAdmin();
    if(document.getElementById('step1').classList.contains('active')) renderStep1();
});

function renderCriteriaAdmin() {
    // Cập nhật Dropdown chọn Nhóm
    let groupOpts = '<option value="">-- Chọn Nhóm chứa tiêu chí này --</option>';
    CRITERIA_GROUPS.forEach(g => { groupOpts += `<option value="${g.id}">${g.name}</option>`; });
    document.getElementById('critGroupSelect').innerHTML = groupOpts;

    // Vẽ bảng cấu trúc
    let html = '<table class="criteria-table"><tr><th width="15%">Mã</th><th>Nội dung tiêu chí / Nhóm</th><th width="15%">Điểm tối đa</th><th width="15%">Thao tác</th></tr>';
    let totalMax = 0;
    
    CRITERIA_GROUPS.forEach(g => {
        html += `<tr style="background:#f1f3f5;">
            <td><strong>${g.id}</strong></td>
            <td class="text-left" style="color:#0056b3;"><strong>${g.name}</strong></td>
            <td></td>
            <td><button class="action-btn btn-danger" onclick="removeGroup('${g.id}')">Xóa Nhóm</button></td>
        </tr>`;
        
        const itemsInGroup = CRITERIA_ITEMS.filter(i => i.groupId === g.id);
        itemsInGroup.forEach(c => {
            totalMax += c.max || 0;
            html += `<tr>
                <td>${c.id}</td><td class="text-left" style="padding-left: 20px;">- ${c.name}</td><td>${c.max}</td>
                <td>
                    <button class="action-btn btn-edit" onclick="editCriteria('${c.id}')">Sửa</button>
                    <button class="action-btn btn-danger" onclick="removeCriteria('${c.id}')">Xóa</button>
                </td>
            </tr>`;
        });
    });
    html += `<tr><td colspan="2" style="text-align:right"><strong>Tổng điểm hệ thống:</strong></td><td style="color:red; font-weight:bold; font-size:1.2em;">${totalMax}</td><td></td></tr></table>`;
    document.getElementById('criteriaAdminList').innerHTML = html;
    if(document.getElementById('maxScoreDisplay')) document.getElementById('maxScoreDisplay').innerText = totalMax;
}

// 1. Thêm Nhóm Mới
document.getElementById('addGroupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('newGroupId').value.trim();
    const name = document.getElementById('newGroupName').value.trim();
    if(CRITERIA_GROUPS.some(g => g.id === id)) return showMessage("Mã Nhóm đã tồn tại!", true);
    
    try {
        await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: [...CRITERIA_GROUPS, { id, name }], items: CRITERIA_ITEMS });
        document.getElementById('addGroupForm').reset(); showMessage("Đã tạo Nhóm!");
    } catch(e) { handleFirebaseError(e); }
});

// Xóa Nhóm
window.removeGroup = async function(groupId) {
    if(!confirm("Xóa Nhóm này sẽ xóa TOÀN BỘ tiêu chí con bên trong nó. Bạn chắc chắn chứ?")) return;
    const newGroups = CRITERIA_GROUPS.filter(g => g.id !== groupId);
    const newItems = CRITERIA_ITEMS.filter(i => i.groupId !== groupId); // Xóa sạch con cái
    try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: newGroups, items: newItems }); } 
    catch(e) { handleFirebaseError(e); }
};

// 2. Thêm Tiêu Chí Con
document.getElementById('addCriteriaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupId = document.getElementById('critGroupSelect').value;
    const id = document.getElementById('newCritId').value.trim();
    const name = document.getElementById('newCritName').value.trim();
    const max = parseFloat(document.getElementById('newCritMax').value);
    
    if(!groupId) return showMessage("Vui lòng chọn Nhóm!", true);
    if(CRITERIA_ITEMS.some(c => c.id === id)) return showMessage("Mã tiêu chí con đã tồn tại!", true);
    
    try {
        await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: CRITERIA_GROUPS, items: [...CRITERIA_ITEMS, { id, groupId, name, max }] });
        document.getElementById('addCriteriaForm').reset(); showMessage("Đã thêm tiêu chí con!");
    } catch(e) { handleFirebaseError(e); }
});

// 3. Sửa & Xóa Tiêu Chí Con
window.editCriteria = async function(id) {
    const idx = CRITERIA_ITEMS.findIndex(c => c.id === id);
    if(idx === -1) return;
    const crit = CRITERIA_ITEMS[idx];
    
    const newName = prompt("Nhập nội dung tiêu chí mới:", crit.name);
    if (newName === null || newName.trim() === "") return;
    const newMaxStr = prompt("Nhập điểm tối đa mới:", crit.max);
    if (newMaxStr === null) return;
    const newMax = parseFloat(newMaxStr);
    if (isNaN(newMax)) return showMessage("Điểm phải là số hợp lệ!", true);

    const newItems = [...CRITERIA_ITEMS];
    newItems[idx] = { ...crit, name: newName.trim(), max: newMax };
    try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: CRITERIA_GROUPS, items: newItems }); showMessage("Đã sửa tiêu chí con!"); } 
    catch(e) { handleFirebaseError(e); }
};

window.removeCriteria = async function(id) {
    if(!confirm("Xóa tiêu chí con này?")) return;
    const newItems = CRITERIA_ITEMS.filter(c => c.id !== id);
    try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: CRITERIA_GROUPS, items: newItems }); } 
    catch(e) { handleFirebaseError(e); }
};

// --- DATA LISTENER TỔNG & RENDER ---
onSnapshot(collection(db, "DaiHocHaiPhong_NhanSu"), (snapshot) => {
    currentStaffData = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        if(data.members && Array.isArray(data.members)) { currentStaffData.push({ id: doc.id, ...data }); } 
        else { currentStaffData.push({ id: doc.id, department: data.department || "Không xác định", members: [], headEmail: data.headEmail || "" }); }
    });
    currentStaffData.sort((a, b) => a.department.localeCompare(b.department));
    loadingMsg.style.display = "none"; renderAllViews();
});

function renderAllViews() {
    updateDropdowns(); renderAdminStaffTable(); renderStep1(); renderStep2(); renderVotingTable(); 
}

// --- QUẢN TRỊ NHÂN SỰ ---
const newDeptSelect = document.getElementById('newDeptSelect');
const headAssignDeptSelect = document.getElementById('headAssignDeptSelect');

function updateDropdowns() {
    let deptOptions = `<option value="">-- Chọn Đơn vị --</option>`;
    currentStaffData.forEach(dept => { 
        const headInfo = dept.headEmail ? ` (PT: ${dept.headEmail})` : '';
        deptOptions += `<option value="${dept.id}">${dept.department}${headInfo}</option>`; 
    });
    const currNewDept = newDeptSelect.value; const currAssign = headAssignDeptSelect.value;
    newDeptSelect.innerHTML = deptOptions; headAssignDeptSelect.innerHTML = deptOptions;
    if(currNewDept) newDeptSelect.value = currNewDept; if(currAssign) headAssignDeptSelect.value = currAssign;
}

function renderAdminStaffTable() {
    let html = `<table class="criteria-table"><thead><tr><th>Đơn vị</th><th>Họ tên</th><th>Email</th><th>Thao tác</th></tr></thead><tbody>`;
    currentStaffData.forEach(dept => {
        html += `<tr class="dept-row"><td colspan="4">${dept.department} ${dept.headEmail ? ` <small style="color:red">(Phụ trách: ${dept.headEmail})</small>` : ''}</td></tr>`;
        dept.members.forEach(staff => {
            html += `<tr>
                <td></td><td class="text-left"><strong>${staff.name}</strong></td>
                <td>${staff.email || '<span style="color:#dc3545; font-style:italic">Chưa có email</span>'}</td>
                <td><button class="action-btn btn-edit" onclick="editStaff('${dept.id}', '${staff.id}')">Sửa</button><button class="action-btn btn-danger" onclick="deleteStaff('${dept.id}', '${staff.id}')">Xóa</button></td>
            </tr>`;
        });
    });
    html += `</tbody></table>`;
    document.getElementById('adminStaffTableContainer').innerHTML = html;
}

const toggleNewDeptBtn = document.getElementById('toggleNewDeptBtn');
const newDeptCustom = document.getElementById('newDeptCustom');
let isCustomDept = false;
toggleNewDeptBtn.addEventListener('click', () => {
    isCustomDept = !isCustomDept;
    if(isCustomDept) {
        newDeptSelect.classList.add('hidden'); newDeptCustom.classList.remove('hidden');
        newDeptSelect.removeAttribute('required'); newDeptCustom.setAttribute('required', 'true'); toggleNewDeptBtn.innerText = "Danh sách";
    } else {
        newDeptSelect.classList.remove('hidden'); newDeptCustom.classList.add('hidden');
        newDeptSelect.setAttribute('required', 'true'); newDeptCustom.removeAttribute('required'); toggleNewDeptBtn.innerText = "+";
    }
});

document.getElementById('addStaffForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    let deptId = isCustomDept ? "dept_" + Date.now() : newDeptSelect.value;
    if (!deptId) return showMessage("Vui lòng chọn phòng ban!", true);
    let deptName = isCustomDept ? newDeptCustom.value.trim() : currentStaffData.find(d => d.id === deptId)?.department;
    const newMember = { id: "nv_" + Date.now(), name: document.getElementById('newName').value.trim(), email: document.getElementById('newEmail').value.trim() || "", score: "", proposed: "", criteriaScores: {} };
    const deptDocInfo = currentStaffData.find(d => d.id === deptId);
    const existingMembers = deptDocInfo ? (deptDocInfo.members || []) : [];
    
    try {
        await setDoc(doc(db, "DaiHocHaiPhong_NhanSu", deptId), { department: deptName, members: [...existingMembers, newMember], headEmail: deptDocInfo?.headEmail || "" }, { merge: true });
        document.getElementById('addStaffForm').reset(); if(isCustomDept) toggleNewDeptBtn.click(); showMessage("Đã thêm!");
    } catch(e) { handleFirebaseError(e); }
});

window.editStaff = async function(deptId, staffId) {
    const dept = currentStaffData.find(d => d.id === deptId);
    if(!dept || !dept.members) return;
    const staff = dept.members.find(m => m.id === staffId);
    if(!staff) return;

    const newName = prompt("Sửa Họ và Tên:", staff.name);
    if(newName === null) return;
    const newEmail = prompt("Sửa Email (có thể để trống):", staff.email || "");
    if(newEmail === null) return;

    const updatedMembers = dept.members.map(m => m.id === staffId ? { ...m, name: newName.trim(), email: newEmail.trim() } : m);
    try { await updateDoc(doc(db, "DaiHocHaiPhong_NhanSu", deptId), { members: updatedMembers }); showMessage("Đã sửa thông tin!"); } 
    catch(e) { handleFirebaseError(e); }
};

window.deleteStaff = async function(deptDocId, staffId) {
    if(!confirm("Xóa nhân viên này?")) return;
    const deptInfo = currentStaffData.find(d => d.id === deptDocId);
    if(deptInfo) {
        const newMembers = deptInfo.members.filter(m => m.id !== staffId);
        if(newMembers.length === 0) await deleteDoc(doc(db, "DaiHocHaiPhong_NhanSu", deptDocId));
        else await updateDoc(doc(db, "DaiHocHaiPhong_NhanSu", deptDocId), { members: newMembers });
    }
};

// --- PHÂN QUYỀN ---
document.getElementById('addAdminForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newEmail = document.getElementById('newAdminEmail').value.trim();
    if (!newEmail.endsWith('@dhhp.edu.vn')) return alert("Chỉ cấp quyền cho email đuôi @dhhp.edu.vn");
    try { await setDoc(doc(db, "DaiHocHaiPhong_Admins", newEmail), { email: newEmail, addedBy: SUPER_ADMIN_EMAIL, timestamp: serverTimestamp() }); document.getElementById('addAdminForm').reset(); } 
    catch(e) { handleFirebaseError(e); }
});
window.removeAdmin = async function(email) {
    if(email === SUPER_ADMIN_EMAIL) return;
    if(confirm(`Gỡ quyền của ${email}?`)) await deleteDoc(doc(db, "DaiHocHaiPhong_Admins", email));
};
document.getElementById('assignHeadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const deptId = document.getElementById('headAssignDeptSelect').value;
    const email = document.getElementById('headAssignEmail').value.trim();
    if(!deptId) return showMessage("Vui lòng chọn đơn vị", true);
    try { await updateDoc(doc(db, "DaiHocHaiPhong_NhanSu", deptId), { headEmail: email }); showMessage("Đã gán quyền Trưởng Đơn vị!"); document.getElementById('assignHeadForm').reset(); } 
    catch(e) { handleFirebaseError(e); }
});

// --- BƯỚC 1: CÁ NHÂN TỰ ĐÁNH GIÁ (HIỂN THỊ THEO NHÓM) ---
function renderStep1() {
    const step1Content = document.getElementById('step1Content');
    const selfScoreForm = document.getElementById('selfScoreForm');
    
    if (!auth.currentUser || !isDhhpUser) {
        step1Content.innerHTML = '<p style="color:#dc3545; font-weight:bold;">Vui lòng đăng nhập email @dhhp.edu.vn để tự đánh giá.</p>';
        selfScoreForm.classList.add('hidden'); return;
    }

    const userEmail = auth.currentUser.email;
    let myProfile = null; let myDept = null;
    for (const dept of currentStaffData) {
        const me = dept.members.find(m => m.email === userEmail);
        if (me) { myProfile = me; myDept = dept; break; }
    }

    if (!myProfile) {
        step1Content.innerHTML = `<p style="color:#dc3545; font-weight:bold;">Tài khoản <span style="color:#000;">${userEmail}</span> chưa được liên kết.</p>`;
        selfScoreForm.classList.add('hidden'); return;
    }

    step1Content.innerHTML = ''; selfScoreForm.classList.remove('hidden');
    document.getElementById('selfDeptId').value = myDept.id;
    document.getElementById('selfStaffId').value = myProfile.id;
    document.getElementById('selfDeptName').value = myDept.department;
    document.getElementById('selfStaffName').value = myProfile.name;
    
    let criteriaHtml = `<table class="criteria-table"><thead><tr><th>Nội dung tiêu chí đánh giá</th><th width="15%">Điểm tối đa</th><th width="15%">Điểm tự chấm</th></tr></thead><tbody>`;
    const savedScores = myProfile.criteriaScores || {}; 
    
    if(CRITERIA_GROUPS.length === 0) criteriaHtml += `<tr><td colspan="3">Chưa có cấu hình tiêu chí. Vui lòng báo Quản trị viên.</td></tr>`;
    
    // Đổ dữ liệu theo Nhóm -> Tiêu chí con
    CRITERIA_GROUPS.forEach(g => {
        criteriaHtml += `<tr style="background:#f8f9fa;"><td colspan="3" class="text-left" style="font-weight:bold; color:#0056b3;">${g.name}</td></tr>`;
        const items = CRITERIA_ITEMS.filter(i => i.groupId === g.id);
        
        items.forEach(tc => {
            const val = savedScores[tc.id] !== undefined ? savedScores[tc.id] : '';
            criteriaHtml += `<tr>
                <td class="text-left" style="padding-left: 20px;">${tc.name}</td>
                <td style="font-weight:bold;">${tc.max}</td>
                <td><input type="number" class="crit-input" data-id="${tc.id}" data-max="${tc.max}" value="${val}" min="0" max="${tc.max}" step="0.5" required></td>
            </tr>`;
        });
    });
    
    criteriaHtml += `</tbody></table>`;
    document.getElementById('criteriaContainer').innerHTML = criteriaHtml;

    document.querySelectorAll('.crit-input').forEach(input => { input.addEventListener('input', calculateTotalScore); });
    calculateTotalScore();
}

function calculateTotalScore() {
    let total = 0;
    document.querySelectorAll('.crit-input').forEach(input => {
        let val = parseFloat(input.value); let max = parseFloat(input.dataset.max);
        if(val > max) { input.value = max; val = max; } 
        total += val || 0;
    });
    document.getElementById('selfScoreInput').value = total;
}

document.getElementById('selfScoreForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const deptId = document.getElementById('selfDeptId').value;
    const staffId = document.getElementById('selfStaffId').value;
    const totalScore = parseFloat(document.getElementById('selfScoreInput').value);
    
    const criteriaScores = {};
    document.querySelectorAll('.crit-input').forEach(input => { criteriaScores[input.dataset.id] = parseFloat(input.value) || 0; });

    const deptDoc = currentStaffData.find(d => d.id === deptId);
    if(!deptDoc || !deptDoc.members) return;
    const updatedMembers = deptDoc.members.map(m => m.id === staffId ? { ...m, score: totalScore, criteriaScores: criteriaScores } : m);
    
    try { await updateDoc(doc(db, "DaiHocHaiPhong_NhanSu", deptId), { members: updatedMembers }); showMessage("Đã lưu bảng điểm tự đánh giá!"); } 
    catch(e) { handleFirebaseError(e); }
});

// --- BƯỚC 2 & 3: BẢN CŨ GIỮ NGUYÊN (Lưu/Duyệt Điểm) ---
const deptProposalForm = document.getElementById('deptProposalForm');
const proposalTableBody = document.getElementById('proposalTableBody');
const step2AuthMessage = document.getElementById('step2AuthMessage');

function renderStep2() {
    if (!auth.currentUser || !isDhhpUser) {
        step2AuthMessage.innerText = "Đăng nhập bằng tài khoản @dhhp.edu.vn để duyệt.";
        deptProposalForm.classList.add('hidden'); return;
    }
    const userEmail = auth.currentUser.email;
    const myDepts = currentStaffData.filter(d => d.headEmail === userEmail);
    if (myDepts.length === 0) {
        step2AuthMessage.innerText = "Tài khoản của bạn CHƯA được phân quyền duyệt.";
        step2AuthMessage.style.color = "#dc3545"; deptProposalForm.classList.add('hidden'); return;
    }

    step2AuthMessage.innerText = `Quyền Trưởng đơn vị: ${userEmail}`;
    step2AuthMessage.style.color = "#28a745"; deptProposalForm.classList.remove('hidden');

    let html = '';
    myDepts.forEach(dept => {
        html += `<tr class="dept-row"><td colspan="4">Khu vực đánh giá: ${dept.department}</td></tr>`;
        (dept.members || []).forEach((m, index) => {
            html += `<tr>
                <td>${index + 1}</td><td class="text-left">${m.name}</td>
                <td><strong style="color:red; font-size:1.1em">${m.score !== undefined && m.score !== "" ? m.score : 'Chưa chấm'}</strong></td>
                <td>
                    <select name="prop_${dept.id}_${m.id}" class="prop-select" style="padding: 5px; width: 100%;">
                        <option value="">-- Chọn mức --</option>
                        <option value="HTXSNV" ${m.proposed === 'HTXSNV' ? 'selected' : ''}>Hoàn thành Xuất sắc</option>
                        <option value="HTTNV" ${m.proposed === 'HTTNV' ? 'selected' : ''}>Hoàn thành Tốt</option>
                        <option value="HTNV" ${m.proposed === 'HTNV' ? 'selected' : ''}>Hoàn thành NV</option>
                        <option value="KHTNV" ${m.proposed === 'KHTNV' ? 'selected' : ''}>Không HTNV</option>
                    </select>
                </td>
            </tr>`;
        });
    });
    proposalTableBody.innerHTML = html;
}
deptProposalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userEmail = auth.currentUser.email; const myDepts = currentStaffData.filter(d => d.headEmail === userEmail);
    const formData = new FormData(deptProposalForm);
    try {
        for (const dept of myDepts) {
            const updatedMembers = (dept.members || []).map(m => {
                const propValue = formData.get(`prop_${dept.id}_${m.id}`);
                return { ...m, proposed: propValue || m.proposed || "" };
            });
            await updateDoc(doc(db, "DaiHocHaiPhong_NhanSu", dept.id), { members: updatedMembers });
        }
        showMessage("Lưu Đề xuất thành công!");
    } catch(e) { handleFirebaseError(e); }
});

const tableContainer = document.getElementById('tableContainer');
const voteTypeSelect = document.getElementById('voteType');
function renderVotingTable() {
    if(currentStaffData.length === 0) { tableContainer.innerHTML = "<p style='text-align:center;'>Chưa có dữ liệu.</p>"; document.getElementById('submitBtn').disabled = true; return; }
    const voteType = voteTypeSelect.value;
    let html = `<table class="criteria-table"><thead><tr><th width="5%">TT</th><th width="25%">Họ tên</th><th width="10%">Điểm CN</th><th width="15%">Đề xuất ĐV</th>`;
    if (voteType === 'xeploai') html += `<th width="13%">HTXSNV</th><th width="13%">HTTNV</th><th width="13%">HTNV</th>`;
    else html += `<th width="20%">Tín nhiệm</th><th width="20%">Không tín nhiệm</th>`;
    html += `</tr></thead><tbody>`;

    currentStaffData.forEach(dept => {
        html += `<tr class="dept-row"><td colspan="4">${dept.department}</td>${voteType === 'xeploai' ? '<td colspan="3"></td>' : '<td colspan="2"></td>'}</tr>`;
        (dept.members || []).forEach((staff, index) => {
            html += `<tr><td>${index + 1}</td><td class="text-left" style="font-weight:bold;">${staff.name}</td>
                <td><strong style="color:red">${staff.score !== undefined && staff.score !== "" ? staff.score : ''}</strong></td>
                <td style="font-weight:bold; color:#0056b3">${staff.proposed || ''}</td>`;
            if (voteType === 'xeploai') { html += `<td><input type="radio" name="vote_${staff.id}" value="HTXSNV" required></td><td><input type="radio" name="vote_${staff.id}" value="HTTNV"></td><td><input type="radio" name="vote_${staff.id}" value="HTNV"></td>`; } 
            else { html += `<td><input type="radio" name="vote_${staff.id}" value="Tín nhiệm" required></td><td><input type="radio" name="vote_${staff.id}" value="Không tín nhiệm"></td>`; }
            html += `</tr>`;
        });
    });
    html += `</tbody></table>`;
    tableContainer.innerHTML = html;
    document.getElementById('submitBtn').disabled = false;
}
voteTypeSelect.addEventListener('change', renderVotingTable);

document.getElementById('votingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true; submitBtn.innerText = "Đang gửi...";
    const formData = new FormData(document.getElementById('votingForm'));
    const results = [];
    currentStaffData.forEach(dept => { (dept.members || []).forEach(staff => { const voteValue = formData.get(`vote_${staff.id}`); if (voteValue) results.push({ staffId: staff.id, staffName: staff.name, department: dept.department, vote: voteValue }); }); });
    const voteRecord = { quy: document.getElementById('voteQuarter').value, nam: document.getElementById('voteYear').value, voteType: voteTypeSelect.value, timestamp: serverTimestamp(), voter: auth.currentUser ? (auth.currentUser.email || auth.currentUser.displayName) : "Khách ẩn danh", project: "DaiHocHaiPhong_BoPhieu", details: results };
    try { await addDoc(collection(db, "DaiHocHaiPhong_BoPhieu"), voteRecord); showMessage(`Đã gửi phiếu thành công!`); document.getElementById('votingForm').reset(); } 
    catch (error) { handleFirebaseError(error); } 
    finally { submitBtn.disabled = false; submitBtn.innerText = "Gửi phiếu đánh giá"; }
});

document.getElementById('seedDataBtn').addEventListener('click', async () => {
    if(!confirm("Khôi phục sẽ thêm 1 khoa mẫu vào cuối cùng. Bạn đã xóa Collection trên Firebase chưa?")) return;
    try {
        await setDoc(doc(db, "DaiHocHaiPhong_NhanSu", "dept_" + Date.now()), { department: "Mẫu - Phòng A", members: [{ id: "nv_1", name: "Nguyễn Văn Mẫu", email:"", score: "", proposed: "", criteriaScores: {} }], headEmail: "" });
        alert("Khôi phục mẫu xong!");
    } catch(e) { handleFirebaseError(e); }
});