// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyCNjGhWVguIWBAHyyLfTapsF_5Bp6ztRG0", // Keep your actual API key secure
    authDomain: "safewayos2.firebaseapp.com",
    projectId: "safewayos2",
    storageBucket: "safewayos2.appspot.com",
    messagingSenderId: "216681158749",
    appId: "1:216681158749:web:35de32f542ad71fa7295b4"
};

// --- Cloud Function URLs ---
const GENERATE_TRIP_SHEETS_URL = 'https://generate-trip-sheets-216681158749.us-central1.run.app';
const ASK_DANIEL_URL = 'https://ask-daniel-216681158749.us-central1.run.app';

// --- Global State ---
let allJobsData = [];
let allTechniciansData = [];
let inventoryItemsData = [];
let currentTripSheets = [];
let currentView = 'dashboard';
let conversationHistory = [];
let currentTripSheetListener = null;
let workerJobsListener = null; // Listener for the worker's specific jobs

// --- DOM Elements ---
const jobsTableBody = document.getElementById('jobsTableBody');
const jobsTable = document.getElementById('jobsTable');
const technicianCardsContainer = document.getElementById('technician-cards-container');
const navLinks = document.querySelectorAll('.nav-link');
const contentSections = document.querySelectorAll('.content-section');

const editTechModal = document.getElementById('editTechnicianModal');
const closeEditTechModalBtn = document.getElementById('closeEditTechModal');
const cancelEditTechBtn = document.getElementById('cancelEditTech');
const editTechForm = document.getElementById('editTechForm');

const scheduleJobModal = document.getElementById('scheduleJobModal');
const closeScheduleJobModalBtn = document.getElementById('closeScheduleJobModal');
const cancelScheduleJobBtn = document.getElementById('cancelScheduleJob');
const scheduleJobForm = document.getElementById('scheduleJobForm');

const generateTripSheetsBtn = document.getElementById('generateTripSheetsBtn');
const scheduleStatus = document.getElementById('scheduleStatus');
const tripSheetsContainer = document.getElementById('trip-sheets-container');
const tripSheetDateInput = document.getElementById('tripSheetDate');
const tripSheetApprovalContainer = document.getElementById('tripSheetApprovalContainer');
const approveTripSheetsBtn = document.getElementById('approveTripSheetsBtn');

const addJobModal = document.getElementById('addJobModal');
const openAddJobModalButton = document.getElementById('openAddJobModalButton');
const closeAddJobModalButton = document.getElementById('closeAddJobModal');
const cancelAddJobButton = document.getElementById('cancelAddJob');
const newJobForm = document.getElementById('newJobForm');

const inventoryTableBody = document.getElementById('inventoryTableBody');
const inventoryTotalSKUs = document.getElementById('inventoryTotalSKUs');
const inventoryLowStockItems = document.getElementById('inventoryLowStockItems');
const inventoryEstValue = document.getElementById('inventoryEstValue');

const addPartModal = document.getElementById('addPartModal');
const openAddPartModalButton = document.getElementById('openAddPartModalButton');
const closeAddPartModalButton = document.getElementById('closeAddPartModal');
const cancelAddPartButton = document.getElementById('cancelAddPart');
const newPartForm = document.getElementById('newPartForm');
const savePartButton = document.getElementById('savePartButton');

const logPartUsageModal = document.getElementById('logPartUsageModal');
const openLogPartUsageButton = document.getElementById('logPartUsageButton');
const closeLogPartUsageModalButton = document.getElementById('closeLogPartUsageModal');
const cancelLogPartUsageButton = document.getElementById('cancelLogPartUsage');
const logPartUsageForm = document.getElementById('logPartUsageForm');
const usageTechnicianSelect = document.getElementById('usageTechnician');
const inventoryPartsDatalist = document.getElementById('inventoryPartsList');

const dashboardUnscheduledJobsEl = document.getElementById('dashboardUnscheduledJobs');
const dashboardScheduledJobsEl = document.getElementById('dashboardScheduledJobs');
const dashboardTotalJobsEl = document.getElementById('dashboardTotalJobs');
const dashboardLifetimeTripSheetsEl = document.getElementById('dashboardLifetimeTripSheets');
const dashboardLatestJobsListEl = document.getElementById('dashboardLatestJobsList');

const chatLog = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
const sendChatButton = document.getElementById('sendChatButton');

// --- Worker PWA DOM Elements ---
const workerPwaView = document.getElementById('workerPwaView');
const workerNameEl = document.getElementById('workerName');
const workerCurrentDateEl = document.getElementById('workerCurrentDate');
const workerTodaysRouteEl = document.getElementById('workerTodaysRoute');
const workerLogoutBtn = document.getElementById('workerLogoutBtn');


// --- Render Functions ---
function renderJobs(jobs) {
    allJobsData = jobs;
    if (!jobsTableBody || !jobsTable) return;

    jobsTable.classList.remove('hidden');
    jobsTableBody.innerHTML = '';

    if (jobs.length === 0) {
        jobsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-slate-500 py-4">No jobs found. Waiting for new emails...</td></tr>`;
        return;
    }

    const sortedJobs = [...jobs].sort((a, b) => {
        const dateA = a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
    });
    jobsTableBody.innerHTML = sortedJobs.map(job => {
        let statusText = job.status || 'Needs Scheduling';
        let statusClass = 'status-needs-scheduling';

        if (statusText === 'Scheduled') {
            statusClass = 'status-scheduled';
            if (job.scheduledDate && job.timeSlot) {
                statusText = `Scheduled: ${job.scheduledDate} (${job.timeSlot})`;
            }
        } else if (statusText === 'Awaiting completion') {
            statusClass = 'status-awaiting-completion';
        } else if (statusText === 'Completed') {
            statusClass = 'status-completed';
        }
        return `
            <tr>
                <td class="font-medium text-slate-800">${job.customer || 'N/A'}</td>
                <td>${job.address || 'N/A'}</td>
                <td>${job.issue || 'N/A'}</td>
                <td>${job.phone || 'N/A'}</td>
                <td><span class="status-pill ${statusClass}">${statusText}</span></td>
                <td><button class="btn-secondary-stitch schedule-job-btn" data-id="${job.id}">View/Schedule</button></td>
            </tr>
        `;
    }).join('');
}

