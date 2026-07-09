let currentLicenseKey = "";

let allLicenses = [];

let currentFilter = "all";

const searchInput = document.querySelector(".search-box input");

const filterButtons =
document.querySelectorAll(".filter-btn");

async function loadLicenses(endpoint = "/dashboard/licenses") {

    try {

        const response = await apiFetch(endpoint);

        const data = await response.json();

        if (!data.success) return;

        allLicenses = data.licenses;

        applyFilters();

    } catch (err) {

        console.error(err);

    }

}

function initLicenseManager(endpoint) {

    loadLicenses(endpoint);

}

function renderLicenses(licenses) {

    const table = document.getElementById("licenseTable");
    const mobileList = document.getElementById("mobileLicenseList");

    if (!table || !mobileList) {

    return;

}

    table.innerHTML = "";
    mobileList.innerHTML = "";

    licenses.forEach((license) => {

        table.innerHTML += `

        <tr>

            <td>${license.key}</td>

            <td>
                <span class="status ${license.status}">
                    ${license.status}
                </span>
            </td>

            <td>${formatDate(license.expiry)}</td>

            <td>${license.usedCount}/${license.maxUses}</td>

            <td>

                <button
                    class="action-btn view-btn"
                    data-key="${license.key}">

                    <i class="fa-solid fa-eye"></i>

                    View

                </button>

            </td>

        </tr>

        `;

        mobileList.innerHTML += `

        <div class="license-card">

            <h3>${license.key}</h3>

            <p>

                <strong>Status :</strong>

                <span class="status ${license.status}">

                    ${license.status}

                </span>

            </p>

            <p>

                <strong>Expiry :</strong>

                ${formatDate(license.expiry)}

            </p>

            <p>

                <strong>Devices :</strong>

                ${license.usedCount}/${license.maxUses}

            </p>

<div class="card-actions">

    <button
        class="action-btn view-btn"
        data-key="${license.key}">

        <i class="fa-solid fa-eye"></i>

        View

    </button>

    <button
        class="action-btn copy-btn"
        data-key="${license.key}">

        <i class="fa-regular fa-copy"></i>

        Copy

    </button>

</div>

        </div>

        `;

    });

}

function applyFilters() {

    const keyword = searchInput.value
        .trim()
        .toLowerCase();

    let filtered = allLicenses.filter((license) => {

        const matchSearch =

            license.key.toLowerCase().includes(keyword) ||

            license.status.toLowerCase().includes(keyword) ||

            (license.type || "")
                .toLowerCase()
                .includes(keyword) ||

String(license.maxUses || "").includes(keyword) ||

new Date(license.expiry)
    .toLocaleDateString()
    .includes(keyword);

        if (!matchSearch) {

            return false;

        }

        if (currentFilter === "all") {

            return true;

        }

        if (
            currentFilter === "public" ||
            currentFilter === "premium"
        ) {

            return license.type === currentFilter;

        }

        return license.status === currentFilter;

    });

    renderLicenses(filtered);

}

searchInput.addEventListener("input", () => {

    applyFilters();

});

filterButtons.forEach((button) => {

    button.addEventListener("click", () => {

        filterButtons.forEach((btn) => {

            btn.classList.remove("active");

        });

        button.classList.add("active");

        currentFilter = button.dataset.filter;

        applyFilters();

    });

});

async function openLicenseModal(key){

    try{

const response = await apiFetch(`/dashboard/license/${key}`);

        const data = await response.json();

if (!data.success) {

    showToast(data.message, "error");

    return;

}

        const license = data.license;
        currentLicenseKey = license.key;

        document.getElementById("modalKey").textContent =
            license.key;

        document.getElementById("modalStatus").textContent =
            license.status;

        document.getElementById("modalExpiry").textContent =
            formatDate(license.expiry);

        document.getElementById("modalDevices").textContent =
            `${license.usedCount}/${license.maxUses}`;

        document.getElementById("modalLastDevice").textContent =
            license.lastDevice || "N/A";

            const banBtn =
document.getElementById("banLicenseBtn");

if (license.status === "banned") {

    banBtn.textContent = "Unban";

    banBtn.classList.remove("ban-btn");

    banBtn.classList.add("extend-btn");

} else {

    banBtn.textContent = "Ban";

    banBtn.classList.remove("extend-btn");

    banBtn.classList.add("ban-btn");

}

        modal.classList.add("active");

    }catch(err){

        console.error(err);

    }

}

const modal = document.getElementById("licenseModal");

const closeModal = document.getElementById("closeModal");
document.addEventListener("click", (e) => {

    const viewBtn = e.target.closest(".view-btn");

    if (viewBtn) {

        openLicenseModal(viewBtn.dataset.key);

        return;

    }

    const copyBtn = e.target.closest(".copy-btn");

    if (copyBtn) {

        copyText(copyBtn.dataset.key);

    }

});

if(closeModal){
closeModal.addEventListener("click",()=>{

    modal.classList.remove("active");
    if (typeof loadStats === "function") {
    loadStats();
}
    loadLicenses();

});
}

document.getElementById("banLicenseBtn")
.addEventListener("click",banLicense);

document.getElementById("sidebarLogout")
.addEventListener("click", (e) => {

    e.preventDefault();

    localStorage.removeItem("token");

    window.location.replace("/login");

});

