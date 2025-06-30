// 전역 변수
let orderList = [];
let selectedOrder = '';
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
    loadOrderList();
    loadFormData();
    setTodayDate();
    renderOrderGrid();
    bindEvents();
}

// 오늘 날짜 설정
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    openDateInput.value = today;
}

// 로컬 스토리지에서 순번 목록 로드
function loadOrderList() {
    const saved = localStorage.getItem('powerlink_orders');
    if (saved) {
        orderList = JSON.parse(saved);
    }
}

// 순번 목록 저장
function saveOrderList() {
    localStorage.setItem('powerlink_orders', JSON.stringify(orderList));
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
        selectedOrder = data.selectedOrder || '';
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
}

// 순번 그리드 렌더링
function renderOrderGrid() {
    orderGrid.innerHTML = '';
    
    // 추가된 순번만큼만 버튼 생성
    for (let i = 0; i < orderList.length; i++) {
        const button = document.createElement('button');
        button.className = 'order-btn';
        button.textContent = orderList[i];
        button.dataset.order = orderList[i];
        button.addEventListener('click', () => selectOrder(orderList[i]));
        
        if (selectedOrder === orderList[i]) {
            button.classList.add('selected');
        }
        
        orderGrid.appendChild(button);
    }
    
    // 순번이 없으면 안내 메시지 표시
    if (orderList.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = '순번 추가 버튼을 눌러 담당자를 추가해주세요';
        orderGrid.appendChild(emptyMessage);
    }
}

// 순번 선택
function selectOrder(orderName) {
    selectedOrder = orderName;
    saveFormData();
    renderOrderGrid();
    showToast(`${orderName} 선택됨`);
}

// 순번 추가 모달 표시
function showAddOrderModal() {
    if (orderList.length >= 8) {
        showToast('최대 8개까지만 추가할 수 있습니다');
        return;
    }
    
    modalTitle.textContent = '순번 추가';
    modalBody.innerHTML = `
        <input type="text" class="modal-input" id="orderNameInput" placeholder="담당자 이름을 입력하세요" maxlength="10">
        <div style="text-align: right; margin-top: 15px;">
            <button class="modal-btn" onclick="addOrder()">추가</button>
        </div>
    `;
    
    showModal();
    
    // 입력 필드에 포커스
    setTimeout(() => {
        document.getElementById('orderNameInput').focus();
    }, 100);
    
    // 엔터 키 처리
    document.getElementById('orderNameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addOrder();
        }
    });
}

// 순번 추가
function addOrder() {
    const input = document.getElementById('orderNameInput');
    const name = input.value.trim();
    
    if (!name) {
        showToast('이름을 입력해주세요');
        return;
    }
    
    if (orderList.includes(name)) {
        showToast('이미 존재하는 이름입니다');
        return;
    }
    
    orderList.push(name);
    saveOrderList();
    renderOrderGrid();
    hideModal();
    showToast(`${name} 추가됨`);
}

