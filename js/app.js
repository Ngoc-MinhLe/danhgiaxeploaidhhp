import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, setDoc, deleteDoc, updateDoc, getDoc, onSnapshot, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

// --- DỮ LIỆU MẪU 3 CẤP ---
const DEFAULT_GROUPS = [
    { id: "g1", name: "1. Về tư tưởng chính trị, đạo đức, lối sống, ý thức tổ chức kỷ luật..." },
    { id: "g2", name: "2. Về kết quả thực hiện chức trách, nhiệm vụ được giao" }
];
const DEFAULT_SUBGROUPS = [
    { id: "sg1_1", groupId: "g1", name: "1.1. Tư tưởng chính trị" },
    { id: "sg1_2", groupId: "g1", name: "1.2. Phẩm chất đạo đức, lối sống" },
    { id: "sg2_1", groupId: "g2", name: "2.1. Việc thực hiện nguyên tắc tập trung dân chủ..." }
];
const DEFAULT_ITEMS = [
    { id: "tc1", subGroupId: "sg1_1", name: "Trung thành với chủ nghĩa Mác - Lênin, tư tưởng Hồ Chí Minh...", max: 2.5 },
    { id: "tc2", subGroupId: "sg1_1", name: "Thực hiện đúng các chủ trương, đường lối của Đảng...", max: 2.5 },
    { id: "tc3", subGroupId: "sg1_2", name: "Không tham nhũng, quan liêu, cơ hội, vụ lợi...", max: 5 },
    { id: "tc4", subGroupId: "sg2_1", name: "Chỉ đạo thực hiện tốt nhiệm vụ chuyên môn của đơn vị...", max: 15 }
];

let CRITERIA_GROUPS = [];
let CRITERIA_SUBGROUPS = [];
let CRITERIA_ITEMS = []; 

let currentStaffData = [];
let userRole = 'guest'; 
let isDhhpUser = false;
let step3Voters = [];
let currentUserVoteId = null;
let currentUserVoteDetails = {};
let step4EligibleStaff = [];
let step4MaxAllowed = 0;
let currentStep4VoteId = null;
let currentStep4VoteDetails = {};

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
                document.getElementById('tabCritAdmin').classList.remove('hidden'); 
                document.getElementById('tabRoleAdmin').classList.remove('hidden'); 
                listenToAdmins();
            } else {
                userRole = 'guest'; userInfo.innerText = `Xin chào, ${userEmail} ${isDhhpUser ? "(Cán bộ trường)" : "(Khách)"}`;
            }
        }
    } else {
        userInfo.innerText = "Bạn chưa đăng nhập"; loginBtn.classList.remove('hidden'); logoutBtn.classList.add('hidden');
    }
    renderAllViews();
});

// --- LẮNG NGHE & QUẢN LÝ TIÊU CHÍ (3 CẤP) ---
onSnapshot(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), async (docSnap) => {
    if (docSnap.exists()) { 
        const data = docSnap.data();
        CRITERIA_GROUPS = Array.isArray(data.groups) ? data.groups : [];
        CRITERIA_SUBGROUPS = Array.isArray(data.subGroups) ? data.subGroups : [];
        CRITERIA_ITEMS = Array.isArray(data.items) ? data.items : [];
    } else { 
        CRITERIA_GROUPS = DEFAULT_GROUPS; 
        CRITERIA_SUBGROUPS = DEFAULT_SUBGROUPS;
        CRITERIA_ITEMS = DEFAULT_ITEMS;
        try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: CRITERIA_GROUPS, subGroups: CRITERIA_SUBGROUPS, items: CRITERIA_ITEMS }); } catch(e) {}
    }
    renderCriteriaAdmin();
    if(document.getElementById('step1').classList.contains('active')) renderStep1();
});

onSnapshot(doc(db, "DaiHocHaiPhong_Config", "Step3Voters"), (docSnap) => {
    if (docSnap.exists()) step3Voters = docSnap.data().emails || [];
    else step3Voters = [];
    renderStep3VotersAdmin();
    loadUserVoteStateAndRender();
});

function renderCriteriaAdmin() {
    // Dropdown chọn Nhóm Lớn
    let groupOpts = '<option value="">-- Chọn Nhóm Lớn --</option>';
    CRITERIA_GROUPS.forEach(g => { groupOpts += `<option value="${g.id}">${g.name}</option>`; });
    document.getElementById('subGroup_groupSelect').innerHTML = groupOpts;

    // Dropdown chọn Mục Con
    let subGroupOpts = '<option value="">-- Chọn Mục Con chứa nó --</option>';
    CRITERIA_SUBGROUPS.forEach(sg => { 
        const parentName = CRITERIA_GROUPS.find(g => g.id === sg.groupId)?.name.substring(0,15) || "";
        subGroupOpts += `<option value="${sg.id}">${sg.name} (${parentName}...)</option>`; 
    });
    document.getElementById('item_subGroupSelect').innerHTML = subGroupOpts;

    // Vẽ bảng cấu trúc
    let html = '<table class="criteria-table"><tr><th>Cấu trúc Tiêu chí Đánh giá</th><th width="15%">Điểm tối đa</th><th width="20%">Thao tác</th></tr>';
    let totalMax = 0;
    
    CRITERIA_GROUPS.forEach(g => {
        html += `<tr style="background:#e9ecef; border-top: 2px solid #ccc;">
            <td class="text-left" style="color:#333; font-size: 1.1em;"><strong>${g.name}</strong></td>
            <td></td>
            <td>
                <button class="action-btn btn-edit" onclick="editGroup('${g.id}')">Sửa</button>
                <button class="action-btn btn-danger" onclick="removeGroup('${g.id}')">Xóa Nhóm</button>
            </td>
        </tr>`;
        
        const subGroups = CRITERIA_SUBGROUPS.filter(sg => sg.groupId === g.id);
        subGroups.forEach(sg => {
            html += `<tr style="background:#f8f9fa;">
                <td class="text-left" style="color:#0056b3; padding-left: 30px;"><strong>${sg.name}</strong></td>
                <td></td>
                <td>
                    <button class="action-btn btn-edit" onclick="editSubGroup('${sg.id}')">Sửa</button>
                    <button class="action-btn btn-danger" onclick="removeSubGroup('${sg.id}')">Xóa Mục</button>
                </td>
            </tr>`;

            const items = CRITERIA_ITEMS.filter(i => i.subGroupId === sg.id);
            items.forEach(c => {
                totalMax += c.max || 0;
                html += `<tr>
                    <td class="text-left" style="padding-left: 50px;">- ${c.name}</td>
                    <td><strong style="color: red;">${c.max}</strong></td>
                    <td>
                        <button class="action-btn btn-edit" onclick="editItem('${c.id}')">Sửa</button>
                        <button class="action-btn btn-danger" onclick="removeItem('${c.id}')">Xóa</button>
                    </td>
                </tr>`;
            });
        });
    });
    html += `<tr><td style="text-align:right"><strong>Tổng điểm hệ thống:</strong></td><td style="color:red; font-weight:bold; font-size:1.2em;">${totalMax}</td><td></td></tr></table>`;
    document.getElementById('criteriaAdminList').innerHTML = html;
    if(document.getElementById('maxScoreDisplay')) document.getElementById('maxScoreDisplay').innerText = totalMax;
}

