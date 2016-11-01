/*
    FunkBuddy-01
    The MIDI Interloper for the Yamaha FB-01
    10/23/2016
*/

'use strict';

/*
    ## configuration ###############################################################
*/
var config = {
        appName:        'FunkBuddy-01',
        version:        0.1,
        debug:          true,
        debugConsole:   false,
        logLimit:       15
};
// a global reference for the electron mainWindow
let mainWindow

// a global place to stash data private to the controller process
var mainData = {
    inputOpen:      false,
    outputOpen:     false,
    midiNoteNames:  []
};
var nullRgx = /^\s*$/;
var digitRgx = /^\d+$/;

// a map of all possible midi note names
var idx = 0;
var noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var noteIdx = 0;
var octIdx = 0;
while(idx <= 127){
    if (noteIdx > (noteNames.length - 1)){
        noteIdx = 0;
        octIdx ++;
    }
    mainData.midiNoteNames.push(noteNames[noteIdx] + "-" + octIdx);
    noteIdx ++;
    idx ++;
}

/*
    ## node imports ################################################################
*/
var midi = require('midi');
const electron = require('electron');
const app = electron.app;
const {ipcMain} = require('electron');
const BrowserWindow = electron.BrowserWindow;

/*
    ## electron app listeners ######################################################
*/

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', initializeApp);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})


/*
    ## functions ###################################################################
*/

/*
    Log(<message>, args)
    some logging fo' yo ayuuuussss
    args is an object of arbitrary key/value pairs to send to the GUI along with
    the log message (on msg).
    Some things:

        'tag'       => the bit in brackets in the GUI
        'midiData'  => parsed out midi message object
*/
function Log(message, args){

    var mObj = {
        msg:    message
    };
    Object.keys(args).forEach(function(key){
        mObj[key] = args[key]
    });

    // literally stupid right now
    mainWindow.webContents.send('log', mObj);
    if (config.debugConsole){ console.log(message); }

}

/*
    initializeApp()
    this catches the 'ready' hook from electron, kicks off the app
    proper, and opens a GUI window
*/
function initializeApp () {

    // get a midi input and enumerate the interfaces
    mainData.midiIn  = new midi.input();
    var intCount = mainData.midiIn.getPortCount();
    config.midiInInterfaceNames = [];
    var i = 0;
    while (i < intCount){
        config.midiInInterfaceNames.push(mainData.midiIn.getPortName(i));
        i ++;
    }

    // get a midi output and enumerate the interfaces
    mainData.midiOut = new midi.output();
    intCount = mainData.midiOut.getPortCount();
    config.midiOutInterfaceNames = [];
    i = 0;
    while (i < intCount){
        config.midiOutInterfaceNames.push(mainData.midiOut.getPortName(i));
        i ++
    }

    // make the BrowserWindow but don't show it yet
    mainWindow = new BrowserWindow({
        width: 			 800,
        height:          600,
        autoHideMenuBar: true,
        darkTheme:		 true,
        show:			 false
    });

    // debug mode
    if (config.debug){ mainWindow.webContents.openDevTools({mode: 'detach'}); }

    // load the html app.
    mainWindow.loadURL(`file://${__dirname}/index.html`);

    // once the content is loaded, show the window and send the init hook to the html app
    mainWindow.once('ready-to-show', () => {

        // show the window
        mainWindow.show();

        // send the init event to the app, along with the config
        mainWindow.webContents.send('init', config);
    });

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    });
}

