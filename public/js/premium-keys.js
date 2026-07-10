if (!localStorage.getItem("token")) {
    window.location.replace("/login");
}

if (typeof initSidebar === "function") {
    initSidebar();
}

initAutoLogout();

initLicenseManager("/premium/list");

window.LICENSE_DETAILS_ENDPOINT = "/premium/search";
window.CREATE_LICENSE_ENDPOINT = "/premium/create";
window.DELETE_LICENSE_ENDPOINT ="/premium/delete";
window.BAN_LICENSE_ENDPOINT = "/premium/ban";
window.UNBAN_LICENSE_ENDPOINT = "/premium/unban";
window.EXTEND_LICENSE_ENDPOINT ="/premium/extend";
window.RESET_DEVICE_ENDPOINT ="/premium/reset-device";