// 1. Thêm/Sửa/Xóa Nhóm Lớn
document.getElementById('addGroupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newGroupName').value.trim();
    const id = "g_" + Date.now();
    try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: [...CRITERIA_GROUPS, { id, name }], subGroups: CRITERIA_SUBGROUPS, items: CRITERIA_ITEMS }); document.getElementById('addGroupForm').reset(); showMessage("Đã tạo Nhóm Lớn!"); } catch(e) { handleFirebaseError(e); }
});
window.editGroup = async function(id) {
    const idx = CRITERIA_GROUPS.findIndex(g => g.id === id); if(idx === -1) return;
    const newName = prompt("Sửa tên Nhóm Lớn:", CRITERIA_GROUPS[idx].name); if (!newName || newName.trim() === "") return;
    const newArr = [...CRITERIA_GROUPS]; newArr[idx].name = newName.trim();
    try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: newArr, subGroups: CRITERIA_SUBGROUPS, items: CRITERIA_ITEMS }); showMessage("Đã sửa Nhóm!"); } catch(e) { handleFirebaseError(e); }
};
window.removeGroup = async function(id) {
    if(!confirm("Xóa Nhóm Lớn sẽ xóa TOÀN BỘ Mục con và Chi tiết bên trong. Chắc chắn xóa?")) return;
    const newGroups = CRITERIA_GROUPS.filter(g => g.id !== id);
    const newSubGroups = CRITERIA_SUBGROUPS.filter(sg => sg.groupId !== id);
    const subGroupIds = CRITERIA_SUBGROUPS.filter(sg => sg.groupId === id).map(sg => sg.id);
    const newItems = CRITERIA_ITEMS.filter(i => !subGroupIds.includes(i.subGroupId));
    try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: newGroups, subGroups: newSubGroups, items: newItems }); showMessage("Đã xóa Nhóm!");} catch(e) { handleFirebaseError(e); }
};

// 2. Thêm/Sửa/Xóa Mục Con
document.getElementById('addSubGroupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupId = document.getElementById('subGroup_groupSelect').value;
    const name = document.getElementById('newSubGroupName').value.trim();
    if(!groupId) return showMessage("Chọn Nhóm lớn trước!", true);
    const id = "sg_" + Date.now();
    try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: CRITERIA_GROUPS, subGroups: [...CRITERIA_SUBGROUPS, { id, groupId, name }], items: CRITERIA_ITEMS }); document.getElementById('addSubGroupForm').reset(); showMessage("Đã tạo Mục Con!"); } catch(e) { handleFirebaseError(e); }
});
window.editSubGroup = async function(id) {
    const idx = CRITERIA_SUBGROUPS.findIndex(sg => sg.id === id); if(idx === -1) return;
    const newName = prompt("Sửa tên Mục Con:", CRITERIA_SUBGROUPS[idx].name); if (!newName || newName.trim() === "") return;
    const newArr = [...CRITERIA_SUBGROUPS]; newArr[idx].name = newName.trim();
    try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: CRITERIA_GROUPS, subGroups: newArr, items: CRITERIA_ITEMS }); showMessage("Đã sửa Mục Con!"); } catch(e) { handleFirebaseError(e); }
};
window.removeSubGroup = async function(id) {
    if(!confirm("Xóa Mục Con sẽ xóa TOÀN BỘ Chi tiết bên trong. Chắc chắn xóa?")) return;
    const newSubGroups = CRITERIA_SUBGROUPS.filter(sg => sg.id !== id);
    const newItems = CRITERIA_ITEMS.filter(i => i.subGroupId !== id);
    try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: CRITERIA_GROUPS, subGroups: newSubGroups, items: newItems }); showMessage("Đã xóa Mục Con!");} catch(e) { handleFirebaseError(e); }
};

