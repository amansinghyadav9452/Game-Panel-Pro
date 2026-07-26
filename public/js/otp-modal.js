let otpResolver = null;

const otpOverlay =
document.getElementById("otpOverlay");

const otpInputEl =
document.getElementById("otpModalInput");

const otpConfirmBtn =
document.getElementById("otpConfirm");

const otpCancelBtn =
document.getElementById("otpCancel");

async function requestOtp(){

    otpInputEl.value = "";

    otpOverlay.classList.add("show");

    otpInputEl.focus();

    return new Promise(resolve => {

        otpResolver = resolve;

    });

}

if (otpConfirmBtn && otpOverlay && otpInputEl) {

    otpConfirmBtn.addEventListener("click", () => {

        otpOverlay.classList.remove("show");

        otpResolver?.(otpInputEl.value.trim());

    });

}

if (otpCancelBtn && otpOverlay) {

    otpCancelBtn.addEventListener("click", () => {

        otpOverlay.classList.remove("show");

        otpResolver?.(null);

    });

}
