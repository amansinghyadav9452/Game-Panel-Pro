async function apiFetch(url, options = {}) {

    // The panel is entirely token-driven (no server session): whichever
    // token is present in localStorage decides which login this request
    // is authenticated as, so admin-only and customer-only requests
    // never cross-contaminate each other's session on a 401.
    // Resolve the active identity explicitly. Customer and admin sessions
    // use different server-side middleware and must never fall through to
    // the wrong token. If both exist because of an old browser state, prefer
    // the customer token only for customer endpoints, otherwise prefer admin.
    const customerEndpoint = /^\/customer(?:\/|$)/.test(url);
    const adminEndpoint = !customerEndpoint;
    const hasCustomerToken = !!localStorage.getItem("customerToken");
    const hasAdminToken = !!localStorage.getItem("token");

    const tokenKey = customerEndpoint && hasCustomerToken
        ? "customerToken"
        : adminEndpoint && hasAdminToken
            ? "token"
            : hasCustomerToken
                ? "customerToken"
                : "token";

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