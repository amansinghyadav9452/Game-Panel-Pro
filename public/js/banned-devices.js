if (!localStorage.getItem("token")) {
    window.location.replace("/login");
}

loadBannedDevices();

async function loadBannedDevices() {

    try {

        const response = await fetch("/api/banned-devices", {

            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }

        });

        const devices = await response.json();

        const container = document.getElementById("bannedDevicesContainer");

        if (!devices.length) {

            container.innerHTML = `
                <p>No banned devices found.</p>
            `;

            return;

        }

        let html = "";

        devices.forEach(device => {

            html += `

<div class="log-card">

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

        <button onclick="unbanDevice('${device.serial}')">

            Unban

        </button>

    </div>

</div>

`;

        });

        container.innerHTML = html;

    } catch (err) {

        console.error(err);

    }

}

async function unbanDevice(serial) {

    if (!confirm("Unban this device?")) {
        return;
    }

    const response = await fetch(`/api/banned-devices/${serial}`, {

        method: "DELETE",

        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
        }

    });

    const result = await response.json();

    if (result.success) {

        loadBannedDevices();

    }

}