const API_BASE = "http://127.0.0.1:18080"
const ACCESS_TYPE_PUBLIC = "public"
const ACCESS_TYPE_PRIVATE = "private"

var current_accss_type = ACCESS_TYPE_PUBLIC

$( document ).ready(function() {
    var token = get_basic_auth_token();
    if (token !== "") {
        set_authenticated();  
    } 
    list_images(current_accss_type);
});

function list_images(access_type) {
    $.ajax({
        url: API_BASE + "/list",
        type: "POST",
        data: JSON.stringify({
            "access_type": access_type,
            "token": get_basic_auth_token(),
        }),
        success: function(result){
            $("#images-container").empty();
            if (result.images !== null) {
                var row_size = 0;
                var current_row = null;
                for (let image of result.images) {
                    if (image.file_name == null || image.file_name === "")  {
                        continue
                    }

                    if (image.access_path == null || image.access_path === "")  {
                        continue
                    }

                    if (row_size % 3 == 0) {
                        current_row = $("<div class='row padded-row'></div>");
                        $("#images-container").append(current_row);
                        row_size = 0;
                    }
                    var image_link = API_BASE + "/uploads/" + encodeURIComponent(image.access_path) + "/" + encodeURIComponent(image.file_name)
                    var secret = get_basic_auth_token();
                    if (secret != null && secret != "") {
                        image_link += "?token=" + encodeURIComponent(secret)
                    }
                    $(current_row).append("<div class='col-sm grid-image'><a target='_blank' href='"+ image_link + "'><img class='grid-image' src='" + image_link +"' /></a></div>");
                    row_size++;
                }
            }
        },
        error: function(result){
            if (result.responseText == undefined || result.responseText == "") {
                $("#yronwood-error").text("Error: unknown (" + result.statusText +")");
            } else {
                var err = $.parseJSON(result.responseText)
                $("#yronwood-error").text("Error: " + err.message + " (" + err.code + ")");
            }
        }
    });
}

$(document).on("click", "#authenticateButton", function(event) {
    $("#yronwood-success").text("");
    $("#yronwood-error").text("");
    $.ajax({
        url: API_BASE + "/authenticate",
        type: "POST",
        data: JSON.stringify({
            "secret": $("#authenticateSecret").val(),
        }),
        success: function(result){
            if (result.token != null && result.token !== "") {
                $("#yronwood-success").text("Successfully authenticated!");
                set_basic_auth_token(result.token);
                set_authenticated();
                list_images(current_accss_type);
            } else {
                $("#yronwood-error").text("Could not authenticate!");
            }
        },
        error: function(result){
            if (result.responseText == undefined || result.responseText == "") {
                $("#yronwood-error").text("Error: unknown (" + result.statusText +")");
            } else {
                var err = $.parseJSON(result.responseText)
                $("#yronwood-error").text("Error: " + err.message + " (" + err.code + ")");
            }
        }
    });
    // Clear the secret field value as it is a static modal.
    $("#authenticateSecret").val("");
});

$(document).keypress(function(e) {
    if ($("#authenticateModal").hasClass('show') && (e.keycode == 13 || e.which == 13)) {
        $("#authenticateButton").trigger("click");
    }
});

$(document).on("change", "#uploadFile", function(){
    var fileName = $(this).val();
    $(this).next('.custom-file-label').html(fileName);
})

function doUploadFile(payload, checksum, filename) {
    var fileNameComponents = filename.split(".")
    if (fileNameComponents == undefined || fileNameComponents.length < 2) {
        $("#yronwood-error").text("File must have an extension in name");
        return
    }

    $.ajax({
        url: API_BASE + "/upload",
        type: "PUT",
        data: JSON.stringify({
            "token": get_basic_auth_token(),
            "access_type": $("#accessTypeSelection").val(),
            "payload": payload,
            "checksum": checksum,
            "metadata": {
                "file_name": randomFileName(32) + "." + fileNameComponents[1]
            }
        }),
        success: function(result){
            $("#yronwood-success").text("Upload successful");
            list_images(current_accss_type);
        },
        error: function(result){
            if (result.responseText == undefined || result.responseText == "") {
                $("#yronwood-error").text("Error: unknown (" + result.statusText +")");
            } else {
                var err = $.parseJSON(result.responseText)
                $("#yronwood-error").text("Error: " + err.message + " (" + err.code + ")");
            }
        }
    });
    // Clear the upload path value as it is a static modal.
    $("#uploadFile").val("");
}

$(document).on("click", "#uploadButton", function(event) {
    $("#yronwood-success").text("");
    $("#yronwood-error").text("");
    var file = $("#uploadFile").prop('files')[0];
    if (file == undefined || file.length == 0) {
        $("#yronwood-error").text("You must select a file");
        return
    }

    var reader = new FileReader();
    reader.filename = file.name
    reader.onload = function(file) {
        var arrayBuffer = this.result
        var base64Payload = btoa([].reduce.call(new Uint8Array(arrayBuffer),function(p,c){return p+String.fromCharCode(c)},''))
        digestMessage(base64Payload).then(function(digestValue) {
            doUploadFile(base64Payload, hexString(digestValue), file.target.filename);
        }); 
    }
    reader.readAsArrayBuffer(file);
});

function set_authenticated() {
    current_accss_type = ACCESS_TYPE_PRIVATE;
    $("#authenticateIcon").removeClass("oi-lock-locked");
    $("#authenticateIcon").addClass("oi-lock-unlocked");
    $("#uploadIcon").removeAttr("hidden");
}

function set_basic_auth_token(token) {
    sessionStorage.setItem("yronwood_basic_auth_token", token);
}

function get_basic_auth_token() {
    var token = sessionStorage.getItem("yronwood_basic_auth_token");
    if (token === undefined || token === null) {
        return "";
    } 

    return token
}

function hexString(buffer) {
    const byteArray = new Uint8Array(buffer);
    const hexCodes = [...byteArray].map(value => {
        const hexCode = value.toString(16);
        const paddedHexCode = hexCode.padStart(2, '0');
        return paddedHexCode;
    });
  
    return hexCodes.join('');
}

function digestMessage(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    return window.crypto.subtle.digest('SHA-256', data);
}

function randomFileName(length) {
    var result           = '';
    var characters       = 'abcdef0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}