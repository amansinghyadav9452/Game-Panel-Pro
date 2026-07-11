/* =========================
        Elements
========================= */

const cards =
document.querySelectorAll(".setting-card");

const saveBtn =
document.getElementById("saveSettings");

const inputs =
document.querySelectorAll(
"input, select"
);

let hasChanges = false;

/* =========================
    Collapse / Expand
========================= */

cards.forEach(card => {

    const header =
    card.querySelector(".card-header");

    header.addEventListener("click", () => {

        card.classList.toggle("collapsed");

    });

});

/* =========================
    Detect Changes
========================= */

inputs.forEach(input => {

    input.addEventListener("change", () => {

        hasChanges = true;

        saveBtn.innerHTML =
        `<i class="fa-solid fa-floppy-disk"></i>
        Save Changes *`;

        saveBtn.style.background =
        "#f59e0b";

    });

});

/* =========================
        Save Button
========================= */

saveBtn.addEventListener("click", async () => {

    if (!hasChanges) {

        showToast(
            "No changes found.",
            false
        );

        return;

    }

    saveBtn.disabled = true;

    saveBtn.innerHTML =
    `<i class="fa-solid fa-spinner fa-spin"></i>
    Saving...`;

    try {

        /* Backend API Here */

        await fakeDelay();

        hasChanges = false;

        saveBtn.innerHTML =
        `<i class="fa-solid fa-check"></i>
        Saved`;

        saveBtn.style.background =
        "#22c55e";

        showToast(
            "Settings saved successfully.",
            true
        );

        setTimeout(() => {

            saveBtn.disabled = false;

            saveBtn.innerHTML =
            `<i class="fa-solid fa-floppy-disk"></i>
            Save Changes`;

            saveBtn.style.background =
            "";

        },1500);

    }

    catch{

        saveBtn.disabled = false;

        saveBtn.innerHTML =
        `<i class="fa-solid fa-floppy-disk"></i>
        Save Changes`;

        saveBtn.style.background =
        "";

        showToast(
            "Failed to save settings.",
            false
        );

    }

});

/* =========================
    Unsaved Warning
========================= */

window.addEventListener(
"beforeunload",
e => {

if(hasChanges){

e.preventDefault();

e.returnValue="";

}

});

/* =========================
        Toast
========================= */

function showToast(
message,
success
){

const toast =
document.createElement("div");

toast.className="toast";

toast.innerHTML=message;

toast.style.position="fixed";

toast.style.right="25px";

toast.style.bottom="25px";

toast.style.padding="14px 20px";

toast.style.borderRadius="10px";

toast.style.color="#fff";

toast.style.zIndex="99999";

toast.style.fontWeight="600";

toast.style.background=
success
? "#22c55e"
: "#ef4444";

document.body.appendChild(toast);

setTimeout(()=>{

toast.remove();

},2500);

}

/* =========================
    Fake Delay
========================= */

function fakeDelay(){

return new Promise(resolve=>{

setTimeout(resolve,1000);

});

}