// 3. Thêm/Sửa/Xóa Tiêu Chí Chi Tiết
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const subGroupId = document.getElementById('item_subGroupSelect').value;
    const name = document.getElementById('newItemName').value.trim();
    const max = parseFloat(document.getElementById('newItemMax').value);
    if(!subGroupId) return showMessage("Chọn Mục Con trước!", true);
    const id = "tc_" + Date.now();
    try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: CRITERIA_GROUPS, subGroups: CRITERIA_SUBGROUPS, items: [...CRITERIA_ITEMS, { id, subGroupId, name, max }] }); document.getElementById('addItemForm').reset(); showMessage("Đã thêm Chi tiết điểm!"); } catch(e) { handleFirebaseError(e); }
});
window.editItem = async function(id) {
    const idx = CRITERIA_ITEMS.findIndex(i => i.id === id); if(idx === -1) return;
    const crit = CRITERIA_ITEMS[idx];
    const newName = prompt("Nội dung chi tiết mới:", crit.name); if (!newName || newName.trim() === "") return;
    const newMaxStr = prompt("Điểm tối đa mới:", crit.max); if (newMaxStr === null) return;
    const newMax = parseFloat(newMaxStr); if (isNaN(newMax)) return showMessage("Điểm phải là số!", true);
    const newArr = [...CRITERIA_ITEMS]; newArr[idx] = { ...crit, name: newName.trim(), max: newMax };
    try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: CRITERIA_GROUPS, subGroups: CRITERIA_SUBGROUPS, items: newArr }); showMessage("Đã sửa Chi tiết!"); } catch(e) { handleFirebaseError(e); }
};
window.removeItem = async function(id) {
    if(!confirm("Xóa dòng chi tiết này?")) return;
    const newItems = CRITERIA_ITEMS.filter(c => c.id !== id);
    try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "TieuChi"), { groups: CRITERIA_GROUPS, subGroups: CRITERIA_SUBGROUPS, items: newItems }); } catch(e) { handleFirebaseError(e); }
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
    updateDropdowns(); renderAdminStaffTable(); renderStep1(); renderStep2(); loadUserVoteStateAndRender(); 
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
            const hasEmail = staff.email && staff.email.trim() !== '';
            html += `<tr>
                <td></td><td class="text-left"><strong>${staff.name}</strong></td>
                <td>${hasEmail ? staff.email : '<span style="color:#dc3545; font-style:italic">Chưa có email</span>'}</td>
                <td>
                    <button class="action-btn btn-edit" onclick="editStaffName('${dept.id}', '${staff.id}')">Sửa Tên</button>
                    <button class="action-btn btn-success" onclick="assignStaffEmail('${dept.id}', '${staff.id}')">${hasEmail ? 'Sửa Email' : 'Gán Email'}</button>
                    <button class="action-btn btn-danger" onclick="deleteStaff('${dept.id}', '${staff.id}')">Xóa</button>
                </td>
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

window.editStaffName = async function(deptId, staffId) {
    const dept = currentStaffData.find(d => d.id === deptId);
    if (!dept || !dept.members) return;
    const staff = dept.members.find(m => m.id === staffId);
    if (!staff) return;

    const newName = prompt("Sửa Họ và Tên:", staff.name);
    if (newName === null || newName.trim() === "") return;

    const updatedMembers = dept.members.map(m => m.id === staffId ? { ...m, name: newName.trim() } : m);
    try {
        await updateDoc(doc(db, "DaiHocHaiPhong_NhanSu", deptId), { members: updatedMembers });
        showMessage("Đã sửa tên nhân viên!");
    } catch (e) { handleFirebaseError(e); }
};

window.assignStaffEmail = async function(deptId, staffId) {
    const dept = currentStaffData.find(d => d.id === deptId);
    if (!dept || !dept.members) return;
    const staff = dept.members.find(m => m.id === staffId);
    if (!staff) return;

    const newEmail = prompt(`Nhập email cho nhân viên "${staff.name}":`, staff.email || "");
    if (newEmail === null) return; // User cancelled

    const updatedMembers = dept.members.map(m => m.id === staffId ? { ...m, email: newEmail.trim() } : m);
    try {
        await updateDoc(doc(db, "DaiHocHaiPhong_NhanSu", deptId), { members: updatedMembers });
        showMessage("Đã cập nhật email!");
    } catch (e) { handleFirebaseError(e); }
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
function listenToAdmins() {
    onSnapshot(collection(db, "DaiHocHaiPhong_Admins"), (snapshot) => {
        let html = `<div class="admin-item" style="background-color: #f1f8ff; padding: 8px; border-radius: 4px; margin-bottom: 5px;">
            <span><strong>${SUPER_ADMIN_EMAIL}</strong> <span style="color:#dc3545; font-size:0.9em">(Super Admin)</span></span>
            <span style="color:#28a745; font-size:12px; font-style:italic;">Mặc định (Không thể gỡ)</span>
        </div>`;
        snapshot.forEach(doc => {
            const email = doc.id;
            html += `<div class="admin-item" style="padding: 8px;">
                <span><strong>${email}</strong> <span style="color:#0056b3; font-size:0.9em">(Admin)</span></span>
                ${userRole === 'superadmin' ? `<button class="action-btn btn-danger" onclick="removeAdmin('${email}')">Gỡ quyền</button>` : ''}
            </div>`;
        });
        const adminListDiv = document.getElementById('adminList');
        if (adminListDiv) adminListDiv.innerHTML = html;
    });
}

function renderStep3VotersAdmin() {
    let html = '';
    step3Voters.forEach(email => {
        html += `<div class="admin-item" style="padding: 8px;">
            <span><strong>${email}</strong></span>
            ${userRole === 'superadmin' || userRole === 'admin' ? `<button class="action-btn btn-danger" onclick="removeStep3Voter('${email}')">Xóa</button>` : ''}
        </div>`;
    });
    const listDiv = document.getElementById('step3VoterList');
    if (listDiv) listDiv.innerHTML = html;
}
document.getElementById('addStep3VoterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    if (userRole !== 'superadmin' && userRole !== 'admin') return showMessage("Bạn không có quyền thực hiện hành động này.", true);
    const email = document.getElementById('newStep3VoterEmail').value.trim();
    if (!step3Voters.includes(email)) { try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "Step3Voters"), { emails: [...step3Voters, email] }); document.getElementById('addStep3VoterForm').reset(); } catch(e) { handleFirebaseError(e); } }
});
window.removeStep3Voter = async function(email) { 
    if (userRole !== 'superadmin' && userRole !== 'admin') return showMessage("Bạn không có quyền thực hiện hành động này.", true);
    if(!confirm(`Xóa quyền của ${email}?`)) return; try { await setDoc(doc(db, "DaiHocHaiPhong_Config", "Step3Voters"), { emails: step3Voters.filter(e => e !== email) }); } catch(e) { handleFirebaseError(e); } 
};

document.getElementById('addAdminForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newEmail = document.getElementById('newAdminEmail').value.trim();
    if (!newEmail.endsWith('@dhhp.edu.vn')) return alert("Chỉ cấp quyền cho email đuôi @dhhp.edu.vn");
    try { await setDoc(doc(db, "DaiHocHaiPhong_Admins", newEmail), { email: newEmail, addedBy: SUPER_ADMIN_EMAIL, timestamp: serverTimestamp() }); document.getElementById('addAdminForm').reset(); } 
    catch(e) { handleFirebaseError(e); }
});
window.removeAdmin = async function(email) {
    if (userRole !== 'superadmin') return showMessage("Bạn không có quyền thực hiện hành động này.", true);
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

// --- BƯỚC 1: CÁ NHÂN TỰ ĐÁNH GIÁ (HIỂN THỊ THEO NHÓM 3 CẤP) ---
function getPeriodData(member, periodKey) {
    if (member.assessments && member.assessments[periodKey]) return member.assessments[periodKey];
    // Đảm bảo không mất dữ liệu cũ đã chấm trước khi nâng cấp
    if (member.selfQuarter === periodKey.split('_')[0] && String(member.selfYear) === String(periodKey.split('_')[1])) {
        return {
            score: member.score,
            criteriaScores: member.criteriaScores,
            selfClassification: member.selfClassification,
            disabledGroups: member.disabledGroups,
            peerVotes: member.peerVotes,
            proposed: member.proposed
        };
    }
    return {};
}
document.getElementById('selfQuarter')?.addEventListener('change', renderStep1);
document.getElementById('selfYear')?.addEventListener('change', renderStep1);
document.getElementById('step2Quarter')?.addEventListener('change', renderStep2);
document.getElementById('step2Year')?.addEventListener('change', renderStep2);

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
    document.getElementById('step1MetaControls').style.display = 'flex';
    document.getElementById('selfDeptId').value = myDept.id;
    document.getElementById('selfStaffId').value = myProfile.id;
    document.getElementById('selfDeptName').value = myDept.department;
    document.getElementById('selfStaffName').value = myProfile.name;
    
    const q = document.getElementById('selfQuarter').value;
    const y = document.getElementById('selfYear').value;
    const periodKey = `${q}_${y}`;
    const periodData = getPeriodData(myProfile, periodKey);

    if(periodData.selfClassification) document.getElementById('selfClassification').value = periodData.selfClassification;
    else document.getElementById('selfClassification').value = "";
    
    let criteriaHtml = `<table class="criteria-table"><thead><tr><th>Nội dung tiêu chí đánh giá</th><th width="15%">Điểm tối đa</th><th width="15%">Điểm tự chấm</th></tr></thead><tbody>`;
    const savedScores = periodData.criteriaScores || {}; 
    const disabledGroups = periodData.disabledGroups || [];
    
    if(CRITERIA_GROUPS.length === 0) criteriaHtml += `<tr><td colspan="3">Chưa có cấu hình tiêu chí. Vui lòng báo Quản trị viên.</td></tr>`;
    
    // Đổ dữ liệu theo Nhóm (Cấp 1) -> Mục con (Cấp 2) -> Chi tiết (Cấp 3)
    CRITERIA_GROUPS.forEach(g => {
        const isChecked = !disabledGroups.includes(g.id);
        criteriaHtml += `<tr style="background:#e9ecef; border-top: 2px solid #ccc;"><td colspan="3" class="text-left" style="font-size: 1.1em; font-weight:bold; color:#333;">
            <label style="cursor:pointer;"><input type="checkbox" class="group-toggle" data-gid="${g.id}" ${isChecked ? 'checked' : ''} style="transform: scale(1.2); margin-right: 8px;"> ${g.name} <span style="font-size:12px; color:#666; font-weight:normal; margin-left:10px;">(Bỏ tích nếu không thuộc đối tượng đánh giá nhóm này)</span></label>
        </td></tr>`;
        
        const subGroups = CRITERIA_SUBGROUPS.filter(sg => sg.groupId === g.id);
        subGroups.forEach(sg => {
            criteriaHtml += `<tr style="background:#f8f9fa;"><td colspan="3" class="text-left" style="font-weight:bold; color:#0056b3; padding-left: 30px;">${sg.name}</td></tr>`;
            
            const items = CRITERIA_ITEMS.filter(i => i.subGroupId === sg.id);
            items.forEach(tc => {
                const val = savedScores[tc.id] !== undefined ? savedScores[tc.id] : '';
                criteriaHtml += `<tr>
                    <td class="text-left" style="padding-left: 50px;">- ${tc.name}</td>
                    <td style="font-weight:bold;">${tc.max}</td>
                    <td><input type="number" class="crit-input g-item-${g.id}" data-id="${tc.id}" data-max="${tc.max}" value="${val}" min="0" max="${tc.max}" step="0.5" ${isChecked ? 'required' : 'disabled'}></td>
                </tr>`;
            });
        });
    });
    
    criteriaHtml += `</tbody></table>`;
    document.getElementById('criteriaContainer').innerHTML = criteriaHtml;

    document.querySelectorAll('.group-toggle').forEach(toggle => {
        toggle.addEventListener('change', function() {
            const gid = this.dataset.gid;
            document.querySelectorAll(`.g-item-${gid}`).forEach(input => {
                input.disabled = !this.checked;
                if(!this.checked) {
                    input.value = '';
                    input.removeAttribute('required');
                } else {
                    input.setAttribute('required', 'true');
                }
            });
            calculateTotalScore();
        });
    });

    document.querySelectorAll('.crit-input').forEach(input => { input.addEventListener('input', calculateTotalScore); });
    calculateTotalScore();
}

function calculateTotalScore() {
    let total = 0;
    let activeMax = 0;
    document.querySelectorAll('.crit-input').forEach(input => {
        if (!input.disabled) {
            let val = parseFloat(input.value); let max = parseFloat(input.dataset.max);
            if(val > max) { input.value = max; val = max; } 
            total += val || 0;
            activeMax += max;
        }
    });
    document.getElementById('selfScoreInput').value = total;
    if(document.getElementById('maxScoreDisplay')) document.getElementById('maxScoreDisplay').innerText = activeMax;

        const scoreWarning = document.getElementById('scoreWarning');
        if (scoreWarning) {
            if (activeMax > 100) {
                scoreWarning.innerHTML = `⚠️ Vui lòng <strong>bỏ tích</strong> bớt các Nhóm đối tượng không thuộc phạm vi đánh giá để Điểm tối đa không vượt quá 100đ!`;
                scoreWarning.classList.remove('hidden');
            } else if (activeMax < 100 && activeMax > 0) {
                scoreWarning.innerHTML = `⚠️ Điểm tối đa đang dưới 100đ. Vui lòng kiểm tra lại.`;
                scoreWarning.classList.remove('hidden');
            } else {
                scoreWarning.classList.add('hidden');
            }
        }

        const selfClassSelect = document.getElementById('selfClassification');
        const classWarning = document.getElementById('classificationWarning');
        if (selfClassSelect) {
            const optionXuatSac = selfClassSelect.querySelector('option[value="HTXSNV"]');
            if (total < 90) {
                if(optionXuatSac) optionXuatSac.disabled = true;
                if(selfClassSelect.value === 'HTXSNV') selfClassSelect.value = '';
                if(classWarning) {
                    classWarning.innerText = "💡 Cảnh báo nhẹ: Điểm tự chấm của bạn dưới 90 điểm, chưa đủ điều kiện để tự nhận Xếp loại Xuất sắc.";
                    classWarning.classList.remove('hidden');
                }
            } else {
                if(optionXuatSac) optionXuatSac.disabled = false;
                if(classWarning) classWarning.classList.add('hidden');
            }
        }
}

document.getElementById('selfScoreForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const activeMax = parseFloat(document.getElementById('maxScoreDisplay').innerText) || 0;
    if (activeMax > 100) {
        alert("Vui lòng bỏ tích bớt Nhóm đối tượng để Điểm tối đa không vượt quá 100đ trước khi lưu!");
        return;
    }

    const deptId = document.getElementById('selfDeptId').value;
    const staffId = document.getElementById('selfStaffId').value;
    const totalScore = parseFloat(document.getElementById('selfScoreInput').value);
    const selfQuarter = document.getElementById('selfQuarter').value;
    const selfYear = document.getElementById('selfYear').value;
    const selfClassification = document.getElementById('selfClassification').value;
    
    const criteriaScores = {};
    document.querySelectorAll('.crit-input').forEach(input => { criteriaScores[input.dataset.id] = parseFloat(input.value) || 0; });

    const disabledGroups = [];
    document.querySelectorAll('.group-toggle:not(:checked)').forEach(t => disabledGroups.push(t.dataset.gid));

    const periodKey = `${selfQuarter}_${selfYear}`;

    const deptDoc = currentStaffData.find(d => d.id === deptId);
    if(!deptDoc || !deptDoc.members) return;
    const updatedMembers = deptDoc.members.map(m => {
        if (m.id === staffId) {
            const assessments = m.assessments || {};
            const periodData = getPeriodData(m, periodKey);
            assessments[periodKey] = {
                ...periodData,
                score: totalScore,
                criteriaScores: criteriaScores,
                selfClassification: selfClassification,
                disabledGroups: disabledGroups
            };
            return { ...m, assessments };
        }
        return m;
    });
    
    try { await updateDoc(doc(db, "DaiHocHaiPhong_NhanSu", deptId), { members: updatedMembers }); showMessage("Đã lưu bảng điểm tự đánh giá!"); } 
    catch(e) { handleFirebaseError(e); }
});

// --- BƯỚC 2: TRƯỞNG ĐƠN VỊ ĐỀ XUẤT ---
const deptProposalForm = document.getElementById('deptProposalForm');
const proposalTableBody = document.getElementById('proposalTableBody');
const step2AuthMessage = document.getElementById('step2AuthMessage');
const step2Controls = document.getElementById('step2Controls');

function renderStep2() {
    if (!auth.currentUser || !isDhhpUser) {
        step2AuthMessage.innerText = "Đăng nhập bằng tài khoản @dhhp.edu.vn để tham gia bình bầu.";
        deptProposalForm.classList.add('hidden');
        if(step2Controls) step2Controls.style.display = 'none';
        return;
    }
    const userEmail = auth.currentUser.email;
    const involvedDepts = currentStaffData.filter(d => d.headEmail === userEmail || (d.members && d.members.some(m => m.email === userEmail)));
    
    if (involvedDepts.length === 0) {
        step2AuthMessage.innerText = "Tài khoản của bạn CHƯA thuộc phòng ban nào để bình bầu.";
        step2AuthMessage.style.color = "#dc3545"; deptProposalForm.classList.add('hidden');
        if(step2Controls) step2Controls.style.display = 'none';
        return;
    }

    step2AuthMessage.innerText = `Khu vực Bình bầu của bạn`;
    step2AuthMessage.style.color = "#28a745"; deptProposalForm.classList.remove('hidden');
    if(step2Controls) step2Controls.style.display = 'flex';

    const step2Quarter = document.getElementById('step2Quarter').value;
    const step2Year = document.getElementById('step2Year').value;
    const periodKey = `${step2Quarter}_${step2Year}`;

    let html = '';
    involvedDepts.forEach(dept => {
        const isHead = dept.headEmail === userEmail;
        html += `<tr class="dept-row"><td colspan="6">Khu vực: ${dept.department} ${isHead ? '(Bạn là Trưởng đơn vị)' : '(Thành viên)'}</td></tr>`;
        (dept.members || []).forEach((m, index) => {
            const periodData = getPeriodData(m, periodKey);
            const myPeerVote = (periodData.peerVotes || {})[userEmail] || '';
            const selfClass = periodData.selfClassification ? `<span style="color:#17a2b8; font-weight:bold">${periodData.selfClassification}</span>` : '<span style="color:#999; font-style:italic">Chưa tự chấm</span>';
            
            const scoreVal = parseFloat(periodData.score);
            const canBeXuatsac = !isNaN(scoreVal) && scoreVal >= 90;
            const disableXuatSacAttr = canBeXuatsac ? '' : 'disabled';
            const xuatSacText = canBeXuatsac ? 'Hoàn thành Xuất sắc' : 'HT Xuất sắc (Cần >= 90đ)';
            const peerXuatSacSel = (myPeerVote === 'HTXSNV' && canBeXuatsac) ? 'selected' : '';
            const propXuatSacSel = (periodData.proposed === 'HTXSNV' && canBeXuatsac) ? 'selected' : '';

            html += `<tr>
                <td>${index + 1}</td><td class="text-left">${m.name}</td>
                <td><strong style="color:red; font-size:1.1em">${periodData.score !== undefined && periodData.score !== "" ? periodData.score : '—'}</strong></td>
                <td>${selfClass}</td>
                <td>
                    <select name="peer_${dept.id}_${m.id}" style="padding: 5px; width: 100%;">
                        <option value="">-- Bình bầu --</option>
                        <option value="HTXSNV" ${peerXuatSacSel} ${disableXuatSacAttr}>${xuatSacText}</option>
                        <option value="HTTNV" ${myPeerVote === 'HTTNV' ? 'selected' : ''}>Hoàn thành Tốt</option>
                        <option value="HTNV" ${myPeerVote === 'HTNV' ? 'selected' : ''}>Hoàn thành NV</option>
                        <option value="KHTNV" ${myPeerVote === 'KHTNV' ? 'selected' : ''}>Không HTNV</option>
                    </select>
                </td>
                <td>
                    <select name="prop_${dept.id}_${m.id}" style="padding: 5px; width: 100%; background: ${isHead ? '#fff' : '#e9ecef'};" ${isHead ? '' : 'disabled'}>
                        <option value="">-- Trưởng ĐV chốt --</option>
                        <option value="HTXSNV" ${propXuatSacSel} ${disableXuatSacAttr}>${xuatSacText}</option>
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
    const userEmail = auth.currentUser.email; 
    const involvedDepts = currentStaffData.filter(d => d.headEmail === userEmail || (d.members && d.members.some(m => m.email === userEmail)));
    const formData = new FormData(deptProposalForm);
    const propQuarter = document.getElementById('step2Quarter') ? document.getElementById('step2Quarter').value : '';
    const propYear = document.getElementById('step2Year') ? document.getElementById('step2Year').value : '';
    const periodKey = `${propQuarter}_${propYear}`;

    try {
        for (const dept of involvedDepts) {
            const isHead = dept.headEmail === userEmail;
            const updatedMembers = (dept.members || []).map(m => {
                const peerVal = formData.get(`peer_${dept.id}_${m.id}`);
                const propValue = formData.get(`prop_${dept.id}_${m.id}`);
                
                const assessments = m.assessments || {};
                const periodData = getPeriodData(m, periodKey);
                
                let newPeerVotes = { ...(periodData.peerVotes || {}) };
                if (peerVal) newPeerVotes[userEmail] = peerVal; else delete newPeerVotes[userEmail];
                
                let updatedPeriodData = { ...periodData, peerVotes: newPeerVotes };
                if (isHead) {
                    updatedPeriodData.proposed = propValue || periodData.proposed || "";
                }
                
                assessments[periodKey] = updatedPeriodData;
                return { ...m, assessments };
            });
            await updateDoc(doc(db, "DaiHocHaiPhong_NhanSu", dept.id), { members: updatedMembers });
        }
        showMessage("Lưu Đề xuất thành công!");
    } catch(e) { handleFirebaseError(e); }
});

