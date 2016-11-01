/*
    renderer.js
    this is the javascript that drives the GUI
*/
const {ipcRenderer} = require('electron');
let rendererData = {};

/* functions */

/*
    handleWMSelect(jQueryObject)
    handle a value being selected on a WMSelect
*/
function handleWMSelect(obj){

    // sure it's ghetto or whatever, but basically we just dispatch all of 'em from here
    switch (obj.id){
        case "midiInput":
            ipcRenderer.send('selectPort', {
                portId:     obj.value.trim(),
                portType:   'input'
             });
            break;
        case "midiOutput":
            ipcRenderer.send('selectPort', {
                portId:     obj.value.trim(),
                portType:   'output'
             });
             break;
    }
}

/*
    changeLogLimit(jQueryObject)
    change the log limit
*/
function changeLogLimit(obj){
    var digitRgx = /^\d+$/;
    if (digitRgx.test(obj.val())){
        rendererData.logLimit = obj.val();
        if ($("#logContainer").find(".msg").length > rendererData.logLimit){
            var tmpCnt = $("#logContainer").find(".msg").length;
            $("#logContainer").find(".msg").slice(0, (tmpCnt - rendererData.logLimit)).remove();
        }
    }else{
        obj.val(rendererData.logLimit);
    }

}



/*
    ipcRenderer events
*/

/*
    init (appConfig)
    this receives the 'init' event from the controller process (main.js)
    the appConfig object is passed as event data.
*/
ipcRenderer.on('init', (event, data) =>{

    /* start up the app GUI */
    rendererData = data;

    /* render the dropdown menus for input and output */
    var myHTML = [];
    myHTML.push('<select id="midiInput" class="WMSelect"><option value="_default" disabled selected>select midi input</option>');
    data.midiInInterfaceNames.forEach(function(name, idx){
        myHTML.push("<option value=" + idx + ">" + name + "</option>");
    });
    myHTML.push('</select>');
    myHTML.push('<select id="midiOutput" class="WMSelect"><option value="_default" disabled selected>select midi output</option>');
    data.midiOutInterfaceNames.forEach(function(name, idx){
        myHTML.push("<option value=" + idx + ">" + name + "</option>");
    });
    myHTML.push('</select>');
    $("#portSelector").html(myHTML.join(""));

    /* bind some actions to those dropdowns */
    $(".WMSelect").on('change', function(){
        handleWMSelect(this);
        $(this).blur();
    });


    /*
        hang hooks off some buttons
    */

    // open & close the log
    $("#toggleLog").click(function(){
        if ($("#logContainer").attr('state') == "closed"){
            $("#logContainer").slideDown("slow", function(){
                $("#logContainer").attr('state', "open");
                $("#toggleLog").text("close");
                $("#logCtrlPnl").removeClass("closedCtrlPnl").addClass("openCtrlPnl");
            });
        }else{
            $("#logContainer").slideUp("fast", function(){
                $("#logContainer").attr('state', "closed");
                $("#toggleLog").text("open");
                $("#logCtrlPnl").removeClass("openCtrlPnl").addClass("closedCtrlPnl");
            });
        }
    });

    // clear the log
    $("#clearLog").click(function(){
        $("#log").empty();
    });


    /*
        hang hooks off controls
    */

    //the log limit control
    $("#logLimit").on('blur focusout change', function(){
        if ($(this).attr('intentionalLoseFocus') == "true"){
            $(this).attr('intentionalLoseFocus', "false");
        }else{
            changeLogLimit($(this));
        }
    });
    $("#logLimit").on('keypress', function(e){
        if (e.keyCode == 13){
            changeLogLimit($(this));
            $(this).attr('intentionalLoseFocus', "true");
            $(this).blur();
        }
    });


    /*
        set up default values from app config
    */

    // default logLimit
    $("#logLimit").val(rendererData.logLimit);





});



/*
    log ({msg: <some strang>, ... other stuff as needed)
    show a log message from the app
*/
ipcRenderer.on('log', (event, data) =>{
    // slap it on there and keep it glued to the bottom
    var myHTML = '<div class="msg';
    if (data.hasOwnProperty('tag')){
        myHTML += ' ' + data.tag + 'MsgType"';
    }
    myHTML += '>';
    if (data.hasOwnProperty('tag')){
        myHTML += '<span class="msgTag">' + data.tag + '</span>';
    }
    myHTML += '<span class="logMsg">' + data.msg + '</span></div>';
    $("#log").append(myHTML);
    $("#logContainer").scrollTop($("#log").height());

    // we should have something to prune the messages off here
    // or the DOM will become infinitely huge and crash it prolly ...
    if ($("#logContainer").find(".msg").length > rendererData.logLimit){
        $("#logContainer").find(".msg").slice(0, 1).remove();
    }
});
