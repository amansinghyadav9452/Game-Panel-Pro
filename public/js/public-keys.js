if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {
    initSidebar();
}
initAutoLogout();

initLicenseManager("/dashboard/licenses");