function renderTechnicians(technicians) {
    allTechniciansData = technicians;
    if (!technicianCardsContainer) return;
    technicianCardsContainer.innerHTML = technicians.map(tech => {
        const statusClass = tech.status === 'Online' ? 'status-online' : 'status-offline';
        const avatarChar = tech.name ? tech.name.charAt(0).toUpperCase() : 'T';
        const avatarColor = tech.status === 'Online' ? '059669' : '64748b';

        return `
        <div class="stat-card-stitch">
            <div class="flex items-center mb-2">
                <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 border-2 border-white shadow-sm mr-3" style='background-image: url("https://placehold.co/50x50/${avatarColor}/FFFFFF?text=${avatarChar}");'></div>
                <div>
                    <h4 class="text-slate-800 text-lg font-semibold">${tech.name}</h4>
                    <p class="text-sm text-slate-500">Lead Technician</p>
                </div>
            </div>
            <p class="text-sm text-slate-600 truncate"><span class="material-icons-outlined text-sm text-green-600 vm">location_on</span> ${tech.currentLocation || 'Not set'}</p>
            <p class="text-sm text-slate-600"><span class="material-icons-outlined text-sm text-green-600 vm">speed</span> Capacity: ${tech.maxJobs} jobs/day</p>
            <div class="mt-2 flex items-center justify-between">
                <span class="status-pill ${statusClass}">${tech.status}</span>
                <button class="btn-secondary-stitch manage-tech-btn" data-id="${tech.id}">Manage</button>
            </div>
        </div>
        `;
    }).join('');
}

