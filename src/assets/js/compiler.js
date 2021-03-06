
let files = null;
let editors = [];
let smaFiles = [];

const domain = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;

const initEditor = (id = '#plugin-default-editor')=>{

    const defaultValue = 
`/* Plugin generated by AMXX-Online */

#include <amxmodx>
#include <amxmisc>

#define PLUGIN "New Plug-In"
#define VERSION "1.0"
#define AUTHOR "author"


public plugin_init() {
    register_plugin(PLUGIN, VERSION, AUTHOR)
    
    // Add your code here...
}`;

    const editor = CodeMirror(document.querySelector(id), {
        lineNumbers: true,
        tabSize: 2,
        mode: "text/x-csrc",
        autoRefresh: true,
        theme: 'eclipse',
        value: defaultValue

    });

    editors[id] = {
        id,
        value: defaultValue,
        instance: editor
    };

    editor.on('change', evt =>{
        editors[id].value = evt.getValue();
    })

}


const includeCheck = () =>{

    document.getElementById('incFile').onchange = function() {

        $('.incCacheButton').show();

        files = this.files;
   
    };
}

const saveIncCache = () =>{

    document.getElementsByClassName('incCacheButton')[0].onclick = function(){

        if (files.length === 0) {
            console.log('No file is selected');
            return;
        }
    
        var reader = new FileReader();

        reader.onload = function(event) {

            const fileName = $('#incFile').val().split('\\').pop();

            const cachedInc = {
                "type": "includeCached",
                "value": event.target.result,
                "name": fileName,
                "active": true
            };

            localStorage.setItem(fileName, JSON.stringify(cachedInc));

            $('.incCacheButton').hide();

            const length = Object.keys({...localStorage}).length;

            const index = length === 0 ? 0 : length + 1;

            $("#cachedIncList").append(`<span class="incItem" id="inc-${index}">${fileName}<button type="button" class="close" data-dismiss="modal" aria-label="Close" onclick="removeCachedInc(${index});"><span aria-hidden="true">&times;</span></button></span>`);

            createMessage(`Include <b>${fileName}</b> is succesfully cached.`, 'success')

        };

        reader.readAsText(files[0]);
    }
}

const checkAlreadyCachedInc = () =>{

    const items = { ...localStorage };

    const length = Object.keys(items).length;
    const values = Object.values(items);

    for (let i = 0; i < length; i++) {

        const include = JSON.parse(values[i]);

        if(include.name.includes('.inc')){
            $("#cachedIncList").append(`<span class="incItem" id="inc-${i}">${include.name}<button type="button" class="close" data-dismiss="modal" aria-label="Close" onclick="removeCachedInc(${i});"><span aria-hidden="true">&times;</span></button></span>`);
        }
       
    }
}

const removeCachedInc = (id) =>{

    const items = { ...localStorage };

    const key = Object.keys(items)[id];

    localStorage.removeItem(key)

    $(`#inc-${id}`).remove();
}

const createMessage = (msg, type, time = 5000) =>{

    $('.messages').append(`
        <div class="alert alert-${type} push-big" role="alert">
            ${msg}
        </div>
    `);

    setTimeout(()=>{
        $('.messages div').remove();
    }, time);
    
}

const openNewPluginEditor = () =>{

    document.getElementById('openEditorInput').onclick = function(){

        $('#createNewInput').hide();

        $('#newFileModal').modal('show');
       
    }

    document.getElementById('openEditorInputButton').onclick = function(){

        $('#createNewInput').hide();

        $('#newFileModal').modal('show');
       
    }

    document.getElementById('saveNewFile').onclick = function() {

        let newFileName = $("#newFileName").val().replace(/ /g, "-");

        if(!newFileName){

            $('#newFileModal').modal('hide');

            return createMessage('File name is not good.', 'danger');

        }


        if(newFileName.match(/.inc/)){
            return generateNewEditor(newFileName)
        } 

        if(newFileName.match(/.sma/)){
            return generateNewEditor(newFileName)
        }

        const fileName = newFileName.concat('.sma');
        return generateNewEditor(fileName);

    }

    $('#newFileModal').on('hidden.bs.modal', function (e) {
        $('#createNewInput').show();
    })
   

}