async function banLicense(){

    try{

const banBtn = document.getElementById("banLicenseBtn");

const endpoint =
    banBtn.textContent.trim() === "Unban"
        ? "unban"
        : "ban";

const response = await apiFetch(

    `/dashboard/${endpoint}/${currentLicenseKey}`,
    {
        method: "PUT"
    }
);

        const data = await response.json();

        if(data.success){

            showToast(data.message);

            modal.classList.remove("active");

            if (typeof loadStats === "function") {
    loadStats();
}
            loadLicenses();
            
        }else{
            
            showToast(data.message,"error");
            
        }
        
    }catch(err){
        
        console.error(err);
        
        showToast("Server Error","error");
        
    }
    
}

const createModal =
document.getElementById("createKeyModal");

const generateBtn =
document.getElementById("generateBtn");

const extendModal =
document.getElementById("extendModal");

const extendBtn =
document.getElementById("extendLicenseBtn");

const closeExtendModal =
document.getElementById("closeExtendModal");

const saveExtendBtn =
document.getElementById("saveExtendBtn");

const resetDeviceBtn =
document.getElementById("resetDeviceBtn");

const deleteModal =
document.getElementById("deleteModal");

const deleteLicenseBtn =
document.getElementById("deleteLicenseBtn");

const closeDeleteModal =
document.getElementById("closeDeleteModal");

const confirmDeleteBtn =
document.getElementById("confirmDeleteBtn");

const cancelDeleteBtn =
document.getElementById("cancelDeleteBtn");

const btn = document.getElementById("openCreateModal");

if (btn) {

    btn.addEventListener("click", () => {

        createModal.classList.add("active");

    });

}

document
.getElementById("closeCreateModal")
.addEventListener("click",()=>{

    createModal.classList.remove("active");

});

if(extendBtn){
extendBtn.addEventListener("click", () => {

    extendModal.classList.add("active");

});
}
if(closeExtendModal){
closeExtendModal.addEventListener("click", () => {

    extendModal.classList.remove("active");

});
}

if(deleteLicenseBtn){
deleteLicenseBtn.addEventListener("click", () => {

    document.getElementById("deleteLicenseKey").textContent =
        currentLicenseKey;

    deleteModal.classList.add("active");

});
}

closeDeleteModal.addEventListener("click", () => {

    deleteModal.classList.remove("active");

});

cancelDeleteBtn.addEventListener("click", () => {

    deleteModal.classList.remove("active");

});

generateBtn.addEventListener("click", createCustomLicense);

saveExtendBtn.addEventListener("click", extendLicense);

resetDeviceBtn.addEventListener("click", resetDevice);

confirmDeleteBtn.addEventListener("click", deleteLicense);

async function createCustomLicense() {

    const key =
        document.getElementById("licenseKey").value.trim();

    const expiryDays =
        Number(document.getElementById("expiryDays").value);

    const maxUses =
        Number(document.getElementById("maxUses").value);

    if (!key) {

        showToast("License Key Required", "error");

        return;

    }

    try {

        generateBtn.disabled = true;

        generateBtn.textContent = "Generating...";

const response = await apiFetch("/public/create", {

    method: "POST",

    headers: {

        "Content-Type": "application/json"

    },

    body: JSON.stringify({

        key,

        type: document.getElementById("licenseType").value,

        expiryDays,

        maxUses

    })

});

        const data = await response.json();

        if (data.success) {

            showToast("License Created Successfully");

            createModal.classList.remove("active");

            document.getElementById("licenseKey").value = "";

            document.getElementById("expiryDays").value = 30;

            document.getElementById("maxUses").value = 1;

            if (typeof loadStats === "function") {
    loadStats();
}
    
            loadLicenses();
        }
        

        else {

            showToast(data.message, "error");

        }

    } catch (err) {

        console.error(err);

        showToast("Server Error", "error");

    }
    finally{
    generateBtn.disabled = false;

    generateBtn.textContent = "Generate License";
    }
}

async function extendLicense() {

    const days = Number(
        document.getElementById("extendDays").value
    );

    if (!days || days <= 0) {

        showToast("Enter valid days", "error");

        return;

    }

    try {

const response = await apiFetch(

    `/dashboard/extend/${currentLicenseKey}`,

    {

        method: "PUT",

        headers: {

            "Content-Type": "application/json"

        },

        body: JSON.stringify({

            days

        })

    }

);

        const data = await response.json();

        if (!data.success) {

            showToast(data.message, "error");

            return;

        }

        showToast("License Extended Successfully");

        extendModal.classList.remove("active");

        modal.classList.remove("active");

        if (typeof loadStats === "function") {
    loadStats();
}

        loadLicenses();

    } catch (err) {

        console.error(err);

        showToast("Server Error", "error");

    }

}

async function resetDevice() {

    try {

const response = await apiFetch(

    `/dashboard/reset-device/${currentLicenseKey}`,
    {
        method: "PUT"
    }
);

        const data = await response.json();

        if (!data.success) {

            showToast(data.message, "error");

            return;

        }

        showToast("Device Reset Successfully");

        modal.classList.remove("active");

        if (typeof loadStats === "function") {
    loadStats();
}

        loadLicenses();

    } catch (err) {

        console.error(err);

        showToast("Server Error", "error");

    }

}

async function deleteLicense() {

    try {

const response = await apiFetch(

    `/public/delete/${currentLicenseKey}`,

    {

        method: "DELETE"

    }

);

        const data = await response.json();

        if (!data.success) {

            showToast(data.message, "error");

            return;

        }

        showToast("License Deleted Successfully");

        deleteModal.classList.remove("active");

        modal.classList.remove("active");

        if (typeof loadStats === "function") {
    loadStats();
}

        loadLicenses();

    } catch (err) {

        console.error(err);

        showToast("Server Error", "error");

    }

}