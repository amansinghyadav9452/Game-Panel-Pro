function getDeviceLabel(userAgent = "") {

    const ua = userAgent || "";

    let os = "Unknown OS";

    if (/windows/i.test(ua)) os = "Windows";
    else if (/android/i.test(ua)) os = "Android";
    else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
    else if (/mac os/i.test(ua)) os = "macOS";
    else if (/linux/i.test(ua)) os = "Linux";

    let browser = "Unknown Browser";

    if (/edg\//i.test(ua)) browser = "Edge";
    else if (/opr\/|opera/i.test(ua)) browser = "Opera";
    else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome";
    else if (/firefox\//i.test(ua)) browser = "Firefox";
    else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "Safari";

    return `${browser} on ${os}`;

}

function getDeviceIcon(deviceLabel = "") {

    if (/android|ios/i.test(deviceLabel)) return "fa-mobile-screen";

    if (/windows|macos|linux/i.test(deviceLabel)) return "fa-desktop";

    return "fa-display";

}

module.exports = { getDeviceLabel, getDeviceIcon };