// --- BƯỚC 3: BỎ PHIẾU ĐẢNG ỦY ---
const tableContainer = document.getElementById('tableContainer');
const voteTypeSelect = document.getElementById('voteType');

async function loadUserVoteStateAndRender() {
    const q = document.getElementById('voteQuarter').value;
    const y = document.getElementById('voteYear').value;
    const vType = voteTypeSelect.value;
    const voterEmail = auth.currentUser ? (auth.currentUser.email || auth.currentUser.displayName) : "Khách ẩn danh";

    currentUserVoteId = null;
    currentUserVoteDetails = {};

    if(auth.currentUser) {
        try {
            const qSnap = await getDocs(query(collection(db, "DaiHocHaiPhong_BoPhieu"), where("quy", "==", q), where("nam", "==", y), where("voteType", "==", vType), where("voter", "==", voterEmail)));
            if(!qSnap.empty) {
                const docSnap = qSnap.docs[0];
                currentUserVoteId = docSnap.id;
                const data = docSnap.data();
                (data.details || []).forEach(d => { currentUserVoteDetails[d.staffId] = d.vote; });
            }
        } catch(e) { console.error("Error loading vote state:", e); }
    }
    renderVotingTable();
}

function renderVotingTable() {
    if(currentStaffData.length === 0) { tableContainer.innerHTML = "<p style='text-align:center;'>Chưa có dữ liệu.</p>"; document.getElementById('submitBtn').disabled = true; if(document.getElementById('votingStatusMsg')) document.getElementById('votingStatusMsg').innerHTML = ''; return; }
    
    const userEmail = auth.currentUser ? auth.currentUser.email : '';
    const canVote = userRole === 'superadmin' || userRole === 'admin' || step3Voters.includes(userEmail);
    
    const statusMsg = document.getElementById('votingStatusMsg');
    if(statusMsg) {
        if (currentUserVoteId) { statusMsg.innerHTML = `<div class="success" style="padding: 10px; border-radius: 4px; margin-bottom: 10px; background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;">Bạn đã nộp phiếu cho kỳ này. Bạn có thể thay đổi lựa chọn bên dưới và bấm Cập nhật để sửa phiếu.</div>`; } 
        else { statusMsg.innerHTML = ''; }
    }

    const voteType = voteTypeSelect.value;
    const q = document.getElementById('voteQuarter').value;
    const y = document.getElementById('voteYear').value;
    const periodKey = `${q}_${y}`;

    let html = `<table class="criteria-table"><thead><tr><th width="5%">TT</th><th width="20%">Họ tên</th><th width="8%">Điểm</th><th width="15%">Tự Nhận</th><th width="15%">Đề xuất ĐV</th>`;
    if (voteType === 'xeploai') html += `<th width="12%">HTTNV</th><th width="12%">HTNV</th><th width="13%">KHTNV</th>`;
    else html += `<th width="20%">Tín nhiệm</th><th width="20%">Không tín nhiệm</th>`;
    html += `</tr></thead><tbody>`;

    currentStaffData.forEach(dept => {
        html += `<tr class="dept-row"><td colspan="5">${dept.department}</td>${voteType === 'xeploai' ? '<td colspan="3"></td>' : '<td colspan="2"></td>'}</tr>`;
        (dept.members || []).forEach((staff, index) => {
            const periodData = getPeriodData(staff, periodKey);
            html += `<tr><td>${index + 1}</td><td class="text-left" style="font-weight:bold;">${staff.name}</td>
                <td><strong style="color:red">${periodData.score !== undefined && periodData.score !== "" ? periodData.score : ''}</strong></td>
                <td><span style="color:#17a2b8; font-weight:bold;">${periodData.selfClassification || ''}</span></td>
                <td style="font-weight:bold; color:#0056b3">${periodData.proposed || ''}</td>`;
            const myVote = currentUserVoteDetails[staff.id] || '';
            if (canVote) {
                if (voteType === 'xeploai') { html += `<td><input type="radio" name="vote_${staff.id}" value="HTTNV" ${myVote==='HTTNV'?'checked':''} required></td><td><input type="radio" name="vote_${staff.id}" value="HTNV" ${myVote==='HTNV'?'checked':''}></td><td><input type="radio" name="vote_${staff.id}" value="KHTNV" ${myVote==='KHTNV'?'checked':''}></td>`; } 
                else { html += `<td><input type="radio" name="vote_${staff.id}" value="Tín nhiệm" ${myVote==='Tín nhiệm'?'checked':''} required></td><td><input type="radio" name="vote_${staff.id}" value="Không tín nhiệm" ${myVote==='Không tín nhiệm'?'checked':''}></td>`; }
            } else {
                if (voteType === 'xeploai') { html += `<td colspan="3"><span style="color:#ccc">Không có quyền</span></td>`; } 
                else { html += `<td colspan="2"><span style="color:#ccc">Không có quyền</span></td>`; }
            }
            html += `</tr>`;
        });
    });
    html += `</tbody></table>`;
    tableContainer.innerHTML = html;
    if(canVote) {
        document.getElementById('submitBtn').disabled = false;
        document.getElementById('submitBtn').innerText = currentUserVoteId ? "Cập nhật phiếu đánh giá" : "Gửi phiếu đánh giá cấp Đảng ủy";
    } else {
        document.getElementById('submitBtn').disabled = true;
        document.getElementById('submitBtn').innerText = "Tài khoản của bạn không có quyền bỏ phiếu";
    }
}
voteTypeSelect.addEventListener('change', loadUserVoteStateAndRender);
document.getElementById('voteQuarter').addEventListener('change', loadUserVoteStateAndRender);
document.getElementById('voteYear').addEventListener('change', loadUserVoteStateAndRender);

