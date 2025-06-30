// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyBR4IGzdox96Xb05g7g1f0jUAXbq1ogsU0",
    authDomain: "ontop-powerlink.firebaseapp.com", 
    databaseURL: "https://ontop-powerlink-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ontop-powerlink",
    storageBucket: "ontop-powerlink.firebasestorage.app",
    messagingSenderId: "897362733868",
    appId: "1:897362733868:web:99b189b7dd32b8b8431a89",
    measurementId: "G-G7YWY27W8E"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 구글 시트 API URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwA1hBxi_PMAvRnDMvm4o3NpTmcmSSuS5qAR3GHLrqwRyhSACVpVn3IJ0dOI6e1nwNLfQ/exec';

// 전역 변수
let selectedOrder = '';
let currentTurn = '';
let people = {};
let editingOrderIndex = -1;

// DOM 요소
const addOrderBtn = document.getElementById('addOrderBtn');
const manageOrderBtn = document.getElementById('manageOrderBtn');
const orderGrid = document.getElementById('orderGrid');
const saveBtn = document.getElementById('saveBtn');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const currentTurnElement = document.getElementById('currentTurn');

// 폼 요소
const customerNameInput = document.getElementById('customerName');
const phoneNumberInput = document.getElementById('phoneNumber');
const planNameInput = document.getElementById('planName');
const openDateInput = document.getElementById('openDate');

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 앱 초기화
function initializeApp() {
    setTodayDate();
    loadFormData();
    bindEvents();
    setupFirebaseListeners();
}

// 오늘 날짜 설정
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    openDateInput.value = today;
}

// Firebase 리스너 설정
function setupFirebaseListeners() {
    // 사람 목록 리스너
    database.ref('people').on('value', (snapshot) => {
        people = snapshot.val() || {};
        renderOrderGrid();
    });

    // 현재 차례 리스너
    database.ref('currentTurn').on('value', (snapshot) => {
        currentTurn = snapshot.val() || '';
        updateCurrentTurnDisplay();
        renderOrderGrid();
    });

    // 선택된 사람 리스너
    database.ref('selectedPerson').on('value', (snapshot) => {
        const newSelectedOrder = snapshot.val() || '';
        if (newSelectedOrder !== selectedOrder) {
            selectedOrder = newSelectedOrder;
            saveFormData();
            renderOrderGrid();
        }
    });
}

// 현재 차례 표시 업데이트
function updateCurrentTurnDisplay() {
    if (currentTurn) {
        currentTurnElement.textContent = `현재 순번: ${currentTurn}`;
    } else {
        currentTurnElement.textContent = '현재 순번: -';
    }
}

// 폼 데이터 로드
function loadFormData() {
    const formData = localStorage.getItem('powerlink_form_data');
    if (formData) {
        const data = JSON.parse(formData);
        customerNameInput.value = data.customerName || '';
        phoneNumberInput.value = data.phoneNumber || '';
        planNameInput.value = data.planName || '';
        openDateInput.value = data.openDate || new Date().toISOString().split('T')[0];
    }
}

// 폼 데이터 저장
function saveFormData() {
    const formData = {
        customerName: customerNameInput.value,
        phoneNumber: phoneNumberInput.value,
        planName: planNameInput.value,
        openDate: openDateInput.value,
        selectedOrder: selectedOrder
    };
    localStorage.setItem('powerlink_form_data', JSON.stringify(formData));
}

// 이벤트 바인딩
function bindEvents() {
    // 순번 추가 버튼
    addOrderBtn.addEventListener('click', showAddOrderModal);
    
    // 순번 관리 버튼
    manageOrderBtn.addEventListener('click', showManageOrderModal);
    
    // 저장 버튼
    saveBtn.addEventListener('click', handleSave);
    
    // 모달 닫기
    closeModal.addEventListener('click', hideModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            hideModal();
        }
    });
    
    // 폼 입력 시 자동 저장
    [customerNameInput, phoneNumberInput, planNameInput, openDateInput].forEach(input => {
        input.addEventListener('input', saveFormData);
    });

    // 전화번호 자동 포맷팅
    phoneNumberInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/[^0-9]/g, '');
        
        if (value.length <= 3) {
            e.target.value = value;
        } else if (value.length <= 7) {
            e.target.value = value.replace(/(\d{3})(\d{1,4})/, '$1-$2');
        } else if (value.length <= 11) {
            e.target.value = value.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
        } else {
            e.target.value = value.replace(/(\d{3})(\d{1,4})(\d{1,4}).*/, '$1-$2-$3');
        }
    });

    // 키보드 단축키
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            hideModal();
        }
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            handleSave();
        }
    });
}

