let confirmCallback = null;

function showConfirm(title, message, callback){

    document.getElementById("confirmTitle").textContent = title;

    document.getElementById("confirmMessage").textContent = message;

    document.getElementById("confirmOverlay")
        .classList.add("show");

    confirmCallback = callback;

}

document.getElementById("confirmCancel")
.addEventListener("click",()=>{

    document.getElementById("confirmOverlay")
        .classList.remove("show");

});

document.getElementById("confirmOk")
.addEventListener("click",()=>{

    document.getElementById("confirmOverlay")
        .classList.remove("show");

    if(confirmCallback){

        confirmCallback();

    }

});