const generateNewEditor = (fileName) =>{

    let tabName =  fileName.replace(/\./g, "-");

    if($(`#${tabName}`).length > 0){

        const tabCount = $(".nav-tabs").children().length;

        for (let i = 1; i < tabCount; i++) {

            if(!$(`#${tabName}-${i}`).length > 0){
               
                tabName = tabName.concat('-', i);

                fileNameSplit = fileName.split('.');

                const suffix = fileNameSplit.pop();

                fileNameSplit.push(`(${i})`, '.', suffix);

                fileName = fileNameSplit.join('');

                console.log(fileName)

                break;
            }
        }
    }

    $("#editorsList .nav-item:last").before(`<li class="nav-item">
                                                <a class="nav-link" id="${tabName}-tab" data-toggle="tab" role="tab" aria-controls="${tabName}-panel" aria-selected="false" href="#${tabName}">${fileName}</a>
                                                <span>X</span>
                                            </li>`);

    $(".tab-content").append(`<div class="tab-pane" id="${tabName}" role="tabpanel" aria-labelledby="${tabName}-tab">
                                    <div class="card">
                                        <div class="card-body" id="${tabName}-editor">
                                        </div>
                                    </div>
                                </div>`);
    
    $('#newFileModal').modal('hide');

    $(`.nav-tabs a[href="#${tabName}"]`).tab('show');

    initEditor(`#${tabName}-editor`);

}

const closeEditorTab = () =>{

    $(".nav-tabs").on("click", "span", function () {
        const anchor = $(this).siblings('a');
        $(anchor.attr('href')).remove();
        $(this).parent().remove();
        $(".nav-tabs li").children('a').first().click();
    });
}

const saveFile = () => {

    document.getElementById('saveFile').onclick = () => {

        const id = $('.tab-content .active').attr('id');
        const arrayID = `#${id.concat('-editor')}`;
        const value = editors[arrayID].value;
        const fileName = $(`#${id}-tab`).text();
        const a = document.createElement('a');
        const file = new Blob([value], {type: 'text/plain'});
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href)
    };
};

const sendData = async (path, data = {}) =>{

    const url = domain + path;
    
    const response = await fetch(url, {
        method: 'POST', 
        mode: 'cors', 
        cache: 'no-cache', 
        headers: {'Content-Type': 'application/json'},
        referrerPolicy: 'same-origin',
        body: JSON.stringify(data)
    });
    
    return response.json(); // parses JSON response into native JavaScript objects     
};

const formPluginRequest = async () =>{

    document.getElementById('smaFile').onchange = function() {

        $('.smaFileCompileButton').show();
        $('#amxx-version').show();
        $('#amxVerLabel').show();
        $('#download').show();
        $('#downloadLabel').show();

        smaFiles = this.files;
   
    };

    document.getElementsByClassName('smaFileCompileButton')[0].onclick = function(){

        if (smaFiles.length === 0) {
            console.log('No file is selected');
            return;
        }

        // get amxx version default 1.8.2 as stable build
        const version = $("#amxx-version option:selected").text();
        
        const bodyData = {
            includes: [],
            plugin: [],
            version
        };

        const includeItems = { ...localStorage };

        const length = Object.keys(includeItems).length;
        const values = Object.values(includeItems);
    
        for (let i = 0; i < length; i++) {
    
            const include = JSON.parse(values[i]);
    
            if(include.name.includes('.inc') && include.active === true){
              bodyData.includes.push({'incName': include.name, 'value': include.value});
            }
  
        }

        // init new file reader
        const reader = new FileReader();

        // read uploaded sma file 
        reader.readAsText(smaFiles[0]);

        // get file name
        const smaName = $('#smaFile').val().split('\\').pop();

        // wait to browser load file
        reader.onload = (event) => {
            // append data to the body
            bodyData.plugin.push({'pluginName': smaName, 'value': event.target.result});  
            
            // Send data to backend
            sendData('/api/compile', bodyData).then(answer =>{

                // Get state of checkbox
                const download_after_finish = $('#download').is(':checked')

                // Force download if user has checked Download after compile checkbox
                if(download_after_finish && answer.status_code === 200 && answer.plugin_id){
                    return window.open(`api/download/${answer.plugin_id}`, '_blank');
                }

                // Show modal
                $('#compileOutput').modal('show');

                // Display output text
                $('#compileOutput .output').text(answer.output_log);
            
                // Plugin is successfully compiled 
                if(answer.plugin_id){

                    $('#downloadFile').removeClass('disabled');

                    // Show hashes
                    $('#hashLabel').show();
                    $('#md5').append(answer.file_hash.md5).show();
                    $('#sha256').append(answer.file_hash.sha256).show();

                }

                document.getElementById('downloadFile').onclick = function(){
                    return window.open(`api/download/${answer.plugin_id}`, '_blank');
                }

            });
        };
        
    }

 
}

window.onload = () =>{
    initEditor();
    includeCheck();
    saveIncCache();
    checkAlreadyCachedInc();
    openNewPluginEditor();
    checkUrl();
    closeEditorTab();
    saveFile();
    formPluginRequest();
}

