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
let activations = {};
let editingOrderIndex = -1;
let currentPeriod = 'today'; // 기본값: 일간

// DOM 요소
const addOrderBtn = document.getElementById('addOrderBtn');
const manageOrderBtn = document.getElementById('manageOrderBtn');
const countManageBtn = document.getElementById('countManageBtn');
const orderGrid = document.getElementById('orderGrid');
const saveBtn = document.getElementById('saveBtn');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const currentTurnElement = document.getElementById('currentTurn');
const statsDropdown = document.getElementById('statsDropdown');
const dropdownBtn = document.getElementById('dropdownBtn');
const dropdownContent = document.getElementById('dropdownContent');
const todayCountElement = document.getElementById('todayCount');
const weekCountElement = document.getElementById('weekCount');
const monthCountElement = document.getElementById('monthCount');

// 폼 요소
const customerNameInput = document.getElementById('customerName');
const activationNumberInput = document.getElementById('activationNumber');
const contactNumberInput = document.getElementById('contactNumber');
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
    updateDropdownStats(); // 초기 통계 표시
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
        const oldPeople = JSON.stringify(people);
        people = snapshot.val() || {};
        const newPeople = JSON.stringify(people);
        
        if (oldPeople !== newPeople) {
            console.log('People 데이터 업데이트:', people);
        }
        renderOrderGrid();
    });

    // 현재 차례 리스너
    database.ref('currentTurn').on('value', (snapshot) => {
        const oldTurn = currentTurn;
        currentTurn = snapshot.val() || '';
        
        if (oldTurn !== currentTurn) {
            console.log(`현재 차례 변경: ${oldTurn} -> ${currentTurn}`);
        }
        updateCurrentTurnDisplay();
        renderOrderGrid();
    });

    // 선택된 사람 리스너
    database.ref('selectedPerson').on('value', (snapshot) => {
        const newSelectedOrder = snapshot.val() || '';
        if (newSelectedOrder !== selectedOrder) {
            console.log(`선택된 순번 변경: ${selectedOrder} -> ${newSelectedOrder}`);
            selectedOrder = newSelectedOrder;
            saveFormData();
            renderOrderGrid();
        }
    });

    // 개통 기록 리스너
    database.ref('activations').on('value', (snapshot) => {
        const oldActivations = Object.keys(activations).length;
        activations = snapshot.val() || {};
        const newActivations = Object.keys(activations).length;
        
        if (oldActivations !== newActivations) {
            console.log(`Activations 데이터 업데이트: ${oldActivations}건 -> ${newActivations}건`);
        }
        renderOrderGrid(); // 카운트 업데이트를 위해 그리드 새로고침
        updateDropdownStats(); // 드롭다운 통계 업데이트
    });
}

// 현재 차례 표시 업데이트
function updateCurrentTurnDisplay() {
    if (currentTurn) {
        currentTurnElement.textContent = `현재순번: ${currentTurn}`;
    } else {
        currentTurnElement.textContent = '현재순번: -';
    }
}

// 선택된 기간의 개인별 카운트 가져오기 (실제 기록 기반)
function getPersonCount(personName, period) {
    const stats = calculateStats();
    const count = stats[period].people[personName] || 0;
    
    // 상세 디버깅 정보
    const debugInfo = {
        person: personName,
        period: period,
        count: count,
        totalStats: stats[period],
        activationsTotal: Object.keys(activations).length
    };
    
    console.log(`getPersonCount 결과:`, debugInfo);
    return count;
}

// 실시간 개통 카운트 계산 (activations 기반)
function getRealTimePersonCount(personName) {
    let count = 0;
    Object.values(activations).forEach(record => {
        if (record.순번담당자 === personName) {
            count++;
        }
    });
    console.log(`${personName} 실시간 총 카운트:`, count);
    return count;
}

