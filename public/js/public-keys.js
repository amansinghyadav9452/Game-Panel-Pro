if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {
    initSidebar();
}
initAutoLogout();

initLicenseManager("/dashboard/licenses");

window.LICENSE_DETAILS_ENDPOINT = "/dashboard/license";
window.DELETE_LICENSE_ENDPOINT ="/public/delete";
window.BAN_LICENSE_ENDPOINT = "/dashboard/ban";
window.UNBAN_LICENSE_ENDPOINT = "/dashboard/unban";
window.EXTEND_LICENSE_ENDPOINT ="/dashboard/extend";
window.RESET_DEVICE_ENDPOINT ="/dashboard/reset-device";