document.getElementById('votingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true; submitBtn.innerText = "Đang gửi...";
    
    const q = document.getElementById('voteQuarter').value;
    const y = document.getElementById('voteYear').value;
    const vType = voteTypeSelect.value;
    const voterEmail = auth.currentUser ? (auth.currentUser.email || auth.currentUser.displayName) : "Khách ẩn danh";

    try {
        const formData = new FormData(document.getElementById('votingForm'));
        const results = [];
        currentStaffData.forEach(dept => { (dept.members || []).forEach(staff => { const voteValue = formData.get(`vote_${staff.id}`); if (voteValue) results.push({ staffId: staff.id, staffName: staff.name, department: dept.department, vote: voteValue }); }); });
        const voteRecord = { quy: q, nam: y, voteType: vType, timestamp: serverTimestamp(), voter: voterEmail, project: "DaiHocHaiPhong_BoPhieu", details: results };
        
        if (currentUserVoteId) {
            await updateDoc(doc(db, "DaiHocHaiPhong_BoPhieu", currentUserVoteId), voteRecord);
            showMessage(`Đã cập nhật phiếu thành công!`);
        } else {
            const docRef = await addDoc(collection(db, "DaiHocHaiPhong_BoPhieu"), voteRecord);
            currentUserVoteId = docRef.id;
            showMessage(`Đã gửi phiếu thành công!`);
        }
        results.forEach(r => currentUserVoteDetails[r.staffId] = r.vote);
        renderVotingTable();
    } 
    catch (error) { handleFirebaseError(error); } 
    finally { submitBtn.disabled = false; if(submitBtn) submitBtn.innerText = currentUserVoteId ? "Cập nhật phiếu đánh giá" : "Gửi phiếu đánh giá cấp Đảng ủy"; }
});

