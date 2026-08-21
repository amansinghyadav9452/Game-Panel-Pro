async function apiFetch(url, options = {}) {

    // The panel is entirely token-driven (no server session): whichever
    // token is present in localStorage decides which login this request
    // is authenticated as, so admin-only and customer-only requests
    // never cross-contaminate each other's session on a 401.
    const isCustomer = !localStorage.getItem("token") && !!localStorage.getItem("customerToken");
    const tokenKey = isCustomer ? "customerToken" : "token";

    const token = localStorage.getItem(tokenKey);

    const headers = {

        ...(options.headers || {}),

        Authorization: `Bearer ${token}`

    };

    const response = await fetch(url, {

        ...options,

        headers

    });

if (response.status === 401) {

    localStorage.removeItem(tokenKey);
    localStorage.removeItem("logoutAt");

    showToast("Error", "Session Expired", "error");

    setTimeout(() => {

        window.location.replace("/login");

    }, 1000);

    throw new Error("Unauthorized");

}

    return response;

}