// 순번 그리드 렌더링
function renderOrderGrid() {
    orderGrid.innerHTML = '';
    
    // 사람 목록을 순서대로 정렬
    const sortedPeople = Object.entries(people).sort((a, b) => a[1].order - b[1].order);
    
    // 기존 사람들 버튼 생성
    sortedPeople.forEach(([name, data]) => {
        const button = document.createElement('button');
        button.className = 'order-btn';
        button.dataset.name = name;
        
        // 현재 차례인지 확인
        if (name === currentTurn) {
            button.classList.add('current-turn');
        }
        
        // 선택된 상태인지 확인
        if (name === selectedOrder) {
            button.classList.add('selected');
        }
        
        button.innerHTML = `
            <div class="name">${name}</div>
            <div class="count">${data.count || 0}건 완료</div>
        `;
        
        button.addEventListener('click', () => selectOrder(name));
        orderGrid.appendChild(button);
    });
    
    // 빈 슬롯에 "순번 추가" 버튼 추가 (2열 그리드에서 홀수 개일 때)
    if (sortedPeople.length % 2 === 1) {
        const addButton = document.createElement('button');
        addButton.className = 'order-btn add-new';
        addButton.innerHTML = '순번 추가';
        addButton.addEventListener('click', showAddOrderModal);
        orderGrid.appendChild(addButton);
    }
    
    // 아무도 없으면 안내 메시지
    if (sortedPeople.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = '순번 추가 버튼을 눌러 담당자를 추가해주세요';
        orderGrid.appendChild(emptyMessage);
    }
}

// 순번 선택
function selectOrder(orderName) {
    if (selectedOrder === orderName) {
        selectedOrder = '';
    } else {
        selectedOrder = orderName;
    }
    
    // Firebase에 선택 상태 업데이트
    database.ref('selectedPerson').set(selectedOrder);
    
    saveFormData();
    showToast(`${orderName} ${selectedOrder ? '선택됨' : '선택 해제됨'}`);
}

// 순번 추가 모달 표시
function showAddOrderModal() {
    modalTitle.textContent = '순번 추가';
    modalBody.innerHTML = `
        <input type="text" class="modal-input" id="orderNameInput" placeholder="담당자 이름을 입력하세요" maxlength="10">
        <div style="text-align: right; margin-top: 15px;">
            <button class="modal-btn" onclick="addOrder()">추가</button>
        </div>
    `;
    
    showModal();
    
    setTimeout(() => {
        document.getElementById('orderNameInput').focus();
    }, 100);
    
    document.getElementById('orderNameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addOrder();
        }
    });
}

// 순번 추가
async function addOrder() {
    const input = document.getElementById('orderNameInput');
    const name = input.value.trim();
    
    if (!name) {
        showToast('이름을 입력해주세요');
        return;
    }
    
    if (people[name]) {
        showToast('이미 존재하는 이름입니다');
        return;
    }
    
    try {
        const newOrder = Object.keys(people).length + 1;
        
        // Firebase에 새 사람 추가
        await database.ref(`people/${name}`).set({
            count: 0,
            available: true,
            order: newOrder
        });
        
        // 첫 번째 사람이면 현재 차례로 설정
        if (newOrder === 1) {
            await database.ref('currentTurn').set(name);
        }
        
        hideModal();
        showToast(`${name} 추가됨`);
    } catch (error) {
        console.error('순번 추가 오류:', error);
        showToast('순번 추가 중 오류가 발생했습니다');
    }
}

