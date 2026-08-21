if (!localStorage.getItem("token")) {
    window.location.replace("/login");
}

loadBannedDevices();

async function loadBannedDevices() {

    const container = document.getElementById("bannedDevicesContainer");

    if (container && window.GPLoading) {
        GPLoading.show(container, "banned");
    }

    try {

        const response = await fetch("/api/banned-devices", {

            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }

        });

        const devices = await response.json();

        if (!devices.length) {

            container.innerHTML = `
                <p>No banned devices found.</p>
            `;

            return;

        }

        let html = "";

        devices.forEach((device, index) => {

            html += `

<div class="log-card" style="animation-delay:${index * 60}ms;">

    <div class="log-title">

        <h3>${device.deviceBrand} ${device.deviceModel}</h3>

    </div>

    <div class="log-meta">

        <div class="meta-row">

            <span class="meta-label">Serial :</span>

            <span class="meta-value">${device.serial}</span>

        </div>

        <div class="meta-row">

            <span class="meta-label">Key :</span>

            <span class="meta-value">${device.userKey}</span>

        </div>

        <div class="meta-row">

            <span class="meta-label">App :</span>

            <span class="meta-value">${device.appVersion}</span>

        </div>

        ${device.playerName ? `
        <div class="meta-row">

            <span class="meta-label">Player :</span>

            <span class="meta-value">${device.playerName}</span>

        </div>
        ` : ""}

        <button class="unban-btn" data-serial="${device.serial}">

            Unban

        </button>

    </div>

</div>

`;

        });

        container.innerHTML = html;

        container.querySelectorAll(".unban-btn").forEach(button => {

            button.addEventListener("click", () => {

                unbanDevice(button.dataset.serial, button.closest(".log-card"));

            });

        });

    } catch (err) {

        console.error(err);

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