function renderTripSheets(tripSheets, date) {
    currentTripSheets = tripSheets;
    if (!tripSheetsContainer) return;

    const displayDate = date ? new Date(date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : "the selected date";

    if (!tripSheets || tripSheets.length === 0) {
        tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-slate-400"><span class="material-icons-outlined text-4xl">calendar_today</span><p>No trip sheets have been generated for ${displayDate}.</p></div>`;
        tripSheetApprovalContainer.classList.add('hidden');
        return;
    }

    let html = '';
    let isAnyJobNotApproved = false;

    const jobIdsInSheets = new Set(tripSheets.flatMap(sheet => sheet.route.map(job => job.id)));
    const liveJobs = allJobsData.filter(job => jobIdsInSheets.has(job.id));

    liveJobs.forEach(job => {
        if (job.status === 'Scheduled') {
            isAnyJobNotApproved = true;
        }
    });

    tripSheets.forEach(sheet => {
        const avatarChar = sheet.technicianName ? sheet.technicianName.charAt(0).toUpperCase() : 'T';
        html += `
        <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 class="font-semibold text-green-700 text-md mb-2 flex items-center">
                <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-8 border-2 border-white shadow-sm mr-2" style='background-image: url("https://placehold.co/40x40/059669/FFFFFF?text=${avatarChar}");'></div>
                ${sheet.technicianName}'s Route
            </h4>
            <ol class="list-decimal list-inside text-sm text-slate-700 space-y-2 pl-2">
                ${sheet.route.map(job => `
                    <li>
                        <span class="font-semibold">${job.timeSlot}</span> - ${job.address}
                        <br>
                        <span class="text-xs text-slate-600">(${job.customer} - ${job.issue})</span>
                    </li>
                `).join('')}
            </ol>
        </div>
        `;
    });
    tripSheetsContainer.innerHTML = html;

    if (isAnyJobNotApproved) {
        tripSheetApprovalContainer.classList.remove('hidden');
        approveTripSheetsBtn.disabled = false;
        approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined">check_circle</span>Approve Trip Sheets`;
    } else {
        tripSheetApprovalContainer.classList.remove('hidden');
        approveTripSheetsBtn.disabled = true;
        approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined">check_circle_outline</span>Sheets Approved`;
    }
}

function renderInventory(items) {
    inventoryItemsData = items;
    if (!inventoryTableBody) return;

    if (inventoryTotalSKUs) inventoryTotalSKUs.textContent = items.length;

    let lowStockCount = 0;
    let totalValue = 0;
    items.forEach(item => {
        if (item.currentStock < item.reorderLevel) {
            lowStockCount++;
        }
        totalValue += (item.currentStock * (item.unitCost || 0));
    });
    if (inventoryLowStockItems) inventoryLowStockItems.textContent = lowStockCount;
    if (inventoryEstValue) inventoryEstValue.textContent = `$${totalValue.toFixed(2)}`;

    if (items.length === 0) {
        inventoryTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-slate-500 py-4">No inventory items found. Click "Add New Part" to get started.</td></tr>`;
    } else {
        inventoryTableBody.innerHTML = items.map(item => {
            let statusClass = 'status-instock';
            let statusText = 'In Stock';
            if (item.currentStock < item.reorderLevel) {
                statusClass = 'status-lowstock';
                statusText = 'Low Stock';
            }
            if (item.currentStock === 0) {
                statusText = 'Out of Stock';
            }
            return `
                <tr>
                    <td class="font-medium text-slate-800">${item.partName}</td>
                    <td>${item.sku}</td>
                    <td>${item.category || 'N/A'}</td>
                    <td>${item.currentStock}</td>
                    <td>${item.reorderLevel}</td>
                    <td>$${item.unitCost ? item.unitCost.toFixed(2) : '0.00'}</td>
                    <td>${item.supplier || 'N/A'}</td>
                    <td><span class="status-pill ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn-secondary-stitch text-xs edit-part-btn" data-id="${item.id}">Edit</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    if (inventoryPartsDatalist) {
        inventoryPartsDatalist.innerHTML = items.map(item => `<option value="${item.sku}">${item.partName}</option>`).join('');
    }
}

function populateTechnicianDropdowns() {
    if (!usageTechnicianSelect || !allTechniciansData) return;

    const currentSelection = usageTechnicianSelect.value;
    usageTechnicianSelect.innerHTML = '<option value="">Select Technician</option>';
    allTechniciansData.forEach(tech => {
        if (tech.status === 'Online') {
            const option = document.createElement('option');
            option.value = tech.id;
            option.textContent = tech.name;
            usageTechnicianSelect.appendChild(option);
        }
    });
    if (currentSelection && usageTechnicianSelect.querySelector(`option[value="${currentSelection}"]`)) {
        usageTechnicianSelect.value = currentSelection;
    }
}

function animateCountUp(element, targetValue, duration = 500) {
    if (!element) return;
    targetValue = Number(targetValue) || 0;

    const startValue = parseInt(element.textContent, 10) || 0;
    const startTime = performance.now();

    function updateCount(currentTime) {
        const elapsedTime = currentTime - startTime;
        if (elapsedTime >= duration) {
            element.textContent = targetValue;
            return;
        }
        const progress = elapsedTime / duration;
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (targetValue - startValue) * easedProgress);
        element.textContent = currentValue;
        requestAnimationFrame(updateCount);
    }
    requestAnimationFrame(updateCount);
}

function renderDashboardStats(jobs, tripSheets) {
    const unscheduledJobsCount = jobs.filter(j => j.status === 'Needs Scheduling').length;
    const scheduledJobsCount = jobs.filter(j => j.status === 'Scheduled' || j.status === 'Awaiting completion').length;
    const totalJobsCount = jobs.length;
    const totalTripSheetsCount = tripSheets.length;

    animateCountUp(dashboardUnscheduledJobsEl, unscheduledJobsCount);
    animateCountUp(dashboardScheduledJobsEl, scheduledJobsCount);
    animateCountUp(dashboardTotalJobsEl, totalJobsCount);
    animateCountUp(dashboardLifetimeTripSheetsEl, totalTripSheetsCount);

    const latestJobs = [...jobs].sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate()).slice(0, 5);
    if (dashboardLatestJobsListEl) {
        if (latestJobs.length === 0) {
            dashboardLatestJobsListEl.innerHTML = `<li class="p-3 text-slate-500">No jobs found yet.</li>`;
        } else {
            dashboardLatestJobsListEl.innerHTML = '';
            latestJobs.forEach((job, index) => {
                const issueSummary = job.issue ? job.issue.substring(0, 50) + (job.issue.length > 50 ? '...' : '') : 'No issue description';
                const customerName = job.customer || 'N/A';

                const listItem = document.createElement('li');
                listItem.className = 'latest-job-item p-3 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors';
                listItem.style.setProperty('--animation-delay', `${index * 0.07}s`);

                listItem.innerHTML = `
                    <p class="font-medium text-slate-700">${customerName} - <span class="text-sm text-slate-600">${issueSummary}</span></p>
                    <p class="text-xs text-slate-500">${job.address || 'No address'} - <span class="font-semibold">${job.status || 'N/A'}</span></p>
                `;
                dashboardLatestJobsListEl.appendChild(listItem);

                setTimeout(() => {
                    listItem.classList.add('latest-job-item-visible');
                }, 50);
            });
        }
    }
}

function renderWorkerPwaView(jobs, technicianName) {
    if (!workerPwaView || !workerNameEl || !workerCurrentDateEl || !workerTodaysRouteEl) return;

    workerNameEl.textContent = `Hello, ${technicianName}`;
    workerCurrentDateEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    if (jobs.length === 0) {
        workerTodaysRouteEl.innerHTML = `
            <div class="text-center p-8 text-slate-500">
                <span class="material-icons-outlined text-6xl">task_alt</span>
                <h3 class="text-xl font-bold mt-4">All Clear!</h3>
                <p>You have no jobs assigned for today.</p>
            </div>
        `;
        return;
    }

    const timeSlotOrder = { "8am to 2pm": 1, "9am to 4pm": 2, "12pm to 6pm": 3 };
    const sortedJobs = [...jobs].sort((a, b) => (timeSlotOrder[a.timeSlot] || 99) - (timeSlotOrder[b.timeSlot] || 99));

    workerTodaysRouteEl.innerHTML = sortedJobs.map(job => `
        <div class="flex items-center gap-4 bg-white px-4 min-h-[72px] py-3 justify-between border-b border-slate-100 cursor-pointer hover:bg-slate-50">
            <div class="flex items-center gap-4 overflow-hidden">
                <div class="text-[#111418] flex items-center justify-center rounded-lg bg-[#f0f2f5] shrink-0 size-12">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"></path></svg>
                </div>
                <div class="flex flex-col justify-center overflow-hidden">
                    <p class="text-[#111418] text-base font-medium leading-normal truncate">${job.timeSlot || 'Anytime'}</p>
                    <p class="text-[#60758a] text-sm font-normal leading-normal truncate">${job.address}</p>
                </div>
            </div>
            <div class="shrink-0">
                <div class="flex size-7 items-center justify-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M181.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L164.69,128,98.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,181.66,133.66Z"></path></svg>
                </div>
            </div>
        </div>
    `).join('');
}


// --- UI Navigation ---
function switchView(targetId) {
    contentSections.forEach(section => section.classList.add('hidden'));
    const activeSection = document.getElementById(targetId);
    if (activeSection) activeSection.classList.remove('hidden');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.target === targetId) {
            link.classList.add('active');
            currentView = targetId;
        }
    });

    if (targetId === 'schedule') {
        loadTripSheetsForDate(tripSheetDateInput.value);
    }
    if (targetId === 'daniel') {
        chatInput.focus();
    }
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(e.currentTarget.dataset.target);
    });
});

// --- Modal Logic ---
function openEditTechModal(tech) {
    if (!tech) return;
    document.getElementById('modalTechId').value = tech.id;
    document.getElementById('modalTechName').textContent = `Edit ${tech.name}`;
    document.getElementById('modalTechStatus').value = tech.status;
    document.getElementById('modalTechLocation').value = tech.currentLocation;
    document.getElementById('modalTechMaxJobs').value = tech.maxJobs;
    editTechModal.style.display = 'block';
}

function closeEditTechModal() {
    editTechModal.style.display = 'none';
    editTechForm.reset();
}

function openScheduleJobModal(job) {
    if (!job) return;
    document.getElementById('modalScheduleJobId').value = job.id;
    document.getElementById('modalScheduleCustomer').textContent = job.customer || 'N/A';
    document.getElementById('modalScheduleAddress').textContent = job.address || 'N/A';
    document.getElementById('modalScheduleIssue').textContent = job.issue || 'N/A';
    document.getElementById('modalScheduleWarrantyProvider').textContent = job.warrantyProvider || 'N/A';
    document.getElementById('modalSchedulePlanType').textContent = job.planType || 'N/A';
    document.getElementById('modalScheduleDispatchOrPoNumber').textContent = job.dispatchOrPoNumber || 'N/A';

    const dateInput = document.getElementById('modalJobDate');
    dateInput.value = job.scheduledDate || new Date().toISOString().split('T')[0];

    const timeSlotSelect = document.getElementById('modalJobTimeSlot');
    timeSlotSelect.value = job.timeSlot || "";

    scheduleJobModal.style.display = 'block';
}

function closeScheduleJobModal() {
    scheduleJobModal.style.display = 'none';
    scheduleJobForm.reset();
}

function openAddPartModal(item = null) {
    newPartForm.reset();
    const modalTitle = addPartModal.querySelector('.modal-header h2');
    const partEditIdField = document.getElementById('partEditId');

    if (item) { // Editing existing item
        modalTitle.textContent = 'Edit Inventory Part';
        savePartButton.textContent = 'Save Changes';
        partEditIdField.value = item.id;
        document.getElementById('partName').value = item.partName;
        document.getElementById('partSKU').value = item.sku;
        document.getElementById('partCategory').value = item.category || '';
        document.getElementById('partSupplier').value = item.supplier || '';
        document.getElementById('partStock').value = item.currentStock;
        document.getElementById('partReorderLevel').value = item.reorderLevel;
        document.getElementById('partUnitCost').value = item.unitCost;
        document.getElementById('partSKU').disabled = true;
    } else { // Adding new item
        modalTitle.textContent = 'Add New Inventory Part';
        savePartButton.textContent = 'Add Part';
        partEditIdField.value = '';
        document.getElementById('partSKU').disabled = false;
    }
    addPartModal.style.display = 'block';
}

function closeAddPartModal() {
    addPartModal.style.display = 'none';
    newPartForm.reset();
    document.getElementById('partSKU').disabled = false;
}

function openLogPartUsageModal() {
    logPartUsageForm.reset();
    logPartUsageModal.style.display = 'block';
}

function closeLogPartUsageModal() {
    logPartUsageModal.style.display = 'none';
    logPartUsageForm.reset();
}

// --- Firebase Logic ---
let db;
let auth;

async function initializeTechnicians() {
    const techCollection = firebase.firestore().collection('technicians');
    const snapshot = await techCollection.get();
    if (snapshot.empty) {
        const defaultTechnicians = [
            { name: 'Ibaidallah', status: 'Online', currentLocation: '1100 S Flower St, Los Angeles, CA 90015', maxJobs: 8 },
            { name: 'Khaled', status: 'Online', currentLocation: '4059 Van Nuys Blvd, Sherman Oaks, CA 91403', maxJobs: 5 },
            { name: 'Ahmed', status: 'Online', currentLocation: '189 The Grove Dr, Los Angeles, CA 90036', maxJobs: 5 },
            { name: 'Omar', status: 'Offline', currentLocation: 'Home Base', maxJobs: 5 }
        ];
        for (const tech of defaultTechnicians) {
            await firebase.firestore().collection('technicians').add(tech);
        }
    }
}

function listenForJobs() {
    const jobsQuery = firebase.firestore().collection("jobs").orderBy("createdAt", "desc");
    jobsQuery.onSnapshot((snapshot) => {
        allJobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (currentView === 'jobs') {
            renderJobs(allJobsData);
        }
        if (currentView === 'dashboard') {
            listenForDashboardData();
        }
        if (currentView === 'schedule') {
            loadTripSheetsForDate(tripSheetDateInput.value);
        }
    }, (error) => {
        console.error("Error listening for jobs:", error);
    });
}

function listenForTechnicians() {
    const techQuery = firebase.firestore().collection("technicians");
    techQuery.onSnapshot((snapshot) => {
        const technicians = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allTechniciansData = technicians;
        if (currentView === 'technicians') {
            renderTechnicians(technicians);
        }
        populateTechnicianDropdowns();
    }, (error) => console.error("Error listening for technicians:", error));
}

async function initializeInventory() {
    const inventoryCollection = firebase.firestore().collection('inventoryItems');
    const snapshot = await inventoryCollection.get();
    if (snapshot.empty) {
        console.log("Inventory collection is empty. No default items will be added.");
    }
}

function listenForInventoryItems() {
    const inventoryQuery = firebase.firestore().collection("inventoryItems").orderBy("createdAt", "desc");
    inventoryQuery.onSnapshot((snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        inventoryItemsData = items;
        if (currentView === 'inventory') {
            renderInventory(items);
        }
    }, (error) => console.error("Error listening for inventory items:", error));
}

function listenForDashboardData() {
    const tripSheetsQuery = firebase.firestore().collection("tripSheets");
    tripSheetsQuery.onSnapshot((snapshot) => {
        const tripSheets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboardStats(allJobsData, tripSheets);
    }, (error) => {
        console.error("Error listening for trip sheets for dashboard:", error);
    });
}

function listenForWorkerJobs(technicianId, technicianName) {
    if (workerJobsListener) {
        workerJobsListener(); // Detach any previous listener
    }
    const jobsQuery = firebase.firestore().collection("jobs")
        .where("assignedTechnicianId", "==", technicianId)
        .where("status", "==", "Awaiting completion");

    workerJobsListener = jobsQuery.onSnapshot((snapshot) => {
        const assignedJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderWorkerPwaView(assignedJobs, technicianName);
    }, (error) => {
        console.error(`Error listening for jobs for technician ${technicianId}:`, error);
        if (workerTodaysRouteEl) {
            workerTodaysRouteEl.innerHTML = `<div class="text-center p-8 text-red-500"><p>Error loading your jobs. Please try again later.</p></div>`;
        }
    });
}


// --- Form Submit Handlers & Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // This is the main entry point after the page loads.
    // All form listeners and event handlers that need DOM elements will be set up here.

    // Modal Close/Cancel Buttons
    if(closeEditTechModalBtn) closeEditTechModalBtn.addEventListener('click', closeEditTechModal);
    if(cancelEditTechBtn) cancelEditTechBtn.addEventListener('click', closeEditTechModal);
    if(closeScheduleJobModalBtn) closeScheduleJobModalBtn.addEventListener('click', closeScheduleJobModal);
    if(cancelScheduleJobBtn) cancelScheduleJobBtn.addEventListener('click', closeScheduleJobModal);
    if(closeAddJobModalButton) closeAddJobModalButton.addEventListener('click', () => addJobModal.style.display = 'none');
    if(cancelAddJobButton) cancelAddJobButton.addEventListener('click', () => addJobModal.style.display = 'none');
    if(closeAddPartModalButton) closeAddPartModalButton.addEventListener('click', closeAddPartModal);
    if(cancelAddPartButton) cancelAddPartButton.addEventListener('click', closeAddPartModal);
    if(closeLogPartUsageModalButton) closeLogPartUsageModalButton.addEventListener('click', closeLogPartUsageModal);
    if(cancelLogPartUsageButton) cancelLogPartUsageButton.addEventListener('click', closeLogPartUsageModal);
    
    // Modal Open Buttons
    if(openAddJobModalButton) openAddJobModalButton.addEventListener('click', () => {
        addJobModal.style.display = 'block';
        const saveJobButton = document.getElementById('saveJobButton');
        if(saveJobButton) {
            saveJobButton.disabled = false;
            saveJobButton.textContent = 'Save Job';
        }
        newJobForm.reset();
    });
    if(openAddPartModalButton) openAddPartModalButton.addEventListener('click', () => openAddPartModal());
    if(openLogPartUsageButton) openLogPartUsageButton.addEventListener('click', openLogPartUsageModal);

    // Form Submissions
    if(editTechForm) editTechForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const techId = document.getElementById('modalTechId').value;
        const techRef = firebase.firestore().doc(`technicians/${techId}`);
        const updatedData = {
            status: document.getElementById('modalTechStatus').value,
            currentLocation: document.getElementById('modalTechLocation').value,
            maxJobs: parseInt(document.getElementById('modalTechMaxJobs').value, 10)
        };
        try {
            await techRef.update(updatedData);
            closeEditTechModal();
        } catch (error) {
            console.error("Error updating technician:", error);
        }
    });

    if(scheduleJobForm) scheduleJobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const jobId = document.getElementById('modalScheduleJobId').value;
        const jobRef = firebase.firestore().doc(`jobs/${jobId}`);
        const updatedData = {
            status: 'Scheduled',
            scheduledDate: document.getElementById('modalJobDate').value,
            timeSlot: document.getElementById('modalJobTimeSlot').value
        };
        try {
            await jobRef.update(updatedData);
            closeScheduleJobModal();
        } catch (error) {
            console.error("Error scheduling job:", error);
        }
    });
    
    if(newJobForm) newJobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveJobButton = document.getElementById('saveJobButton');
        if (saveJobButton.disabled) return;
        saveJobButton.disabled = true;
        saveJobButton.textContent = 'Saving...';
        const jobData = {
            customer: document.getElementById('jobCustomer').value,
            address: document.getElementById('jobAddress').value,
            issue: document.getElementById('jobIssue').value,
            phone: document.getElementById('jobPhone').value,
            status: 'Needs Scheduling',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await firebase.firestore().collection('jobs').add(jobData);
            addJobModal.style.display = 'none';
            newJobForm.reset();
        } catch (error) {
            console.error("Error adding new job:", error);
            alert(`Error adding job: ${error.message}`);
        } finally {
            saveJobButton.disabled = false;
            saveJobButton.textContent = 'Save Job';
        }
    });
    
    if(newPartForm) newPartForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const partEditId = document.getElementById('partEditId').value;
        const partData = {
            partName: document.getElementById('partName').value,
            sku: document.getElementById('partSKU').value,
            category: document.getElementById('partCategory').value,
            supplier: document.getElementById('partSupplier').value,
            currentStock: parseInt(document.getElementById('partStock').value, 10),
            reorderLevel: parseInt(document.getElementById('partReorderLevel').value, 10),
            unitCost: parseFloat(document.getElementById('partUnitCost').value),
        };

        try {
            if (partEditId) {
                const partRef = firebase.firestore().doc(`inventoryItems/${partEditId}`);
                await partRef.update(partData);
            } else {
                const skuQuery = firebase.firestore().collection("inventoryItems").where("sku", "==", partData.sku);
                const skuSnapshot = await skuQuery.get();
                if (!skuSnapshot.empty) {
                    alert(`Error: SKU "${partData.sku}" already exists. Please use a unique SKU.`);
                    return;
                }
                partData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await firebase.firestore().collection('inventoryItems').add(partData);
            }
            closeAddPartModal();
        } catch (error) {
            console.error("Error saving part:", error);
            alert(`Error saving part: ${error.message}`);
        }
    });

    if(logPartUsageForm) logPartUsageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const skuToLog = document.getElementById('usagePartSKU').value;
        const quantityUsed = parseInt(document.getElementById('usageQuantity').value, 10);
        const technicianId = document.getElementById('usageTechnician').value;
        const jobId = document.getElementById('usageJobId').value;

        if (quantityUsed <= 0) {
            alert("Quantity used must be greater than zero.");
            return;
        }

        const itemToUpdate = inventoryItemsData.find(item => item.sku === skuToLog);

        if (!itemToUpdate) {
            alert(`Part with SKU "${skuToLog}" not found.`);
            return;
        }

        if (itemToUpdate.currentStock < quantityUsed) {
            alert(`Not enough stock for SKU "${skuToLog}". Available: ${itemToUpdate.currentStock}, Tried to use: ${quantityUsed}`);
            return;
        }
        
        const newStock = itemToUpdate.currentStock - quantityUsed;
        const partRef = firebase.firestore().doc(`inventoryItems/${itemToUpdate.id}`);

        try {
            await partRef.update({ currentStock: newStock });
            
            await firebase.firestore().collection('inventoryUsageLog').add({
                sku: skuToLog,
                partName: itemToUpdate.partName,
                quantityUsed: quantityUsed,
                technicianId: technicianId, 
                jobId: jobId || null,
                loggedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            closeLogPartUsageModal();
        } catch (error) {
            console.error("Error logging part usage:", error);
            alert(`Error logging part usage: ${error.message}`);
        }
    });

    // Event Delegation for dynamic buttons
    document.body.addEventListener('click', function(event) {
        if (event.target.classList.contains('manage-tech-btn')) {
            const techId = event.target.dataset.id;
            const techData = allTechniciansData.find(t => t.id === techId);
            if(techData) openEditTechModal(techData);
        }
        if (event.target.classList.contains('schedule-job-btn')) {
            const jobId = event.target.dataset.id;
            const jobData = allJobsData.find(j => j.id === jobId);
            if(jobData) openScheduleJobModal(jobData);
        }
        if (event.target.classList.contains('edit-part-btn')) {
            const partId = event.target.dataset.id;
            const partData = inventoryItemsData.find(p => p.id === partId);
            if(partData) openAddPartModal(partData); 
        }
    });
    
    // Close modals on outside click
    window.addEventListener('click', (event) => {
        if (event.target == editTechModal) closeEditTechModal();
        if (event.target == scheduleJobModal) closeScheduleJobModal();
        if (event.target == addPartModal) closeAddPartModal();
        if (event.target == logPartUsageModal) closeLogPartUsageModal();
        if (event.target == addJobModal) addJobModal.style.display = 'none';
    });

    // Logout Buttons
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                console.log("Admin user signed out successfully.");
            } catch (error) {
                console.error("Sign out error:", error);
            }
        });
    }
    if (workerLogoutBtn) {
        workerLogoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                console.log("Worker user signed out successfully.");
            } catch (error) {
                console.error("Sign out error:", error);
            }
        });
    }

    // Trip Sheet Logic
    if(generateTripSheetsBtn) generateTripSheetsBtn.addEventListener('click', async () => {
        const selectedDate = tripSheetDateInput.value;
        if (!selectedDate) {
            alert("Please select a date for the trip sheets.");
            tripSheetDateInput.focus();
            return;
        }

        generateTripSheetsBtn.disabled = true;
        generateTripSheetsBtn.innerHTML = `<span class="material-icons-outlined text-lg animate-spin">sync</span> Generating...`;
        scheduleStatus.textContent = `Generating trip sheets for ${selectedDate}. This may take a moment.`;
        tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-slate-400"><span class="material-icons-outlined text-4xl animate-spin">settings</span><p>Optimizing routes for ${selectedDate}...</p></div>`;
        tripSheetApprovalContainer.classList.add('hidden');

        try {
            const response = await fetch(GENERATE_TRIP_SHEETS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: selectedDate })
            });
            const result = await response.json();
            if (!response.ok) {
                const errorDetail = result.error || result.message || 'An unknown server error occurred.';
                throw new Error(errorDetail);
            }
            scheduleStatus.textContent = `Successfully generated trip sheets for ${selectedDate}. Review and approve to finalize.`;
        } catch (error) {
            console.error('Error generating trip sheets:', error);
            scheduleStatus.textContent = `Error generating trip sheets for ${selectedDate}: ${error.message}`;
            tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-red-500"><span class="material-icons-outlined text-4xl">error</span><p>Failed to generate trip sheets for ${selectedDate}.</p><p class="text-sm">${error.message}</p></div>`;
        } finally {
            generateTripSheetsBtn.disabled = false;
            generateTripSheetsBtn.innerHTML = `<span class="material-icons-outlined text-lg">route</span>Generate Trip Sheets`;
        }
    });

    if(approveTripSheetsBtn) approveTripSheetsBtn.addEventListener('click', async () => {
        const date = tripSheetDateInput.value;
        if (!currentTripSheets || currentTripSheets.length === 0) {
            alert("No trip sheets to approve.");
            return;
        }
    
        approveTripSheetsBtn.disabled = true;
        approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined animate-spin">sync</span>Approving...`;
    
        try {
            const batch = firebase.firestore().batch();
            const jobsToUpdate = new Map();
    
            currentTripSheets.forEach(sheet => {
                sheet.route.forEach(job => {
                    const liveJob = allJobsData.find(j => j.id === job.id);
                    if (liveJob && liveJob.status === 'Scheduled') {
                        jobsToUpdate.set(job.id, {
                            technicianId: sheet.technicianId,
                            technicianName: sheet.technicianName
                        });
                    }
                });
            });
    
            if (jobsToUpdate.size > 0) {
                jobsToUpdate.forEach((techInfo, jobId) => {
                    const jobRef = firebase.firestore().doc(`jobs/${jobId}`);
                    batch.update(jobRef, {
                        status: 'Awaiting completion',
                        assignedTechnicianId: techInfo.technicianId,
                        assignedTechnicianName: techInfo.technicianName
                    });
                });
                await batch.commit();
                scheduleStatus.textContent = `Successfully approved ${jobsToUpdate.size} jobs for ${date}. Technicians have been notified.`;
            } else {
                scheduleStatus.textContent = `All jobs for ${date} were already approved.`;
                approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined">check_circle_outline</span>Sheets Approved`;
                approveTripSheetsBtn.disabled = true;
            }
    
        } catch (error) {
            console.error("Error approving trip sheets:", error);
            scheduleStatus.textContent = `Error approving trip sheets: ${error.message}`;
            approveTripSheetsBtn.disabled = false;
            approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined">check_circle</span>Approve Trip Sheets`;
        }
    });

    if (tripSheetDateInput) {
        tripSheetDateInput.value = new Date().toISOString().split('T')[0];
        tripSheetDateInput.addEventListener('change', (event) => {
            loadTripSheetsForDate(event.target.value);
            if(scheduleStatus) scheduleStatus.textContent = `Displaying trip sheets for ${new Date(event.target.value + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}. Press 'Generate' to create or update.`;
        });
    }

    // Login Form
    const loginForm = document.getElementById('loginForm');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginErrorMessage = document.getElementById('loginErrorMessage');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            
            if (loginErrorMessage) loginErrorMessage.textContent = '';

            try {
                await auth.signInWithEmailAndPassword(email, password);
                console.log("Login successful for:", email);
                loginForm.reset();
            } catch (error) {
                console.error("Login failed:", error);
                if (loginErrorMessage) {
                    switch (error.code) {
                        case 'auth/user-not-found':
                        case 'auth/wrong-password':
                        case 'auth/invalid-credential':
                            loginErrorMessage.textContent = 'Invalid email or password. Please try again.';
                            break;
                        case 'auth/invalid-email':
                            loginErrorMessage.textContent = 'Please enter a valid email address.';
                            break;
                        default:
                            loginErrorMessage.textContent = `Error: ${error.message}`;
                    }
                }
            }
        });
    }

    // Initialize Firebase and Auth State Change Listener
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        db = firebase.firestore();
        console.log("Firebase Initialized (Compat).");

        const loginScreen = document.getElementById('loginScreen');
        const layoutContainer = document.getElementById('layoutContainer');
        const userAvatar = document.getElementById('userAvatar');

        auth.onAuthStateChanged(async user => {
            if (user) {
                // User is signed in
                const userInitial = user.email ? user.email.charAt(0).toUpperCase() : 'U';
                if(userAvatar) userAvatar.style.backgroundImage = `url("https://placehold.co/40x40/059669/FFFFFF?text=${userInitial}")`;

                if (user.email === 'admin@safewayos2.app') {
                    // --- ADMIN ROLE ---
                    console.log("Admin user signed in:", user.email);
                    loginScreen.style.display = 'none';
                    workerPwaView.classList.add('hidden');
                    layoutContainer.style.display = 'flex';

                    initializeTechnicians().then(() => {
                        listenForJobs();
                        listenForTechnicians();
                        initializeInventory().then(listenForInventoryItems);
                        listenForDashboardData();
                        if (tripSheetDateInput.value) {
                           loadTripSheetsForDate(tripSheetDateInput.value);
                        }
                    });
                    initializeDanielAIChat();
                    switchView('dashboard');
                } else {
                    // --- WORKER ROLE ---
                    console.log("Worker user signed in:", user.email);
                    const techName = user.email.split('@')[0];
                    const capitalizedTechName = techName.charAt(0).toUpperCase() + techName.slice(1);
                    
                    const techQuery = await firebase.firestore().collection('technicians').where('name', '==', capitalizedTechName).limit(1).get();

                    if (!techQuery.empty) {
                        const technician = { id: techQuery.docs[0].id, ...techQuery.docs[0].data() };
                        console.log(`Found technician profile: ${technician.name}`);
                        
                        loginScreen.style.display = 'none';
                        layoutContainer.style.display = 'none';
                        workerPwaView.classList.remove('hidden');

                        listenForWorkerJobs(technician.id, technician.name);
                    } else {
                        console.error(`No technician profile found for user ${user.email}. Defaulting to sign out.`);
                        auth.signOut();
                    }
                }
            } else {
                // --- USER IS SIGNED OUT ---
                loginScreen.style.display = 'flex';
                layoutContainer.style.display = 'none';
                workerPwaView.classList.add('hidden');
                console.log("User signed out.");

                // Clear data and listeners
                allJobsData = [];
                allTechniciansData = [];
                inventoryItemsData = [];
                currentTripSheets = [];
                conversationHistory = [];
                if (currentTripSheetListener) currentTripSheetListener();
                if (workerJobsListener) workerJobsListener();
                
                // Clear UI
                if(jobsTableBody) renderJobs([]);
                if(technicianCardsContainer) renderTechnicians([]);
                if(inventoryTableBody) renderInventory([]);
                if (tripSheetsContainer) tripSheetsContainer.innerHTML = '';
                if (dashboardLatestJobsListEl) dashboardLatestJobsListEl.innerHTML = '';
                if (chatLog) chatLog.innerHTML = '';
            }
        });

    } catch (error) {
        console.error("Firebase initialization failed:", error);
    }
});