// 드롭다운 통계 업데이트
function updateDropdownStats() {
    const stats = calculateStats();
    todayCountElement.textContent = `${stats.today.total}건`;
    weekCountElement.textContent = `${stats.week.total}건`;
    monthCountElement.textContent = `${stats.month.total}건`;
    
    // 기간 정보 업데이트
    updatePeriodInfo();
}

// 현재 선택된 기간의 날짜 범위 계산
function getCurrentPeriodRange() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (currentPeriod === 'today') {
        return {
            start: today,
            end: today,
            label: '오늘'
        };
    } else if (currentPeriod === 'week') {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6); // 7일 전부터
        const weekEnd = new Date(today); // 오늘까지
        
        return {
            start: weekStart,
            end: weekEnd,
            label: '최근 7일'
        };
    } else if (currentPeriod === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        return {
            start: monthStart,
            end: monthEnd,
            label: '이번달'
        };
    }
}

// 기간 정보 표시 업데이트
function updatePeriodInfo() {
    const periodInfoElement = document.getElementById('periodInfo');
    if (!periodInfoElement) return;
    
    const range = getCurrentPeriodRange();
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    let periodText = '';
    if (currentPeriod === 'today') {
        periodText = `📅 ${formatDate(range.start)} (${range.label})`;
    } else {
        periodText = `📅 ${formatDate(range.start)} ~ ${formatDate(range.end)} (${range.label})`;
    }
    
    const stats = calculateStats();
    const totalCount = stats[currentPeriod].total;
    
    periodInfoElement.innerHTML = `
        <div class="period-text">${periodText}</div>
        <div class="period-total">전체 ${totalCount}건</div>
    `;
}

// 폼 데이터 로드
function loadFormData() {
    const formData = localStorage.getItem('powerlink_form_data');
    if (formData) {
        const data = JSON.parse(formData);
        customerNameInput.value = data.customerName || '';
        activationNumberInput.value = data.activationNumber || '';
        contactNumberInput.value = data.contactNumber || data.phoneNumber || ''; // 기존 데이터 호환
        planNameInput.value = data.planName || '';
        openDateInput.value = data.openDate || new Date().toISOString().split('T')[0];
    }
}

