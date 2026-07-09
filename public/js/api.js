async function apiFetch(url, options = {}) {

    const token = localStorage.getItem("token");

    const headers = {

        ...(options.headers || {}),

        Authorization: `Bearer ${token}`

    };

    const response = await fetch(url, {

        ...options,

        headers

    });

if (response.status === 401) {

    localStorage.removeItem("token");
    localStorage.removeItem("logoutAt");

    showToast("Session Expired", "error");

    setTimeout(() => {

        window.location.replace("/login");

    }, 1000);

    throw new Error("Unauthorized");

}

    return response;

}