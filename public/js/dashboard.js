const menuBtn = document.getElementById("menuBtn");

const sidebar = document.querySelector(".sidebar");

const overlay = document.getElementById("overlay");

let currentLicenseKey = "";

menuBtn.addEventListener("click", () => {

    sidebar.classList.add("active");

    overlay.classList.add("active");

});

overlay.addEventListener("click", () => {

    sidebar.classList.remove("active");

    overlay.classList.remove("active");

});

document.addEventListener("keydown", (e) => {

    if(e.key === "Escape"){

        sidebar.classList.remove("active");

        overlay.classList.remove("active");

    }

});

async function loadStats() {

    const token = localStorage.getItem("token");

    if (!token) {

        window.location.href = "/login";

        return;

    }

    try {

        const response = await fetch("/dashboard", {

            headers: {

                Authorization: `Bearer ${token}`

            }

        });

        const data = await response.json();

        if (!data.success) {

            localStorage.removeItem("token");

            window.location.href = "/login";

            return;

        }

        document.getElementById("totalKeys").textContent =
            data.stats.totalKeys;

        document.getElementById("activeKeys").textContent =
            data.stats.activeKeys;

        document.getElementById("expiredKeys").textContent =
            data.stats.expiredKeys;

        document.getElementById("bannedKeys").textContent =
            data.stats.bannedKeys;

    } catch (err) {

        console.error(err);

    }

}

loadStats();

async function loadLicenses() {

    const token = localStorage.getItem("token");

    try {

        const response = await fetch("/dashboard/licenses", {

            headers: {

                Authorization: `Bearer ${token}`

            }

        });

        const data = await response.json();

        if (!data.success) return;

        const table = document.getElementById("licenseTable");

        const mobileList =
document.getElementById("mobileLicenseList");

mobileList.innerHTML = "";

        table.innerHTML = "";

        data.licenses.forEach((license) => {

            table.innerHTML += `

            <tr>

                <td>${license.key}</td>

                <td>

                    <span class="status ${license.status}">

                        ${license.status}

                    </span>

                </td>

                <td>

                    ${new Date(license.expiry).toLocaleDateString()}

                </td>

                <td>

                    ${license.usedCount}/${license.maxUses}

                </td>

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

        ${new Date(license.expiry).toLocaleDateString()}

    </p>

    <p>

        <strong>Devices :</strong>

        ${license.usedCount}/${license.maxUses}

    </p>

    <button
        class="action-btn view-btn"
        data-key="${license.key}">

        <i class="fa-solid fa-eye"></i>

        View

    </button>

</div>

`;

        });

    } catch(err){

        console.error(err);

    }

}

loadLicenses();

async function openLicenseModal(key){

    const token = localStorage.getItem("token");

    try{

        const response = await fetch(`/dashboard/license/${key}`,{

            headers:{
                Authorization:`Bearer ${token}`
            }

        });

        const data = await response.json();

        if(!data.success) return;

        const license = data.license;
        currentLicenseKey = license.key;

        document.getElementById("modalKey").textContent =
            license.key;

        document.getElementById("modalStatus").textContent =
            license.status;

        document.getElementById("modalExpiry").textContent =
            new Date(license.expiry).toLocaleDateString();

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

document.addEventListener("click",(e)=>{

    const btn = e.target.closest(".view-btn");

    if(!btn) return;

    openLicenseModal(btn.dataset.key);

});

closeModal.addEventListener("click",()=>{

    modal.classList.remove("active");
    loadStats();
    loadLicenses();

});

document.getElementById("banLicenseBtn")
.addEventListener("click",banLicense);

document.getElementById("logoutBtn").addEventListener("click", () => {

    localStorage.removeItem("token");

    window.location.href = "/login";

});

const toast = document.getElementById("toast");

function showToast(message,type="success"){

    toast.textContent = message;

    toast.className = "";

    toast.classList.add(type);

    toast.classList.add("show");
    
    setTimeout(()=>{
        
        toast.classList.remove("show");
        
    },2500);
}

async function banLicense(){

    const token = localStorage.getItem("token");

    try{

const banBtn = document.getElementById("banLicenseBtn");

const endpoint =
    banBtn.textContent.trim() === "Unban"
        ? "unban"
        : "ban";

const response = await fetch(

    `/dashboard/${endpoint}/${currentLicenseKey}`,

    {

        method: "PUT",

        headers: {

            Authorization: `Bearer ${token}`

        }

    }

);

        const data = await response.json();

        if(data.success){

            showToast(data.message);

            modal.classList.remove("active");

            loadStats(),
            loadLicenses()
            
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

document
.getElementById("openCreateModal")
.addEventListener("click",()=>{

    createModal.classList.add("active");

});

document
.getElementById("closeCreateModal")
.addEventListener("click",()=>{

    createModal.classList.remove("active");

});

extendBtn.addEventListener("click", () => {

    extendModal.classList.add("active");

});

closeExtendModal.addEventListener("click", () => {

    extendModal.classList.remove("active");

});

deleteLicenseBtn.addEventListener("click", () => {

    document.getElementById("deleteLicenseKey").textContent =
        currentLicenseKey;

    deleteModal.classList.add("active");

});

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

    const token = localStorage.getItem("token");

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

        const response = await fetch("/public/create", {

            method: "POST",

            headers: {

                "Content-Type": "application/json",

                Authorization: `Bearer ${token}`

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

        } else {

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

    const token = localStorage.getItem("token");

    const days = Number(
        document.getElementById("extendDays").value
    );

    if (!days || days <= 0) {

        showToast("Enter valid days", "error");

        return;

    }

    try {

        const response = await fetch(

            `/dashboard/extend/${currentLicenseKey}`,

            {

                method: "PUT",

                headers: {

                    "Content-Type": "application/json",

                    Authorization: `Bearer ${token}`

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

        loadStats();

        loadLicenses();

    } catch (err) {

        console.error(err);

        showToast("Server Error", "error");

    }

}

async function resetDevice() {

    const token = localStorage.getItem("token");

    try {

        const response = await fetch(

            `/dashboard/reset-device/${currentLicenseKey}`,

            {

                method: "PUT",

                headers: {

                    Authorization: `Bearer ${token}`

                }

            }

        );

        const data = await response.json();

        if (!data.success) {

            showToast(data.message, "error");

            return;

        }

        showToast("Device Reset Successfully");

        modal.classList.remove("active");

        loadStats();

        loadLicenses();

    } catch (err) {

        console.error(err);

        showToast("Server Error", "error");

    }

}

async function deleteLicense() {

    const token = localStorage.getItem("token");

    try {

        const response = await fetch(

            `/public/delete/${currentLicenseKey}`,

            {

                method: "DELETE",

                headers: {

                    Authorization: `Bearer ${token}`

                }

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

        loadStats();

        loadLicenses();

    } catch (err) {

        console.error(err);

        showToast("Server Error", "error");

    }

}

          Promise.all([
            loadStats(),
            loadLicenses()
        ])