function loadTripSheetsForDate(dateString) {
    if (!db || !dateString) {
        if (tripSheetsContainer) tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-slate-400"><p>Please select a date to view trip sheets.</p></div>`;
        if (tripSheetApprovalContainer) tripSheetApprovalContainer.classList.add('hidden');
        return;
    }
    if (currentTripSheetListener) {
        currentTripSheetListener(); 
    }
    const tripSheetQuery = firebase.firestore().collection("tripSheets").where("date", "==", dateString);
    currentTripSheetListener = tripSheetQuery.onSnapshot((snapshot) => {
        const sheets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (currentView === 'schedule' && tripSheetDateInput.value === dateString) {
            renderTripSheets(sheets, dateString);
        }
    }, (error) => {
        console.error(`Error listening to trip sheets for ${dateString}:`, error);
        if (tripSheetsContainer) tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-red-500"><p>Error loading trip sheets for ${dateString}.</p></div>`;
        if (tripSheetApprovalContainer) tripSheetApprovalContainer.classList.add('hidden');
    });
}


// --- Daniel AI Chat Logic ---
function appendToChatLog(message, sender = 'ai', isProcessing = false) {
    if (!chatLog) return;
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble');
    if (sender === 'user') {
        bubble.classList.add('chat-bubble-user');
        bubble.textContent = message;
    } else {
        bubble.classList.add('chat-bubble-ai');
        if (isProcessing) {
            bubble.classList.add('processing-bubble');
            bubble.innerHTML = `<span class="spinner"></span><span>${message}</span>`;
        } else {
            bubble.textContent = message;
        }
    }
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
    return bubble;
}