// --- BƯỚC 4: BẦU XUẤT SẮC ---
document.getElementById('loadStep4Btn')?.addEventListener('click', async () => {
    const q = document.getElementById('step4Quarter').value; const y = document.getElementById('step4Year').value;
    const form = document.getElementById('step4VotingForm'); const tableContainer = document.getElementById('step4TableContainer');
    const statusMsg = document.getElementById('step4StatusMsg'); const submitBtn = document.getElementById('submitStep4Btn');

    form.classList.remove('hidden'); tableContainer.innerHTML = '<p style="text-align:center;">Đang tổng hợp kết quả Bước 3...</p>'; submitBtn.disabled = true;
    const voterEmail = auth.currentUser ? (auth.currentUser.email || auth.currentUser.displayName) : "Khách ẩn danh";
    const canVote = userRole === 'superadmin' || userRole === 'admin' || step3Voters.includes(voterEmail);

    if (!canVote) { tableContainer.innerHTML = '<p style="color:red; text-align:center; font-weight:bold;">Bạn không có quyền bỏ phiếu ở bước này.</p>'; return; }

    try {
        const qSnap = await getDocs(query(collection(db, "DaiHocHaiPhong_BoPhieu"), where("quy", "==", q), where("nam", "==", y), where("voteType", "==", "xeploai")));
        if (qSnap.empty) { tableContainer.innerHTML = '<p style="text-align:center;">Chưa có dữ liệu bỏ phiếu Bước 3 cho kỳ này. Không thể tiến hành Bước 4.</p>'; return; }

        const tally = {};
        qSnap.forEach(doc => {
            const data = doc.data();
            (data.details || []).forEach(d => {
                if (!tally[d.staffId]) tally[d.staffId] = { name: d.staffName, dept: d.department, votes: {} };
                tally[d.staffId].votes[d.vote] = (tally[d.staffId].votes[d.vote] || 0) + 1;
            });
        });

        step4EligibleStaff = [];
        for (const staffId in tally) {
            const votes = tally[staffId].votes; let maxCount = 0; let majorityVote = null;
            for (const vType in votes) { if (votes[vType] > maxCount) { maxCount = votes[vType]; majorityVote = vType; } }
            if (majorityVote === 'HTTNV') step4EligibleStaff.push({ id: staffId, ...tally[staffId] });
        }

        if (step4EligibleStaff.length === 0) { tableContainer.innerHTML = '<p style="text-align:center; color:#0056b3; font-weight:bold;">Không có cá nhân nào đạt kết quả Hoàn thành Tốt nhiệm vụ ở Bước 3.</p>'; return; }

        step4MaxAllowed = Math.floor(step4EligibleStaff.length * 0.2); // Tối đa 20%
        
        currentStep4VoteId = null; currentStep4VoteDetails = {};
        const myVoteSnap = await getDocs(query(collection(db, "DaiHocHaiPhong_BoPhieu"), where("quy", "==", q), where("nam", "==", y), where("voteType", "==", "xuatsac"), where("voter", "==", voterEmail)));
        if (!myVoteSnap.empty) {
            const docSnap = myVoteSnap.docs[0]; currentStep4VoteId = docSnap.id;
            (docSnap.data().details || []).forEach(d => { currentStep4VoteDetails[d.staffId] = d.vote; });
        }
        renderStep4Table();
    } catch(e) { handleFirebaseError(e); }
});

