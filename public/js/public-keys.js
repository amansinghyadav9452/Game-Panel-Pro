if (!localStorage.getItem("token") && !localStorage.getItem("customerToken")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {
    initSidebar();
}
initAutoLogout();

const __role = (typeof getPanelRole === "function") ? getPanelRole() : (localStorage.getItem("token") ? "admin" : "customer");

if (__role === "customer") {

    initLicenseManager("/customer/public/list");

    window.LICENSE_DETAILS_ENDPOINT = "/customer/dashboard/license";
    window.CREATE_LICENSE_ENDPOINT = "/customer/public/create";
    window.DELETE_LICENSE_ENDPOINT = "/customer/public/delete";
    window.BAN_LICENSE_ENDPOINT = "/customer/dashboard/ban";
    window.UNBAN_LICENSE_ENDPOINT = "/customer/dashboard/unban";
    window.EXTEND_LICENSE_ENDPOINT = "/customer/dashboard/extend";
    window.RESET_DEVICE_ENDPOINT = "/customer/dashboard/reset-device";

} else {

    initLicenseManager("/dashboard/licenses");

    window.LICENSE_DETAILS_ENDPOINT = "/dashboard/license";
    window.DELETE_LICENSE_ENDPOINT ="/public/delete";
    window.BAN_LICENSE_ENDPOINT = "/dashboard/ban";
    window.UNBAN_LICENSE_ENDPOINT = "/dashboard/unban";
    window.EXTEND_LICENSE_ENDPOINT ="/dashboard/extend";
    window.RESET_DEVICE_ENDPOINT ="/dashboard/reset-device";

}