// 폼 데이터 저장
function saveFormData() {
    const formData = {
        customerName: customerNameInput.value,
        activationNumber: activationNumberInput.value,
        contactNumber: contactNumberInput.value,
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
    
    // 카운트 관리 버튼
    countManageBtn.addEventListener('click', showCountManageModal);
    
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
    [customerNameInput, activationNumberInput, contactNumberInput, planNameInput, openDateInput].forEach(input => {
        input.addEventListener('input', saveFormData);
    });

    // 연락번호 자동 포맷팅
    contactNumberInput.addEventListener('input', function(e) {
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

    // 드롭다운 토글 이벤트
    dropdownBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdownContent.classList.toggle('show');
        updateDropdownStats();
    });

    // 드롭다운 항목 클릭 이벤트
    dropdownContent.addEventListener('click', function(e) {
        e.stopPropagation();
        const item = e.target.closest('.dropdown-item');
        if (item) {
            const period = item.dataset.period;
            if (period && period !== currentPeriod) {
                currentPeriod = period;
                renderOrderGrid();
                updatePeriodInfo(); // 기간 정보 업데이트
                dropdownContent.classList.remove('show');
                
                const periodText = period === 'today' ? '일간' : 
                                 period === 'week' ? '최근7일' : '월간';
                showToast(`${periodText} 통계로 변경됨`);
            }
        }
    });

    // 드롭다운 외부 클릭 시 닫기
    document.addEventListener('click', function() {
        dropdownContent.classList.remove('show');
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
        
        // 선택된 상태인지 확인 (선택 버그 수정)
        if (name === selectedOrder) {
            button.classList.add('selected');
        }
        
        // 선택된 기간에 맞는 카운트 표시 (실제 기록 기반)
        const periodCount = getPersonCount(name, currentPeriod);
        const totalCount = getRealTimePersonCount(name);
        const periodText = currentPeriod === 'today' ? '일간' : 
                          currentPeriod === 'week' ? '최근7일' : '월간';
        
        console.log(`${name} 카운트 표시:`, {
            period: currentPeriod,
            periodCount: periodCount,
            totalCount: totalCount
        });
        
        button.innerHTML = `
            <div class="name">${name}</div>
            <div class="count">${periodText} ${periodCount}건 (총 ${totalCount}건)</div>
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

// 순번 선택 (선택 버그 수정)
function selectOrder(orderName) {
    const wasSelected = selectedOrder === orderName;
    
    if (wasSelected) {
        selectedOrder = '';
        showToast(`${orderName} 선택 해제됨`);
    } else {
        selectedOrder = orderName;
        showToast(`${orderName} 선택됨`);
    }
    
    // Firebase에 선택 상태 업데이트
    database.ref('selectedPerson').set(selectedOrder);
    
    // 즉시 UI 업데이트 (선택 버그 수정)
    renderOrderGrid();
    
    saveFormData();
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
    
    let html = `
        <div class="turn-management">
            <h4>🎯 현재 차례 관리</h4>
            <div class="current-turn-section">
                <div class="current-turn-info">
                    현재 차례: <strong style="color: #03C75A;">${currentTurn || '없음'}</strong>
                </div>
                <div class="turn-actions">
                    <button class="change-turn-btn" onclick="showChangeTurnModal()">차례 변경</button>
                    <button class="reset-turn-btn" onclick="resetCurrentTurn()">처음부터</button>
                </div>
            </div>
        </div>
        <div class="order-list">
    `;
    
    peopleList.sort((a, b) => people[a].order - people[b].order).forEach((name, index) => {
        const isCurrent = name === currentTurn;
        const realCount = getRealTimePersonCount(name);
        const firebaseCount = people[name].count || 0;
        
        html += `
            <div class="order-item ${isCurrent ? 'current-person' : ''}">
                <span class="order-item-name">
                    ${name} (실제: ${realCount}건${firebaseCount !== realCount ? `, FB: ${firebaseCount}` : ''}) ${isCurrent ? '👑' : ''}
                </span>
                <div class="order-item-actions">
                    <button class="turn-btn ${isCurrent ? 'current' : ''}" onclick="setCurrentTurn('${name}')" ${isCurrent ? 'disabled' : ''}>
                        ${isCurrent ? '현재차례' : '차례설정'}
                    </button>
                    <button class="count-btn" onclick="editCount('${name}')">카운트</button>
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

// 카운트 수정 (실제 기록 기반 표시)
function editCount(name) {
    const firebaseCount = people[name].count || 0;
    const realCount = getRealTimePersonCount(name);
    
    modalTitle.textContent = '카운트 관리';
    modalBody.innerHTML = `
        <div class="count-info">
            <h4>${name}의 개통 현황</h4>
            <div class="count-comparison">
                <div class="count-item">
                    <span class="count-label">📊 실제 기록 기반:</span>
                    <span class="count-value real">${realCount}건</span>
                </div>
                <div class="count-item">
                    <span class="count-label">🔥 Firebase 카운트:</span>
                    <span class="count-value firebase">${firebaseCount}건</span>
                </div>
                ${realCount !== firebaseCount ? `
                <div class="count-mismatch">
                    ⚠️ 불일치 발견! 차이: ${realCount - firebaseCount}건
                </div>
                ` : `
                <div class="count-match">
                    ✅ 데이터 일치
                </div>
                `}
            </div>
        </div>
        
        <div class="count-actions">
            <h4>관리 옵션</h4>
            <button class="sync-btn" onclick="syncFirebaseCount('${name}')">
                Firebase 카운트를 실제 기록으로 동기화
            </button>
            <input type="number" class="modal-input" id="editCountInput" value="${firebaseCount}" min="0" max="999" placeholder="직접 수정">
            <button class="manual-update-btn" onclick="updateCount('${name}')">Firebase 카운트 직접 수정</button>
        </div>
        
        <div style="text-align: right; margin-top: 15px;">
            <button class="modal-btn" onclick="showManageOrderModal()">닫기</button>
        </div>
    `;
    
    setTimeout(() => {
        const input = document.getElementById('editCountInput');
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                updateCount(name);
            }
        });
    }, 100);
}

// Firebase 카운트 동기화 (실제 기록 기준)
async function syncFirebaseCount(name) {
    const realCount = getRealTimePersonCount(name);
    
    if (!confirm(`${name}의 Firebase 카운트를 실제 기록(${realCount}건)으로 동기화하시겠습니까?`)) {
        return;
    }
    
    try {
        await database.ref(`people/${name}/count`).set(realCount);
        showManageOrderModal();
        showToast(`${name}의 Firebase 카운트가 ${realCount}건으로 동기화되었습니다`);
    } catch (error) {
        console.error('카운트 동기화 오류:', error);
        showToast('카운트 동기화 중 오류가 발생했습니다');
    }
}

// Firebase 카운트 직접 수정
async function updateCount(name) {
    const input = document.getElementById('editCountInput');
    const newCount = parseInt(input.value) || 0;
    const realCount = getRealTimePersonCount(name);
    
    if (newCount < 0) {
        showToast('카운트는 0 이상이어야 합니다');
        return;
    }
    
    const confirmMsg = newCount !== realCount ? 
        `⚠️ 주의: 실제 기록(${realCount}건)과 다른 값(${newCount}건)으로 설정하시겠습니까?\n데이터 불일치가 발생할 수 있습니다.` :
        `${name}의 Firebase 카운트를 ${newCount}건으로 설정하시겠습니까?`;
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    try {
        await database.ref(`people/${name}/count`).set(newCount);
        showManageOrderModal();
        showToast(`${name}의 Firebase 카운트가 ${newCount}건으로 수정되었습니다`);
    } catch (error) {
        console.error('카운트 수정 오류:', error);
        showToast('카운트 수정 중 오류가 발생했습니다');
    }
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

// 현재 차례 설정
async function setCurrentTurn(name) {
    try {
        console.log(`현재 차례 변경: ${currentTurn} -> ${name}`);
        await database.ref('currentTurn').set(name);
        showManageOrderModal();
        showToast(`현재 차례가 ${name}로 변경되었습니다`);
    } catch (error) {
        console.error('차례 변경 오류:', error);
        showToast('차례 변경 중 오류가 발생했습니다');
    }
}

// 차례 변경 모달
function showChangeTurnModal() {
    modalTitle.textContent = '차례 변경';
    
    const peopleList = Object.keys(people).sort((a, b) => people[a].order - people[b].order);
    
    let html = `
        <div class="change-turn-section">
            <h4>누구 차례로 변경하시겠습니까?</h4>
            <div class="turn-select-list">
    `;
    
    peopleList.forEach((name) => {
        const isCurrent = name === currentTurn;
        html += `
            <button class="turn-select-btn ${isCurrent ? 'current' : ''}" 
                    onclick="setCurrentTurn('${name}')" 
                    ${isCurrent ? 'disabled' : ''}>
                <span class="turn-name">${name}</span>
                <span class="turn-status">${isCurrent ? '현재 차례' : '차례 설정'}</span>
            </button>
        `;
    });
    
    html += `
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <button class="modal-btn" onclick="showManageOrderModal()">취소</button>
            </div>
        </div>
    `;
    
    modalBody.innerHTML = html;
}

// 차례 초기화 (첫 번째 사람으로)
async function resetCurrentTurn() {
    const peopleList = Object.keys(people).sort((a, b) => people[a].order - people[b].order);
    
    if (peopleList.length === 0) {
        showToast('순번이 없습니다');
        return;
    }
    
    const firstPerson = peopleList[0];
    
    if (!confirm(`차례를 처음부터 시작하시겠습니까?\n(${firstPerson}부터 시작)`)) {
        return;
    }
    
    try {
        console.log(`차례 초기화: ${currentTurn} -> ${firstPerson}`);
        await database.ref('currentTurn').set(firstPerson);
        showManageOrderModal();
        showToast(`차례가 초기화되었습니다 (${firstPerson}부터 시작)`);
    } catch (error) {
        console.error('차례 초기화 오류:', error);
        showToast('차례 초기화 중 오류가 발생했습니다');
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
        개통번호: activationNumberInput.value.trim(),
        연락번호: contactNumberInput.value.trim(),
        요금제: planNameInput.value.trim(),
        개통날짜: openDateInput.value,
        등록시간: new Date().toLocaleString('ko-KR')
    };
    
    try {
        console.log('저장 시작:', data);
        console.log('선택된 순번:', selectedOrder);
        console.log('현재 people 데이터:', people);
        
        // Firebase에 저장
        await database.ref('activations').push(data);
        console.log('activations 저장 완료');
        
        // 개통 기록 저장 완료 (카운트는 실시간 계산)
        console.log('개통 기록 저장 완료');
        
        // 실시간 카운트 확인 및 표시
        const realTimeCount = getRealTimePersonCount(selectedOrder);
        showToast(`${selectedOrder} 개통 완료! (총 ${realTimeCount}건)`);
        
        console.log(`${selectedOrder} 실시간 카운트: ${realTimeCount}`);
        
        // 현재 차례인 사람이 저장하면 다음 순번으로 이동
        if (selectedOrder === currentTurn) {
            console.log('다음 순번으로 이동');
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
        showToast('저장 중 오류가 발생했습니다: ' + error.message);
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
    
    if (!activationNumberInput.value.trim()) {
        showToast('개통번호를 입력해주세요');
        activationNumberInput.focus();
        return false;
    }
    
    if (!contactNumberInput.value.trim()) {
        showToast('연락번호를 입력해주세요');
        contactNumberInput.focus();
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
    activationNumberInput.value = '';
    contactNumberInput.value = '';
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
        
        // 구글 시트에 정확한 순서로 저장하기 위해 배열로 변환
        const orderedData = [
            data.순번담당자,
            data.고객명,
            data.개통번호,
            data.연락번호,
            data.요금제,
            data.개통날짜,
            data.등록시간
        ];
        
        console.log('구글 시트 전송 데이터 (순서 보장):', orderedData);
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderedData)
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
                          activationNumberInput.value.trim() ||
                          contactNumberInput.value.trim() || 
                          planNameInput.value.trim() || 
                          selectedOrder;
    
    if (hasUnsavedData) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// 개발자 도구 디버깅 함수 (전역)
window.debug = {
    // 현재 상태 확인
    getStatus: () => {
        return {
            people: people,
            currentTurn: currentTurn,
            selectedOrder: selectedOrder,
            activations: activations,
            currentPeriod: currentPeriod,
            activationsCount: Object.keys(activations).length
        };
    },
    
    // 통계 확인
    getStats: () => {
        return calculateStats();
    },
    
    // Firebase 연결 상태 확인
    getFirebaseStatus: () => {
        return {
            isConnected: firebase.database().ref('.info/connected'),
            databaseURL: firebase.app().options.databaseURL
        };
    },
    
    // 특정 사람 데이터 확인
    getPerson: (name) => {
        return people[name];
    },
    
    // 카운트 강제 재계산
    recalculateCount: (name) => {
        const stats = calculateStats();
        console.log(`${name} 카운트:`, {
            firebase: people[name]?.count || 0,
            calculated: {
                today: stats.today.people[name] || 0,
                week: stats.week.people[name] || 0,
                month: stats.month.people[name] || 0
            }
        });
    },
    
    // 모든 사람 카운트 비교 (실제 vs Firebase)
    compareAllCounts: () => {
        const stats = calculateStats();
        console.log('=== 카운트 비교 (실제 기록 vs Firebase) ===');
        Object.keys(people).forEach(name => {
            const realCount = getRealTimePersonCount(name);
            const firebaseCount = people[name]?.count || 0;
            const match = realCount === firebaseCount ? '✅' : '❌';
            
            console.log(`${match} ${name}:`, {
                실제총카운트: realCount,
                Firebase카운트: firebaseCount,
                차이: realCount - firebaseCount,
                기간별실제: {
                    today: stats.today.people[name] || 0,
                    week: stats.week.people[name] || 0,
                    month: stats.month.people[name] || 0
                }
            });
        });
    },
    
    // 순번 관련 디버깅
    getTurnInfo: () => {
        const sorted = Object.keys(people).sort((a, b) => people[a].order - people[b].order);
        return {
            currentTurn: currentTurn,
            selectedOrder: selectedOrder, 
            peopleOrder: sorted,
            currentIndex: sorted.indexOf(currentTurn)
        };
    },
    
    // 카운트 강제 수정 (테스트용)
    forceSetCount: async (name, count) => {
        if (!people[name]) {
            console.error('존재하지 않는 사람:', name);
            return;
        }
        await database.ref(`people/${name}/count`).set(count);
        console.log(`${name}의 카운트를 ${count}로 강제 설정했습니다.`);
    },
    
    // 차례 강제 변경 (테스트용)
    forceSetTurn: async (name) => {
        if (!people[name]) {
            console.error('존재하지 않는 사람:', name);
            return;
        }
        await database.ref('currentTurn').set(name);
        console.log(`현재 차례를 ${name}로 강제 설정했습니다.`);
    }
};

console.log('🔧 디버깅 도구가 준비되었습니다!');
console.log('사용법:');
console.log('- debug.getStatus() : 현재 상태 확인');
console.log('- debug.getStats() : 통계 확인');
console.log('- debug.getPerson("이름") : 특정 사람 데이터 확인');
console.log('- debug.compareAllCounts() : 실제 vs Firebase 카운트 비교');
console.log('- debug.getTurnInfo() : 순번 정보 확인');
console.log('- debug.forceSetCount("이름", 숫자) : 카운트 강제 설정');
console.log('- debug.forceSetTurn("이름") : 차례 강제 변경');
console.log('');
console.log('💡 새로운 카운트 시스템:');
console.log('- 실제 개통 기록(activations) 기반으로 정확한 카운트');
console.log('- Firebase people.count는 참고용 (불일치 가능)');
console.log('- 등록시간 기준으로 일간/최근7일/월간 자동 계산');

// 카운트 관리 모달 표시
function showCountManageModal() {
    modalTitle.textContent = '카운트 관리';
    
    const peopleList = Object.keys(people);
    if (peopleList.length === 0) {
        modalBody.innerHTML = '<div style="text-align: center; color: #888;">순번이 없습니다.</div>';
        showModal();
        return;
    }

    const stats = calculateStats();
    
    let html = `
        <div class="count-stats">
            <div class="stats-period">
                <h4>📊 기간별 개통 통계</h4>
                <div class="stats-row">
                    <span>오늘</span>
                    <span>${stats.today.total}건</span>
                </div>
                <div class="stats-row">
                    <span>최근 7일</span>
                    <span>${stats.week.total}건</span>
                </div>
                <div class="stats-row">
                    <span>이번 달</span>
                    <span>${stats.month.total}건</span>
                </div>
            </div>
            
            <div class="stats-personal">
                <h4>👥 개인별 통계</h4>
                <div class="stats-tabs">
                    <button class="stats-tab active" onclick="showStatsTab('today')">일간</button>
                    <button class="stats-tab" onclick="showStatsTab('week')">최근7일</button>
                    <button class="stats-tab" onclick="showStatsTab('month')">월간</button>
                </div>
                <div id="statsContent" class="stats-content">
                    <!-- 동적으로 생성 -->
                </div>
            </div>
            
            <div class="reset-actions">
                <h4>🔧 관리 기능</h4>
                <div class="reset-buttons">
                    <button class="reset-all-btn" onclick="resetAllCounts()">
                        모든 카운트 초기화
                    </button>
                    <button class="danger-btn" onclick="clearAllActivations()">
                        모든 기록 삭제 (위험)
                    </button>
                </div>
                <div class="reset-info">
                    ※ 카운트 초기화는 Firebase people.count만 0으로 설정합니다.<br>
                    ※ 기록 삭제는 모든 activations 데이터를 완전히 삭제합니다.
                </div>
            </div>
        </div>
    `;
    
    modalBody.innerHTML = html;
    showModal();
    showStatsTab('today');
}

// 통계 계산
function calculateStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 주간: 오늘부터 7일 전까지 (오늘 포함)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6); // 7일 전 (오늘 포함하면 총 7일)
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const stats = {
        today: { total: 0, people: {} },
        week: { total: 0, people: {} },
        month: { total: 0, people: {} }
    };
    
    // 각 사람별 초기화
    Object.keys(people).forEach(name => {
        stats.today.people[name] = 0;
        stats.week.people[name] = 0;
        stats.month.people[name] = 0;
    });
    
    // 개통 기록 분석
    const recordsProcessed = {
        total: 0,
        today: 0,
        week: 0,
        month: 0,
        errors: 0
    };
    
    Object.values(activations).forEach(record => {
        recordsProcessed.total++;
        
        const recordDate = parseKoreanDate(record.등록시간);
        if (!recordDate) {
            recordsProcessed.errors++;
            console.warn('날짜 파싱 실패:', record.등록시간);
            return;
        }
        
        const personName = record.순번담당자;
        
        // 오늘
        if (recordDate >= today) {
            stats.today.total++;
            recordsProcessed.today++;
            if (stats.today.people[personName] !== undefined) {
                stats.today.people[personName]++;
            }
        }
        
        // 최근 7일
        if (recordDate >= weekStart) {
            stats.week.total++;
            recordsProcessed.week++;
            if (stats.week.people[personName] !== undefined) {
                stats.week.people[personName]++;
            }
        }
        
        // 이번 달
        if (recordDate >= monthStart) {
            stats.month.total++;
            recordsProcessed.month++;
            if (stats.month.people[personName] !== undefined) {
                stats.month.people[personName]++;
            }
        }
    });
    
    console.log('calculateStats 처리 결과:', {
        오늘: `${today.toDateString()}`,
        최근7일시작: `${weekStart.toDateString()}`,
        이번달시작: `${monthStart.toDateString()}`,
        처리된기록: recordsProcessed,
        최종통계: {
            today: stats.today.total,
            week: stats.week.total,
            month: stats.month.total
        }
    });
    
    return stats;
}

// 한국어 날짜 파싱
function parseKoreanDate(dateString) {
    try {
        // "2024-01-15 오후 2:30:45" 형태를 파싱
        const match = dateString.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s*(오전|오후)?\s*(\d{1,2}):(\d{1,2}):(\d{1,2})/);
        if (match) {
            const [, year, month, day, meridiem, hour, minute, second] = match;
            let hour24 = parseInt(hour);
            
            if (meridiem === '오후' && hour24 !== 12) {
                hour24 += 12;
            } else if (meridiem === '오전' && hour24 === 12) {
                hour24 = 0;
            }
            
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour24, parseInt(minute), parseInt(second));
        }
        
        // 일반적인 날짜 형태도 시도
        return new Date(dateString);
    } catch (error) {
        console.error('날짜 파싱 오류:', dateString, error);
        return null;
    }
}

// 통계 탭 표시
function showStatsTab(period) {
    // 탭 활성화
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    const stats = calculateStats();
    const periodStats = stats[period];
    
    let html = '';
    const sortedPeople = Object.entries(periodStats.people)
        .sort(([,a], [,b]) => b - a)
        .filter(([name]) => people[name]); // 현재 존재하는 사람만
    
    sortedPeople.forEach(([name, count]) => {
        html += `
            <div class="stats-person">
                <div class="stats-person-info">
                    <span class="stats-person-name">${name}</span>
                    <span class="stats-person-count">${count}건</span>
                </div>
                <button class="stats-reset-btn" onclick="resetPersonCount('${name}')">초기화</button>
            </div>
        `;
    });
    
    if (html === '') {
        html = '<div style="text-align: center; color: #888; padding: 20px;">기록이 없습니다.</div>';
    }
    
    document.getElementById('statsContent').innerHTML = html;
}

// 개인별 카운트 초기화 (강화된 버전)
async function resetPersonCount(name) {
    const confirmMessage = `${name}의 카운트를 0으로 초기화하시겠습니까?\n\n※ 주의: Firebase people.count 값만 초기화됩니다.\n실제 개통 기록(activations)은 유지됩니다.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        console.log(`카운트 초기화 시작: ${name}`);
        console.log('초기화 전 people 데이터:', people[name]);
        
        await database.ref(`people/${name}/count`).set(0);
        console.log('카운트 초기화 완료');
        
        showToast(`${name}의 카운트가 초기화되었습니다`);
        
        // 모달 새로고침
        showCountManageModal();
    } catch (error) {
        console.error('카운트 초기화 오류:', error);
        showToast('카운트 초기화 중 오류가 발생했습니다: ' + error.message);
    }
}

// 전체 카운트 초기화 함수 추가
async function resetAllCounts() {
    const confirmMessage = `모든 순번의 카운트를 0으로 초기화하시겠습니까?\n\n※ 주의: Firebase people.count 값들만 초기화됩니다.\n실제 개통 기록(activations)은 유지됩니다.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        console.log('전체 카운트 초기화 시작');
        const peopleList = Object.keys(people);
        
        for (const name of peopleList) {
            await database.ref(`people/${name}/count`).set(0);
            console.log(`${name} 카운트 초기화 완료`);
        }
        
        showToast(`모든 순번 카운트가 초기화되었습니다 (${peopleList.length}명)`);
        showCountManageModal();
    } catch (error) {
        console.error('전체 카운트 초기화 오류:', error);
        showToast('전체 카운트 초기화 중 오류가 발생했습니다: ' + error.message);
    }
}

// 개통 기록 완전 삭제 함수 추가  
async function clearAllActivations() {
    const confirmMessage = `모든 개통 기록을 완전히 삭제하시겠습니까?\n\n※ 위험: 이 작업은 되돌릴 수 없습니다!\n- Firebase activations 데이터 완전 삭제\n- 모든 people.count 초기화\n- 통계 데이터 모두 사라짐`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    const doubleConfirm = confirm('정말로 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다!');
    if (!doubleConfirm) {
        return;
    }
    
    try {
        console.log('모든 개통 기록 삭제 시작');
        
        // activations 완전 삭제
        await database.ref('activations').remove();
        console.log('activations 삭제 완료');
        
        // 모든 people count 초기화
        const peopleList = Object.keys(people);
        for (const name of peopleList) {
            await database.ref(`people/${name}/count`).set(0);
        }
        console.log('모든 카운트 초기화 완료');
        
        showToast(`모든 개통 기록이 삭제되었습니다`);
        showCountManageModal();
    } catch (error) {
        console.error('개통 기록 삭제 오류:', error);
        showToast('개통 기록 삭제 중 오류가 발생했습니다: ' + error.message);
    }
} 