/*
    parseMidiMessage [ <statusByte>, <dataByte1>, <dataByte2> ]
    returns object
*/
function parseMidiMessage(midiMessage){

    /*
        parse out the status (msg and channel)
        there should be a more elegant way to do this, staying in the binary domain
        however, I can't figure it out, and so here's an ascii string of 1's and 0's
        representing the binary status bytes.
        so ghetto
    */
    var bin = (midiMessage[0] >>> 0).toString(2);
    var parsed = {
        statusBin:  bin.substr(0, 4),
        channel:    (parseInt(bin.substr(4, 4), 2) + 1),
    };

    // decode the statusBin
    switch (parsed.statusBin){
        case "1000":
            parsed.msgType      = 'note off';
            parsed.noteNumber   = midiMessage[1];
            parsed.noteName     = mainData.midiNoteNames[midiMessage[1]];
            parsed.velocity     = midiMessage[2];
            break;
        case "1001":
            parsed.msgType      = 'note on';
            parsed.noteNumber   = midiMessage[1];
            parsed.noteName     = mainData.midiNoteNames[midiMessage[1]];
            parsed.velocity     = midiMessage[2];
            break;
        case "1010":
            parsed.msgType      = 'aftertouch (polyphonic)';
            parsed.noteNumber   = midiMessage[1];
            parsed.noteName     = mainData.midiNoteNames[midiMessage[1]];
            parsed.velocity     = midiMessage[2];
            break;
        case "1011":
            parsed.msgType            = 'control';
            parsed.controllerNumber   = midiMessage[1];
            parsed.controllerValue    = midiMessage[2];

            // recognized control messages
            // this is a bit complicated. 120 - 127 are reserved and have special meaning
            // based on the value

            break;
        case "1100":
            parsed.msgType      = 'program change';
            parsed.patchNumber  = midiMessage[1];
            break;
        case "1101":
            parsed.msgType      = 'aftertouch (monophonic)';
            parsed.velocity     = midiMessage[1];
            break;
        case "1110":
            parsed.msgType      = 'pitch bend';

            /* this would be a more correct way to do it
               unfortunately it doesn't work
            var bu = new ArrayBuffer(16);
            var b1v = new DataView(bu, 2, 7);
            b1v = midiMessage[2];
            var b2v = new DataView(bu, 9, 7);
            b2v = midiMessage[1];
            var b3v = new DataView(bu);
            var va = b3v.getInt16(2);
            */

            /* this is ghetto AF, but it works */
            var lsb = (midiMessage[1] >>> 0).toString(2);
            var msb = (midiMessage[2] >>> 0).toString(2);

            // make sure everyone is 7 digits logging
            while (lsb.length < 7){
                lsb = "0" + lsb;
            }
            while (msb.length < 7){
                msb = "0" + msb;
            }
            var va = msb + lsb;

            // spec says 2000H (hex?) is center of pitch change
            // figure this out later. for now should be the two vals
            // binarily concatenated ...
            console.log("[bend] [byte 1]: " + midiMessage[1] + " (" + lsb + ") [byte 2]: " + midiMessage[2] + " (" + msb + ") [combo]: " + va);

            parsed.bendValue    = parseInt(va, 2);
            break;
        case "1111":
            // sysex and shit ... the interesting stuff goes here
            switch (bin.substr(4, 4)){
                    case "0000":
                        parsed.msgType = "sysex";
                        break;
                    case "0001":
                        parsed.msgType = "MIDI Time Code Quarter Frame";
                        break;
                    case "0010":
                        parsed.msgType = "Song Position Pointer";
                        break;
                    case "0011":
                        parsed.msgType = "Song Select";
                        breakl
                    case "0100":
                        parsed.msgType = "undefined (reserved)";
                        break;
                    case "0101":
                        parsed.msgType = "undefined (reserved)";
                        break;
                    case "0110":
                        parsed.msgType = "tune request";
                        break;
                    case "0111":
                        parsed.msgType = "sysex terminate";
                        break;
                    case "1000":
                        parsed.msgType = "midi clock";
                        break;
                    case "1001":
                        parsed.msgType = "undefined (reserved)";
                        break;
                    case "1010":
                        parsed.msgType = "start (transport)";
                        break;
                    case "1011":
                        parsed.msgType = "continue (transport)";
                        break;
                    case "1100":
                        parsed.msgType = "stop (transport)";
                        break;
                    case "1101":
                        parsed.msgType = "undefined (reserved)";
                        break;
                    case "1110":
                        parsed.msgType = "keep alive (active sensing)";
                        break;
                    case "1111":
                        parsed.msgType = "reset";
                        break;
            }
            break;
    }
    return(parsed);
}


