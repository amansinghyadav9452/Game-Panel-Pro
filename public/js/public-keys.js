if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

initSidebar();
initAutoLogout();

initLicenseManager("/dashboard/licenses");