function renderStep4Table() {
    const tableContainer = document.getElementById('step4TableContainer'); const statusMsg = document.getElementById('step4StatusMsg'); const submitBtn = document.getElementById('submitStep4Btn');
    
    statusMsg.innerHTML = `<div style="background:#fff3cd; color:#856404; padding:10px; border-radius:4px; border:1px solid #ffeeba;">
        Có tổng số <strong>${step4EligibleStaff.length}</strong> ứng viên đạt HTTNV. Bạn được phép bầu tối đa <strong>${step4MaxAllowed}</strong> cá nhân (20%).
    </div>`;
    
    if (currentStep4VoteId) statusMsg.innerHTML += `<div class="success" style="padding: 10px; border-radius: 4px; margin-top: 10px; background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;">Bạn đã nộp phiếu Xuất sắc. Có thể cập nhật lại bên dưới.</div>`;
    if (step4MaxAllowed === 0) {
         statusMsg.innerHTML += `<div style="color:red; font-weight:bold; margin-top:10px;">Do số lượng ứng viên quá ít, chỉ tiêu 20% bằng 0. Không thể bầu Xuất sắc trong kỳ này.</div>`;
         tableContainer.innerHTML = ''; submitBtn.disabled = true; return;
    }

    let html = `<table class="criteria-table"><thead><tr><th width="10%">TT</th><th width="30%">Họ tên</th><th width="40%">Đơn vị</th><th width="20%">Bầu Xuất Sắc</th></tr></thead><tbody>`;
    step4EligibleStaff.sort((a,b) => a.dept.localeCompare(b.dept) || a.name.localeCompare(b.name));
    
    const q = document.getElementById('step4Quarter').value; 
    const y = document.getElementById('step4Year').value;
    const periodKey = `${q}_${y}`;

    step4EligibleStaff.forEach((staff, index) => {
        let staffScore = 0;
        for (const d of currentStaffData) {
            const m = (d.members || []).find(x => x.id === staff.id);
            if (m) { staffScore = parseFloat(getPeriodData(m, periodKey).score) || 0; break; }
        }
        const canBeXuatsac = staffScore >= 90;

        const isChecked = currentStep4VoteDetails[staff.id] === 'HTXSNV';
        html += `<tr>
            <td>${index + 1}</td><td class="text-left" style="font-weight:bold;">${staff.name} ${!canBeXuatsac ? '<br><small style="color:#dc3545; font-weight:normal;">(Điểm < 90: Không đủ điều kiện)</small>' : ''}</td><td>${staff.dept}</td>
            <td><input type="checkbox" class="step4-checkbox" name="vote_s4_${staff.id}" value="HTXSNV" ${isChecked ? 'checked' : ''} ${!canBeXuatsac ? 'disabled' : ''} style="transform: scale(1.5);"></td>
        </tr>`;
    });
    html += `</tbody></table>`; tableContainer.innerHTML = html;
    submitBtn.disabled = false; submitBtn.innerText = currentStep4VoteId ? "Cập nhật phiếu bầu Xuất sắc" : "Gửi phiếu bầu Xuất sắc";

    // JS logic giới hạn số lượng checkbox
    document.querySelectorAll('.step4-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            if (document.querySelectorAll('.step4-checkbox:checked').length > step4MaxAllowed) {
                cb.checked = false; alert(`Bạn chỉ được chọn tối đa ${step4MaxAllowed} người!`);
            }
        });
    });
}

