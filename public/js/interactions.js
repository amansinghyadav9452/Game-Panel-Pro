function gpAnimationsDisabled() {

    return document.documentElement.classList.contains("no-animations");

}

function gpHaptic(ms = 12) {

    if (navigator.vibrate) {

        try {
            navigator.vibrate(ms);
        } catch (err) {

        }

    }

}

document.addEventListener("pointerdown", function (e) {

    if (gpAnimationsDisabled()) return;

    const target = e.target.closest("button, a, [role=button], .clickable");
    if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") return;

    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    target.classList.add("gp-pressed");
    window.setTimeout(() => target.classList.remove("gp-pressed"), 140);

    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 1.65;
    ripple.className = "gp-ripple";
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${(e.clientX || rect.left + rect.width / 2) - rect.left - size / 2}px`;
    ripple.style.top = `${(e.clientY || rect.top + rect.height / 2) - rect.top - size / 2}px`;

    const isDanger = target.classList.contains("delete-btn") ||
        target.classList.contains("danger") ||
        target.classList.contains("pk-danger-action") ||
        /delete|revoke|remove/i.test(target.textContent || "");
    ripple.style.setProperty("--gp-ripple-color", isDanger ? "rgba(248,113,113,.42)" : "rgba(229,185,107,.46)");

    const computed = getComputedStyle(target);
    if (computed.position === "static") target.style.position = "relative";
    if (computed.overflow !== "hidden") target.style.overflow = "hidden";
    target.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });

    gpHaptic(6);

}, true);

document.addEventListener("click", function (e) {
    const target = e.target.closest("button, a, [role=button], .clickable");
    if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") return;
    target.classList.remove("gp-click-flash");
    void target.offsetWidth;
    target.classList.add("gp-click-flash");
    window.setTimeout(() => target.classList.remove("gp-click-flash"), 320);
}, true);

function animateCounter(el, targetValue, duration = 900) {

    if (!el) return;

    const end = Number(targetValue) || 0;

    el.classList.remove("gp-skeleton");

    if (gpAnimationsDisabled()) {

        el.textContent = end;

        return;

    }

    const startTime = performance.now();

    function tick(now) {

        const progress = Math.min((now - startTime) / duration, 1);

        const eased = 1 - Math.pow(1 - progress, 3);

        el.textContent = Math.round(end * eased);

        if (progress < 1) {

            requestAnimationFrame(tick);

        } else {

            el.textContent = end;

        }

    }

    requestAnimationFrame(tick);

}

function gpRemoveRow(el, callback) {

    if (!el) return;

    if (gpAnimationsDisabled()) {

        el.remove();

        if (callback) callback();

        return;

    }

    el.style.maxHeight = el.offsetHeight + "px";

    el.style.overflow = "hidden";

    void el.offsetHeight;

    el.classList.add("gp-removing");

    el.addEventListener("transitionend", function handler() {

        el.removeEventListener("transitionend", handler);

        el.remove();

        if (callback) callback();

    });

}

window.gpAnimationsDisabled = gpAnimationsDisabled;
window.gpHaptic = gpHaptic;
window.animateCounter = animateCounter;
window.gpRemoveRow = gpRemoveRow;