/*
    funkBuddy(timeDelta, midiMessage)
    this function is called every time there is a message on the selected input
    we pipe the input to the output, but we can do other funky thangs here, mawma
*/
function funkBuddy(timeDelta, midiMessage){

    /*
        midiMessage[ <statusByte>, <dataByte1>, <dataByte2> ]
        https://users.cs.cf.ac.uk/Dave.Marshall/Multimedia/node158.html
        https://www.midi.org/specifications/item/table-1-summary-of-midi-message
    */

    // parse the midi message
    var midiMsgObj = parseMidiMessage(midiMessage);
    var logStr = "[channel]: " + midiMsgObj.channel + " [type]: " + midiMsgObj.msgType;
    if (midiMsgObj.hasOwnProperty('noteName')){ logStr += " [note]: " + midiMsgObj.noteName; }
    if (midiMsgObj.hasOwnProperty('velocity')){ logStr += " [velocity]: " + midiMsgObj.velocity; }
    if (midiMsgObj.hasOwnProperty('controllerNumber')){ logStr += " [controller]: " + midiMsgObj.controllerNumber; }
    if (midiMsgObj.hasOwnProperty('controllerValue')){ logStr += " [value]: " + midiMsgObj.controllerValue; }
    if (midiMsgObj.hasOwnProperty('bendValue')){ logStr += " [bend]: " + midiMsgObj.bendValue; }
    Log(logStr, {tag: 'midi'});
    //Log("[bin]: " + bin + " [status]: " + status + " [channel]: " + channel + " [u]: " + midiMessage + " (" + timeDelta + ")", {tag: 'midi'});

    /*
        ==> INSERT FUNK HERE <==
    */

    if (mainData.outputOpen && mainData.inputOpen){
        mainData.midiOut.sendMessage(midiMessage);
    }
}


/*
    ## ipc events ##################################################################
*/

// portSelect (portId: <integer>, portType:<input|output>)
ipcMain.on('selectPort', (event, arg) => {
    if (arg.portId == "_default"){
        // handle deselect
    }else if ((nullRgx.test(arg.portId)) || (! digitRgx.test(arg.portId))){
        // invalid input -- throw some kinda error
    }else{
        // we must have a digit, do what needs to be done ...
        switch(arg.portType){
            case "input":

                /*
                    there is a bug in this version of the npm midi library
                    that prevents you from swapping the open port on an input object
                    the workaround is to destroy the object and re-instantiate
                    hence all these shenannigans down here

                    note also: IAC output doesn't seem to work?
                */

                if (mainData.inputOpen){
                    mainData.midiIn.closePort(mainData.inputPortNumber);
                    mainData.inputOpen = false;
                    Log("[closed input (" + mainData.inputPortNumber + ")]: " + config.midiInInterfaceNames[mainData.inputPortNumber], {tag:'system'});

                    // shenanigans
                    // note: for scientific-level completeness we should probably re-render the input list as well
                    // I'm shaving it for later ...
                    delete mainData.midiIn;
                    mainData.midiIn  = new midi.input();
                }

                // more shenanigans. if we're down here, the listener doesn't exist yet
                // we're either setting it up initially, or we just destroyed / recreated the input object
                mainData.midiIn.on('message', function(dt, msg){ funkBuddy(dt, msg)});

                // k, open the port and do yo' thang ...
                mainData.midiIn.openPort(Number(arg.portId));
                mainData.inputPortNumber = arg.portId;
                mainData.inputOpen = true;
                Log("[opened input (" + arg.portId + ")]: " + config.midiInInterfaceNames[arg.portId], {tag:'system'});
                break;

            case "output":
                if (mainData.outputOpen){
                    mainData.midiOut.closePort();
                    mainData.outputOpen = false;
                    //delete mainData.midiOut;
                    //mainData.midiOut = new midi.output();
                    Log("[closed output (" + mainData.outputPortNumber+ ")]: " + config.midiOutInterfaceNames[mainData.outputPortNumber], {tag:'system'});
                }
                mainData.midiOut.openPort(Number(arg.portId));
                mainData.outputPortNumber = arg.portId;
                mainData.outputOpen = true;
                Log("[opened output (" + arg.portId + ")]: " + config.midiOutInterfaceNames[arg.portId], {tag:'system'});
                break;
        }
    }
});