document.getElementById('step4VotingForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitStep4Btn'); submitBtn.disabled = true; submitBtn.innerText = "Đang gửi...";
    const q = document.getElementById('step4Quarter').value; const y = document.getElementById('step4Year').value;
    const voterEmail = auth.currentUser ? (auth.currentUser.email || auth.currentUser.displayName) : "Khách ẩn danh";

    try {
        const formData = new FormData(document.getElementById('step4VotingForm'));
        const results = [];
        step4EligibleStaff.forEach(staff => { 
            const voteValue = formData.get(`vote_s4_${staff.id}`); 
            if (voteValue) results.push({ staffId: staff.id, staffName: staff.name, department: staff.dept, vote: voteValue }); 
        });
        const voteRecord = { quy: q, nam: y, voteType: 'xuatsac', timestamp: serverTimestamp(), voter: voterEmail, project: "DaiHocHaiPhong_BoPhieu", details: results };
        if (currentStep4VoteId) {
            await updateDoc(doc(db, "DaiHocHaiPhong_BoPhieu", currentStep4VoteId), voteRecord); showMessage(`Đã cập nhật phiếu bầu Xuất sắc!`);
        } else {
            const docRef = await addDoc(collection(db, "DaiHocHaiPhong_BoPhieu"), voteRecord); currentStep4VoteId = docRef.id; showMessage(`Đã gửi phiếu bầu Xuất sắc!`);
        }
        results.forEach(r => currentStep4VoteDetails[r.staffId] = r.vote);
        renderStep4Table();
    } 
    catch (error) { handleFirebaseError(error); } 
    finally { submitBtn.disabled = false; if(submitBtn) submitBtn.innerText = currentStep4VoteId ? "Cập nhật phiếu bầu Xuất sắc" : "Gửi phiếu bầu Xuất sắc"; }
});

// --- XEM VÀ XUẤT KẾT QUẢ BƯỚC 3 ---
document.getElementById('loadResultsBtn')?.addEventListener('click', async () => {
    const q = document.getElementById('resQuarter').value;
    const y = document.getElementById('resYear').value;
    const resArea = document.getElementById('resultsDisplayArea');
    resArea.innerHTML = "Đang tải dữ liệu...";

    try {
        const qSnap = await getDocs(query(collection(db, "DaiHocHaiPhong_BoPhieu"), where("quy", "==", q), where("nam", "==", y)));
        if(qSnap.empty) { resArea.innerHTML = "<p>Không có dữ liệu bỏ phiếu cho Quý/Năm này.</p>"; return; }
        
        const tally = {}; 
        let totalVotes = 0;
        
        qSnap.forEach(doc => {
            totalVotes++;
            const data = doc.data();
            (data.details || []).forEach(d => {
                if(!tally[d.staffId]) tally[d.staffId] = { name: d.staffName, dept: d.department, HTXSNV: 0, HTTNV: 0, HTNV: 0, KHTNV: 0, "Tín nhiệm": 0, "Không tín nhiệm": 0 };
                if (tally[d.staffId][d.vote] !== undefined) tally[d.staffId][d.vote]++;
            });
        });

        let html = `<p>Tổng số phiếu đã thu trong <strong>Quý ${q} - Năm ${y}</strong>: <strong>${totalVotes} phiếu</strong></p>`;
        html += `<table class="criteria-table" id="exportTable"><thead><tr><th>Đơn vị</th><th>Họ tên</th><th>HTXSNV</th><th>HTTNV</th><th>HTNV</th><th>KHTNV</th><th>Tín nhiệm</th><th>Không TN</th></tr></thead><tbody>`;
        
        const depts = [...new Set(Object.values(tally).map(t => t.dept))].sort();
        depts.forEach(deptName => {
            html += `<tr class="dept-row"><td colspan="8">${deptName}</td></tr>`;
            Object.values(tally).filter(t => t.dept === deptName).forEach(t => {
                html += `<tr><td></td><td class="text-left"><strong>${t.name}</strong></td><td>${t.HTXSNV}</td><td>${t.HTTNV}</td><td>${t.HTNV}</td><td>${t.KHTNV}</td><td>${t["Tín nhiệm"]}</td><td>${t["Không tín nhiệm"]}</td></tr>`;
            });
        });
        html += `</tbody></table>`;

        if (userRole === 'admin' || userRole === 'superadmin') {
            html += `<h4 style="margin-top: 30px; color: #0056b3; border-bottom: 2px solid #ccc; padding-bottom: 10px;">Lịch sử Bỏ phiếu Chi tiết (Chỉ Admin mới thấy)</h4>`;
            if (totalVotes === 0) {
                html += `<p>Chưa có dữ liệu bỏ phiếu chi tiết.</p>`;
            } else {
                html += `<table class="criteria-table" style="font-size: 13px; margin-top:15px;">
                    <thead><tr><th width="15%">Thời gian nộp</th><th width="20%">Người bỏ phiếu</th><th width="15%">Loại phiếu</th><th>Chi tiết lựa chọn</th></tr></thead><tbody>`;
                qSnap.forEach(doc => {
                    const data = doc.data();
                    const timeStr = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate().toLocaleString('vi-VN') : 'Không rõ';
                    let detailsStr = `<div style="max-height: 120px; overflow-y: auto; text-align: left; padding: 5px;">`;
                    (data.details || []).forEach(d => {
                        let color = d.vote.includes("Không") ? "red" : (d.vote.includes("Xuất sắc") || d.vote === "Tín nhiệm" ? "green" : "black");
                        detailsStr += `<div><b>${d.staffName}</b>: <span style="color:${color}">${d.vote}</span></div>`;
                    });
                    detailsStr += `</div>`;
                    html += `<tr><td>${timeStr}</td><td><strong>${data.voter}</strong></td><td>${data.voteType === 'xeploai' ? 'Xếp loại' : 'Tín nhiệm'}</td><td>${detailsStr}</td></tr>`;
                });
                html += `</tbody></table>`;
            }
        }

        resArea.innerHTML = html;
    } catch(e) { handleFirebaseError(e); }
});

document.getElementById('exportResultsBtn')?.addEventListener('click', () => {
    const table = document.getElementById('exportTable');
    if(!table) return alert("Vui lòng Bấm 'Tải Kết quả' trước khi xuất!");
    let csv = []; const rows = table.querySelectorAll("tr");
    for (let i = 0; i < rows.length; i++) { let row = [], cols = rows[i].querySelectorAll("td, th"); for (let j = 0; j < cols.length; j++) row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"'); csv.push(row.join(",")); }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF"+csv.join("\n")], {type: "text/csv;charset=utf-8;"}));
    link.download = `KetQuaBoPhieu_Q${document.getElementById('resQuarter').value}_${document.getElementById('resYear').value}.csv`; link.click();
});

// Chức năng Backup (Tạo sẵn 1 dòng để Test)
document.getElementById('seedDataBtn').addEventListener('click', async () => {
    if(!confirm("Khôi phục sẽ thêm 1 khoa mẫu vào cuối cùng. Bạn đã xóa Collection trên Firebase chưa?")) return;
    try {
        await setDoc(doc(db, "DaiHocHaiPhong_NhanSu", "dept_" + Date.now()), { department: "Mẫu - Phòng A", members: [{ id: "nv_1", name: "Nguyễn Văn Mẫu", email:"", score: "", proposed: "", criteriaScores: {} }], headEmail: "" });
        alert("Khôi phục mẫu xong!");
    } catch(e) { handleFirebaseError(e); }
});