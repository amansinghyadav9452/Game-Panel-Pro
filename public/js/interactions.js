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

document.addEventListener("click", function (e) {

    if (gpAnimationsDisabled()) return;

    const target = e.target.closest("button, .btn");

    if (!target || target.disabled) return;

    const rect = target.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const size = Math.max(rect.width, rect.height) * 1.8;

    const ripple = document.createElement("span");

    ripple.className = "gp-ripple";

    ripple.style.width = ripple.style.height = size + "px";

    ripple.style.left = (e.clientX - rect.left - size / 2) + "px";

    ripple.style.top = (e.clientY - rect.top - size / 2) + "px";

    const computed = getComputedStyle(target);

    if (computed.position === "static") {

        target.style.position = "relative";

    }

    if (computed.overflow !== "hidden") {

        target.style.overflow = "hidden";

    }

    target.appendChild(ripple);

    ripple.addEventListener("animationend", () => ripple.remove());

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