// 순번 관리 모달 표시
function showManageOrderModal() {
    const peopleList = Object.keys(people);
    
    if (peopleList.length === 0) {
        showToast('관리할 순번이 없습니다');
        return;
    }
    
    modalTitle.textContent = '순번 관리';
    
    let html = '<div class="order-list">';
    peopleList.sort((a, b) => people[a].order - people[b].order).forEach((name, index) => {
        html += `
            <div class="order-item">
                <span class="order-item-name">${name} (${people[name].count || 0}건)</span>
                <div class="order-item-actions">
                    <button class="edit-btn" onclick="editOrder('${name}')">수정</button>
                    <button class="delete-btn" onclick="deleteOrder('${name}')">삭제</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    modalBody.innerHTML = html;
    showModal();
}

// 순번 수정
function editOrder(name) {
    modalTitle.textContent = '순번 수정';
    modalBody.innerHTML = `
        <input type="text" class="modal-input" id="editOrderNameInput" value="${name}" maxlength="10">
        <div style="text-align: right; margin-top: 15px;">
            <button class="modal-btn" onclick="updateOrder('${name}')">수정</button>
            <button class="modal-btn" onclick="showManageOrderModal()">취소</button>
        </div>
    `;
    
    setTimeout(() => {
        const input = document.getElementById('editOrderNameInput');
        input.focus();
        input.select();
    }, 100);
    
    document.getElementById('editOrderNameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            updateOrder(name);
        }
    });
}

// 순번 업데이트
async function updateOrder(oldName) {
    const input = document.getElementById('editOrderNameInput');
    const newName = input.value.trim();
    
    if (!newName) {
        showToast('이름을 입력해주세요');
        return;
    }
    
    if (newName !== oldName && people[newName]) {
        showToast('이미 존재하는 이름입니다');
        return;
    }
    
    if (newName === oldName) {
        showManageOrderModal();
        return;
    }
    
    try {
        const oldData = people[oldName];
        
        // 새 이름으로 데이터 추가
        await database.ref(`people/${newName}`).set(oldData);
        
        // 기존 이름 삭제
        await database.ref(`people/${oldName}`).remove();
        
        // 현재 차례와 선택된 사람 업데이트
        if (currentTurn === oldName) {
            await database.ref('currentTurn').set(newName);
        }
        if (selectedOrder === oldName) {
            selectedOrder = newName;
            await database.ref('selectedPerson').set(newName);
        }
        
        showManageOrderModal();
        showToast(`${oldName} → ${newName} 수정됨`);
    } catch (error) {
        console.error('순번 수정 오류:', error);
        showToast('순번 수정 중 오류가 발생했습니다');
    }
}

// 순번 삭제
async function deleteOrder(name) {
    if (!confirm(`${name}을(를) 삭제하시겠습니까?`)) {
        return;
    }
    
    try {
        // Firebase에서 삭제
        await database.ref(`people/${name}`).remove();
        
        // 선택된 순번이 삭제되는 경우
        if (selectedOrder === name) {
            selectedOrder = '';
            await database.ref('selectedPerson').set('');
        }
        
        // 현재 차례가 삭제되는 경우 다음 사람으로 이동
        if (currentTurn === name) {
            const remainingPeople = Object.keys(people).filter(p => p !== name);
            if (remainingPeople.length > 0) {
                const sortedRemaining = remainingPeople.sort((a, b) => people[a].order - people[b].order);
                await database.ref('currentTurn').set(sortedRemaining[0]);
            } else {
                await database.ref('currentTurn').set('');
            }
        }
        
        showManageOrderModal();
        showToast(`${name} 삭제됨`);
    } catch (error) {
        console.error('순번 삭제 오류:', error);
        showToast('순번 삭제 중 오류가 발생했습니다');
    }
}

// 저장 처리
async function handleSave() {
    if (!validateForm()) {
        return;
    }
    
    const data = {
        순번담당자: selectedOrder,
        고객명: customerNameInput.value.trim(),
        전화번호: phoneNumberInput.value.trim(),
        요금제: planNameInput.value.trim(),
        개통날짜: openDateInput.value,
        등록시간: new Date().toLocaleString('ko-KR')
    };
    
    try {
        // Firebase에 저장
        await database.ref('activations').push(data);
        
        // 개통량 카운트 증가
        if (people[selectedOrder]) {
            const newCount = (people[selectedOrder].count || 0) + 1;
            await database.ref(`people/${selectedOrder}/count`).set(newCount);
        }
        
        // 현재 차례인 사람이 저장하면 다음 순번으로 이동
        if (selectedOrder === currentTurn) {
            await moveToNextTurn();
        }
        
        // 구글 시트에도 저장
        await sendToGoogleSheets(data);
        
        // 로컬 스토리지에 저장 기록 보관
        saveToHistory(data);
        
        // 폼 초기화
        resetForm();
        
    } catch (error) {
        console.error('저장 오류:', error);
        showToast('저장 중 오류가 발생했습니다');
    }
}

// 다음 순번으로 이동
async function moveToNextTurn() {
    const peopleList = Object.keys(people).sort((a, b) => people[a].order - people[b].order);
    const currentIndex = peopleList.indexOf(currentTurn);
    
    if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % peopleList.length;
        const nextPerson = peopleList[nextIndex];
        await database.ref('currentTurn').set(nextPerson);
    }
}

// 폼 유효성 검사
function validateForm() {
    if (!selectedOrder) {
        showToast('개통순번을 선택해주세요');
        return false;
    }
    
    if (!customerNameInput.value.trim()) {
        showToast('고객명을 입력해주세요');
        customerNameInput.focus();
        return false;
    }
    
    if (!phoneNumberInput.value.trim()) {
        showToast('전화번호를 입력해주세요');
        phoneNumberInput.focus();
        return false;
    }
    
    if (!openDateInput.value) {
        showToast('개통날짜를 선택해주세요');
        openDateInput.focus();
        return false;
    }
    
    return true;
}

// 저장 기록 보관
function saveToHistory(data) {
    let history = localStorage.getItem('powerlink_history');
    history = history ? JSON.parse(history) : [];
    
    history.unshift(data);
    
    if (history.length > 100) {
        history = history.slice(0, 100);
    }
    
    localStorage.setItem('powerlink_history', JSON.stringify(history));
}

// 폼 초기화
function resetForm() {
    customerNameInput.value = '';
    phoneNumberInput.value = '';
    planNameInput.value = '';
    setTodayDate();
    selectedOrder = '';
    
    // Firebase에 선택 해제 업데이트
    database.ref('selectedPerson').set('');
    
    saveFormData();
}

// 구글 시트 연동 함수
async function sendToGoogleSheets(data) {
    try {
        saveBtn.textContent = '저장 중...';
        saveBtn.disabled = true;
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        showToast('구글 시트에 저장되었습니다!');
        
    } catch (error) {
        console.error('구글 시트 저장 오류:', error);
        showToast('구글 시트 저장 중 오류가 발생했습니다');
    } finally {
        saveBtn.textContent = '저장하기';
        saveBtn.disabled = false;
    }
}

// 모달 표시
function showModal() {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// 모달 숨기기
function hideModal() {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    editingOrderIndex = -1;
}

// 토스트 메시지 표시
function showToast(message) {
    toastMessage.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// 페이지 이탈 시 확인
window.addEventListener('beforeunload', function(e) {
    const hasUnsavedData = customerNameInput.value.trim() || 
                          phoneNumberInput.value.trim() || 
                          planNameInput.value.trim() || 
                          selectedOrder;
    
    if (hasUnsavedData) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// 개발용 함수들
window.debugFunctions = {
    getStoredData: () => {
        return {
            formData: JSON.parse(localStorage.getItem('powerlink_form_data') || '{}'),
            history: JSON.parse(localStorage.getItem('powerlink_history') || '[]'),
            firebasePeople: people,
            currentTurn: currentTurn,
            selectedOrder: selectedOrder
        };
    },
    
    clearAllData: () => {
        localStorage.removeItem('powerlink_form_data');
        localStorage.removeItem('powerlink_history');
        // Firebase 데이터는 수동으로 삭제해야 함
        showToast('로컬 데이터 초기화됨');
    },
    
    resetFirebase: async () => {
        if (confirm('Firebase 데이터를 모두 초기화하시겠습니까?')) {
            await database.ref().set({});
            showToast('Firebase 데이터 초기화됨');
        }
    }
}; 