async function handleDanielAIChat(userInput) {
    conversationHistory.push({ role: 'user', parts: [{ text: userInput }] });
    appendToChatLog(userInput, 'user');
    const processingBubble = appendToChatLog("Daniel is thinking...", 'ai', true);
    
    sendChatButton.disabled = true;
    chatInput.disabled = true;

    try {
        const response = await fetch(ASK_DANIEL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: userInput,
                history: conversationHistory.slice(0, -1),
                view: currentView 
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'The AI is currently unavailable.');
        
        processingBubble.classList.remove('processing-bubble');
        processingBubble.innerHTML = result.response;
        conversationHistory.push({ role: 'model', parts: [{ text: result.response }] });

    } catch (error) {
        console.error("Error calling askDaniel function:", error);
        processingBubble.classList.remove('processing-bubble');
        processingBubble.textContent = `Sorry, I encountered an error: ${error.message}`;
    } finally {
        sendChatButton.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
        chatLog.scrollTop = chatLog.scrollHeight;
    }
}

function initializeDanielAIChat() {
    if (!chatLog || !chatInput || !sendChatButton) return;
    
    // Clear previous chat history if any
    chatLog.innerHTML = '';
    conversationHistory = [];
    
    const initialMessage = "Hello! I'm Daniel, your AI assistant. I have access to all jobs, technicians, and inventory. How can I help you? Try asking 'How many jobs are unscheduled?' or 'Where is Khaled?'";
    appendToChatLog(initialMessage);
    conversationHistory.push({ role: 'model', parts: [{ text: initialMessage }] });

    const submitQuery = () => {
        const userInput = chatInput.value.trim();
        if (userInput) {
            handleDanielAIChat(userInput);
            chatInput.value = '';
        }
    };

    // Remove existing listeners to prevent duplicates, then add them
    sendChatButton.removeEventListener('click', submitQuery);
    chatInput.removeEventListener('keypress', submitQuery);
    sendChatButton.addEventListener('click', submitQuery);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitQuery();
    });
}
