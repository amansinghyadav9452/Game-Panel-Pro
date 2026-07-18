let passwordResolver = null;

const overlay =
document.getElementById("passwordOverlay");

const input =
document.getElementById("verifyPassword");

const confirmBtn =
document.getElementById("passwordConfirm");

const cancelBtn =
document.getElementById("passwordCancel");

const toggleBtn =
document.getElementById("toggleVerifyPassword");

async function requestPassword(){

    input.value="";

    overlay.classList.add("show");

    input.focus();

    return new Promise(resolve=>{

        passwordResolver = resolve;

    });

}

if (confirmBtn && overlay && input) {

    confirmBtn.addEventListener("click", () => {

        overlay.classList.remove("show");

        passwordResolver?.(input.value.trim());

    });

}

if (cancelBtn && overlay) {

    cancelBtn.addEventListener("click", () => {

        overlay.classList.remove("show");

        passwordResolver?.(null);

    });

}

if (toggleBtn && input) {

    toggleBtn.addEventListener("click", () => {

        input.type =
            input.type === "password"
                ? "text"
                : "password";

    });

}