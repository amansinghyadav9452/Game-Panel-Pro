let banCallback = null;

function showBanModal(deviceLabel, callback) {

    const label = document.getElementById("banDeviceLabel");
    const input = document.getElementById("banReasonInput");
    const overlay = document.getElementById("banOverlay");

    if (!overlay || !label || !input) {
        return;
    }

    label.innerHTML =
        `Ban <span class="ban-device-name">${deviceLabel || "this device"}</span>? ` +
        `It will be blocked from using any license key.`;

    input.value = "";

    overlay.classList.add("show");

    banCallback = callback;

    setTimeout(() => input.focus(), 50);

}

function closeBanModal() {

    const overlay = document.getElementById("banOverlay");

    if (overlay) {
        overlay.classList.remove("show");
    }

    banCallback = null;

}

const banCancel = document.getElementById("banCancel");
const banConfirm = document.getElementById("banConfirm");

if (banCancel) {

    banCancel.addEventListener("click", () => {
        closeBanModal();
    });

}

if (banConfirm) {

    banConfirm.addEventListener("click", () => {

        const input = document.getElementById("banReasonInput");
        const reason = input ? input.value.trim() : "";

        const callback = banCallback;

        closeBanModal();

        if (callback) {
            callback(reason);
        }

    });

}
