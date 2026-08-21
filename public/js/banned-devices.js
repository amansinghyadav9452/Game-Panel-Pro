if (!localStorage.getItem("token") && !localStorage.getItem("customerToken")) {
    window.location.replace("/login");
}

if ((typeof getPanelRole === "function" ? getPanelRole() : null) === "customer") {

    if (typeof showToast === "function") {
        showToast("Restricted", "Sorry, it's allowed only to the admin.", "error");
    }

    setTimeout(() => window.location.replace("/panel"), 900);

} else {

    loadBannedDevices();

}

async function loadBannedDevices() {

    const container = document.getElementById("bannedDevicesContainer");
    const isCustomer = (typeof getPanelRole === "function" ? getPanelRole() : null) === "customer";

    if (container && window.GPLoading) {
        GPLoading.show(container, "banned");
    }

    try {

        const endpoint = isCustomer
            ? "/customer/banned-devices"
            : "/api/banned-devices";

        const response = await apiFetch(endpoint);
        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Failed to load banned devices.");
        }

        const devices = Array.isArray(data) ? data : (data.devices || []);

        if (!devices.length) {

            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-shield-halved"></i>
                    <h3>${isCustomer ? "No Banned Devices" : "No Banned Devices Found"}</h3>
                    <p>${isCustomer ? "No banned device is currently associated with your keys." : "There are no devices in the banned list."}</p>
                </div>
            `;

            return;

        }

        let html = "";

        devices.forEach((device, index) => {

            const deviceName = [device.deviceBrand, device.deviceModel]
                .filter(Boolean)
                .join(" ") || "Unknown Device";

            html += `

<div class="log-card" style="animation-delay:${index * 60}ms;">

    <div class="log-title">
        <h3>🚫 ${deviceName}</h3>
    </div>

    <div class="log-meta">

        <div class="meta-row">
            <span class="meta-label">Serial :</span>
            <span class="meta-value">${device.serial || "-"}</span>
        </div>

        <div class="meta-row">
            <span class="meta-label">Key :</span>
            <span class="meta-value">${device.userKey || "-"}</span>
        </div>

        ${device.androidVersion ? `
        <div class="meta-row">
            <span class="meta-label">Android :</span>
            <span class="meta-value">${device.androidVersion}</span>
        </div>
        ` : ""}

        ${device.appVersion ? `
        <div class="meta-row">
            <span class="meta-label">App :</span>
            <span class="meta-value">${device.appVersion}</span>
        </div>
        ` : ""}

        ${device.playerName ? `
        <div class="meta-row">
            <span class="meta-label">Player :</span>
            <span class="meta-value">${device.playerName}</span>
        </div>
        ` : ""}

        ${device.bannedAt ? `
        <div class="meta-row">
            <span class="meta-label">Banned :</span>
            <span class="meta-value">${new Date(device.bannedAt).toLocaleString()}</span>
        </div>
        ` : ""}

        ${device.reason ? `
        <div class="meta-row reason">${device.reason}</div>
        ` : ""}

        ${!isCustomer ? `
        <button class="unban-btn" data-serial="${device.serial}">
            Unban
        </button>
        ` : ""}

    </div>

</div>

`;

        });

        container.innerHTML = html;

        if (!isCustomer) {
            container.querySelectorAll(".unban-btn").forEach(button => {
                button.addEventListener("click", () => {
                    unbanDevice(button.dataset.serial, button.closest(".log-card"));
                });
            });
        }

    } catch (err) {

        console.error(err);

        container.innerHTML = `
            <p style="color:#EF4444;">Unable to load banned devices.</p>
        `;

    }

}

async function unbanDevice(serial, cardEl) {

    showConfirm(
        "Unban Device",
        "Are you sure you want to unban this device?",
        async () => {

            const response = await fetch(`/api/banned-devices/${serial}`, {

                method: "DELETE",

                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }

            });

            const result = await response.json();

            if (result.success) {

                if (typeof gpHaptic === "function") {
                    gpHaptic(15);
                }

                showToast("Success", "Device unbanned successfully");

                if (cardEl && typeof gpRemoveRow === "function") {

                    gpRemoveRow(cardEl, () => {

                        if (!document.querySelector("#bannedDevicesContainer .log-card")) {

                            document.getElementById("bannedDevicesContainer").innerHTML = `
                                <p>No banned devices found.</p>
                            `;

                        }

                    });

                } else {

                    loadBannedDevices();

                }

            } else {

                showToast("Error", result.message || "Failed to unban device", "error");

            }

        }
    );

}