// 순번 관리 모달 표시
function showManageOrderModal() {
    if (orderList.length === 0) {
        showToast('관리할 순번이 없습니다');
        return;
    }
    
    modalTitle.textContent = '순번 관리';
    
    let html = '<div class="order-list">';
    orderList.forEach((order, index) => {
        html += `
            <div class="order-item">
                <span class="order-item-name">${order}</span>
                <div class="order-item-actions">
                    <button class="edit-btn" onclick="editOrder(${index})">수정</button>
                    <button class="delete-btn" onclick="deleteOrder(${index})">삭제</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    modalBody.innerHTML = html;
    showModal();
}

// 순번 수정
function editOrder(index) {
    editingOrderIndex = index;
    const currentName = orderList[index];
    
    modalTitle.textContent = '순번 수정';
    modalBody.innerHTML = `
        <input type="text" class="modal-input" id="editOrderNameInput" value="${currentName}" maxlength="10">
        <div style="text-align: right; margin-top: 15px;">
            <button class="modal-btn" onclick="updateOrder()">수정</button>
            <button class="modal-btn" onclick="showManageOrderModal()">취소</button>
        </div>
    `;
    
    // 입력 필드에 포커스
    setTimeout(() => {
        const input = document.getElementById('editOrderNameInput');
        input.focus();
        input.select();
    }, 100);
    
    // 엔터 키 처리
    document.getElementById('editOrderNameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            updateOrder();
        }
    });
}

// 순번 업데이트
function updateOrder() {
    const input = document.getElementById('editOrderNameInput');
    const newName = input.value.trim();
    const oldName = orderList[editingOrderIndex];
    
    if (!newName) {
        showToast('이름을 입력해주세요');
        return;
    }
    
    if (newName !== oldName && orderList.includes(newName)) {
        showToast('이미 존재하는 이름입니다');
        return;
    }
    
    // 선택된 순번 업데이트
    if (selectedOrder === oldName) {
        selectedOrder = newName;
        saveFormData();
    }
    
    orderList[editingOrderIndex] = newName;
    saveOrderList();
    renderOrderGrid();
    showManageOrderModal();
    showToast(`${oldName} → ${newName} 수정됨`);
}

// 순번 삭제
function deleteOrder(index) {
    const orderName = orderList[index];
    
    if (confirm(`${orderName}을(를) 삭제하시겠습니까?`)) {
        // 선택된 순번이 삭제되는 경우 선택 해제
        if (selectedOrder === orderName) {
            selectedOrder = '';
            saveFormData();
        }
        
        orderList.splice(index, 1);
        saveOrderList();
        renderOrderGrid();
        showManageOrderModal();
        showToast(`${orderName} 삭제됨`);
    }
}

// 저장 처리
function handleSave() {
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
    
    // 구글 시트 연동을 위한 데이터 준비
    console.log('저장할 데이터:', data);
    
    // 여기에 실제 구글 시트 API 호출 코드 추가 예정
    // sendToGoogleSheets(data);
    
    // 임시로 로컬 스토리지에 저장 기록 보관
    saveToHistory(data);
    
    // 폼 초기화
    resetForm();
    
    showToast('저장되었습니다!');
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
    
    // 최대 100개 기록만 보관
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
    
    saveFormData();
    renderOrderGrid();
}

// 구글 시트 연동 함수 (추후 구현)
async function sendToGoogleSheets(data) {
    try {
        // 실제 구글 시트 API 엔드포인트로 변경 필요
        const response = await fetch('YOUR_GOOGLE_SHEETS_API_ENDPOINT', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('저장 실패');
        }
        
        showToast('구글 시트에 저장되었습니다!');
    } catch (error) {
        console.error('저장 오류:', error);
        showToast('저장 중 오류가 발생했습니다');
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
    // ESC 키로 모달 닫기
    if (e.key === 'Escape' && modal.style.display === 'flex') {
        hideModal();
    }
    
    // Ctrl + S로 저장
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
    }
});

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

// 개발용 함수들 (콘솔에서 사용 가능)
window.debugFunctions = {
    // 저장된 데이터 확인
    getStoredData: () => {
        return {
            orders: JSON.parse(localStorage.getItem('powerlink_orders') || '[]'),
            formData: JSON.parse(localStorage.getItem('powerlink_form_data') || '{}'),
            history: JSON.parse(localStorage.getItem('powerlink_history') || '[]')
        };
    },
    
    // 데이터 초기화
    clearAllData: () => {
        localStorage.removeItem('powerlink_orders');
        localStorage.removeItem('powerlink_form_data');
        localStorage.removeItem('powerlink_history');
        location.reload();
    },
    
    // 샘플 데이터 생성
    generateSampleData: () => {
        orderList = ['김철수', '이영희', '박민수', '정유진'];
        saveOrderList();
        renderOrderGrid();
        showToast('샘플 데이터 생성됨');
    }
}; 