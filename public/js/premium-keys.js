if (!localStorage.getItem("token") && !localStorage.getItem("customerToken")) {
    window.location.replace("/login");
}

if (typeof initSidebar === "function") {
    initSidebar();
}

initAutoLogout();

const __role = (typeof getPanelRole === "function") ? getPanelRole() : (localStorage.getItem("token") ? "admin" : "customer");

if (__role === "customer") {

    initLicenseManager("/customer/premium/list");

    window.LICENSE_DETAILS_ENDPOINT = "/customer/dashboard/license";
    window.CREATE_LICENSE_ENDPOINT = "/customer/premium/create";
    window.DELETE_LICENSE_ENDPOINT = "/customer/premium/delete";
    window.BAN_LICENSE_ENDPOINT = "/customer/dashboard/ban";
    window.UNBAN_LICENSE_ENDPOINT = "/customer/dashboard/unban";
    window.EXTEND_LICENSE_ENDPOINT = "/customer/dashboard/extend";
    window.RESET_DEVICE_ENDPOINT = "/customer/dashboard/reset-device";

} else {

    initLicenseManager("/premium/list");

    window.LICENSE_DETAILS_ENDPOINT = "/premium/search";
    window.CREATE_LICENSE_ENDPOINT = "/premium/create";
    window.DELETE_LICENSE_ENDPOINT ="/premium/delete";
    window.BAN_LICENSE_ENDPOINT = "/premium/ban";
    window.UNBAN_LICENSE_ENDPOINT = "/premium/unban";
    window.EXTEND_LICENSE_ENDPOINT ="/premium/extend";
    window.RESET_DEVICE_ENDPOINT ="/premium/reset-device";

}
