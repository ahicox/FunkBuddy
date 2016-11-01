/*
     midiMessage.js
     an object of this class can parse raw midi data, returning an object of named parameters,
     OR can take an object of named parameters and output raw midi data.

     this is designed to work with the format returned / expected from the NPM 'midi' module:
     https://github.com/justinlatimer/node-midi

     that is, an array of three unsigned integers, representing:
     [ <statusByte>, <dataByte1>, <dataByte2> ]

     additional helpful information:
     https://users.cs.cf.ac.uk/Dave.Marshall/Multimedia/node158.html
     https://www.midi.org/specifications/item/table-1-summary-of-midi-message
*/

'use strict';
var nybble = require('nybble');

// global buffer for binary operations
var msgBuffer = new ArrayBuffer(8);
var eightBitBuffer = new Uint8Array(msgBuffer);

// some common regexs
var digitRgx = /^\d{3}$/;
var nullRgx = /^\s*$/;

// a list of known controller numbers (array index == controller number)
var controlNumbers = [
        'bank select',
        'mod wheel',
        'breath controller',
        'undefined',
        'foot controller',
        'portamento time',
        'data entry MSB',
        'main volume',
        'balance',
        'undefined',
        'pan',
        '0Ch',
        'effect control 1',
        'effect control 2',
        'undefined',
        'undefined',
        'general purpose controller 1',
        'general purpose controller 2',
        'general purpose controller 3',
        'general purpose controller 4',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'controller 0 LSB',
        'controller 1 LSB',
        'controller 2 LSB',
        'controller 3 LSB',
        'controller 4 LSB',
        'controller 5 LSB',
        'controller 6 LSB',
        'controller 7 LSB',
        'controller 8 LSB',
        'controller 9 LSB',
        'controller 10 LSB',
        'controller 11 LSB',
        'controller 12 LSB',
        'controller 13 LSB',
        'controller 14 LSB',
        'controller 15 LSB',
        'controller 16 LSB',
        'controller 17 LSB',
        'controller 18 LSB',
        'controller 19 LSB',
        'controller 20 LSB',
        'controller 21 LSB',
        'controller 22 LSB',
        'controller 23 LSB',
        'controller 24 LSB',
        'controller 25 LSB',
        'controller 26 LSB',
        'controller 27 LSB',
        'controller 28 LSB',
        'controller 29 LSB',
        'controller 30 LSB',
        'controller 31 LSB',
        'damper pedal',
        'portamento',
        'sostenuto',
        'soft pedal',
        'legato footswitch',
        'hold 2',
        'sound controller 1 (expression)',
        'sound controller 2 (timbre)',
        'sound controller 3 (release)',
        'sound controller 4 (attack)',
        'sound controller 5 (brightness)',
        'sound controller 6',
        'sound controller 7',
        'sound controller 8',
        'sound controller 9',
        'sound controller 10',
        'general purpose controller 5',
        'general purpose controller 6',
        'general purpose controller 7',
        'general purpose controller 8',
        'portamento control',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'effect 1 depth (external)',
        'effect 2 depth (tremolo)',
        'effect 3 depth (chorus)',
        'effect 4 depth (detune)',
        'effect 5 depth (phaser)',
        'data increment',
        'data increment',
        'non-registered parameter number LSB',
        'non-registered parameter number LSB',
        'registered parameter number LSB',
        'registered parameter number MSB',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined',
        'undefined'
];

// module config info
var moduleData = {
    name:       'midiMessage',
    version:    1,
    hasError:   false,
    error:      {},
    debug:      false
};

// contstructor
module.exports = function(args){

    // merge class-global stuff into the object
    Object.keys(defaultData).forEach(function(key){
        Object.defineProperty(this, key, {
            value:        defaultData[key],
            writable:     true,
            enumerable:   true,
            configurable: true
        });
    }, this);

    // merge args
    Object.keys(args).forEach(function(key){
        if (this.hasOwnProperty(key)){
            // just overwrite it
            this[key] = args[key];
        }else{
            // define it
            Object.defineProperty(this, key, {
                value:        args[key],
                writable:     true,
                enumerable:   true,
                configurable: true
            });
        }
    }, this);

    // get note mappings
    Object.defineProperty(this, 'noteIndex', {
        value:  _getDefaultNoteNames(),
        writable:     true,
        enumerable:   true,
        configurable: true
    });

    /*
        ########################
        ## public functions
        ########################
    */


    /*
        parseMidiMessage([<statusByte>, <dataByte1>, <dataByte2>])
        returns midiMessage object or false with object error
    */
    this.parseMidiMessage = function(rawMidiMessage){

        /*
            input validation and error handling
            I was going to do a whole bunch of input validation
            here, but I realized I need this to be as fast as possible
            So, send me an array of 3 digit integers between 0 and 127.
            If you don't you're on your own.
        */

        var out = {
            raw:    rawMidiMessage
        }

        // parse the two nybbles from the status integers
        eightBitBuffer[0] = rawMidiMessage[0];
        var nybbleParser = nybble.bitBuffer(eightBitBuffer);
        out.channel = nybbleParser.readUnsigned(0, 4);
        out.midiMessage = nybbleParser.readUnsigned(4,4);

        // make sense of the midi message in context
        switch(midiMessage){
            case 8:
                out.messageType         = 'note off';
                out.noteNumber          = rawMidiMessage[1];
                out.noteName            = this.noteIndex.noteNames[rawMidiMessage[1]];
                out.velocity            = midiMessage[2];
                break;
            case 9:
                out.messageType         = 'note on',
                out.noteNumber          = rawMidiMessage[1],
                out.noteName            = this.noteIndex.noteNames[rawMidiMessage[1]];
                out.velocity            = rawMidiMessage[2];
                break;
            case 10:
                out.messageType         = 'aftertouch (polyphonic)';
                out.noteNumber          = rawMidiMessage[1];
                out.noteName            = this.noteIndex.noteNames[rawMidiMessage[1]];
                out.velocity            = rawMidiMessage[2];
                break;
            case 11:
                out.messageType         = 'control';
                out.controllerNumber    = rawMidiMessage[1];
                out.value               = rawMidiMessage[2];
                out.controlInfo         = _getControlInfo(rawMidiMessage[1], rawMidiMessage[2])
                break;
            case 12:
                out.messageType         = 'programChange';
                out.patchNumber         = rawMidiMessage[1];
                break;
            case 13:
                out.messageType         = 'aftertouch (monophonic)';
                out.velocity            = rawMidiMessage[1];
                break;
            case 14:
                out.messageType         = 'pitch bend';

                /*
                    LOOSE END
                    midi pitch bend is the most elegantly implemented kludge I've ever encountered.
                    it amounts to binary concatenation where byte 2 is the MSB (coarse value) and
                    byte 1 is the LSB (fine). Ya take byte two, and *literally* slap byte 1 on the
                    end of it, making a 14 bit unsigned integer (the leading bits on midi data bytes
                    are all 0's, that's where the other two bits went ... I'm sure this must have made
                    sense in the 80's). Thusly, no pitch bend (i.e. 'center') is a value of 8192
                    (decimal). Minimum bend (all the way down) is 0, and max bend (all the way up)
                    is 16383.

                    So here's the loose end. Javascript does not want to deal with a 14 bit unsigned
                    integer. At least I can't figure out how to do it with typed arrays and buffers
                    javascript wants everything to be 8, 16 or 32 bits. I toyed with trying to zero
                    pad a 16 bit integer, but I couldn't get it to work.

                    So, I present unto ye the most inefficient hack of all time.
                    I'm literally busting out each byte into an ascii string of 1's and 0's
                    then I'm zero padding them to make sure we have 7 bits each.
                    then I'm string concatenating them. then I'm converting back into an integer.
                    snicker all you want, bro. it at least works. w00t!
                */
                var lsb = (rawMidiMessage[1] >>> 0).toString(2);
                var msb = (rawMidiMessage[2] >>> 0).toString(2);
                while (lsb.length < 7){ lsb = "0" + lsb; }
                while (msb.length < 7){ msb = "0" + msb; }
                out.value = parseInt(msb + lsb, 3);
                break;
            case 15:
                out.messageType         = "sysex";
                /*
                    LOOSE END
                    trying to understand the spec is difficult
                    sysex is "channel-less", so the second nybble of the
                    status byte should be a manufacturer id code or something
                    just need to read up on this and understand it
                */
                break;
        }

    }

    /*
        makeMidiMessage(args)
    */


    // we out!
    return(this);
}

/*
    ########################
    ## private functions
    ########################
*/


/*
    _getDefaultNoteNames()
    returns an object containing an array of default note names (array index = node number)
    and an object of key/value pairs mapping note names to note numbers:
    {
        'noteNumbers'   => { 'C0': 0, 'C#0': 1, etc ...},
        'noteNames'     => ['C0', 'C#0', etc ...]
    }
*/
function _getDefaultNoteNames(){
    var retData = {
        'noteNumbers':  {},
        'noteNames':    []
    };
    var idx = 0;
    var noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    var noteIdx = 0;
    var octIdx = 0;
    while(idx <= 127){
        if (noteIdx > (noteNames.length - 1)){
            noteIdx = 0;
            octIdx ++;
        }
        retData.noteNames.push(noteNames[noteIdx] + "-" + octIdx);
        retData.noteNumbers[noteNames[noteIdx] + "-" + octIdx] = noteIdx;
        noteIdx ++;
        idx ++;
    }
    return(retData);
}


/*
    _getControlInfo(<dataByte1>, <dataByte2>)
    presuming we have a midi control message (status 11 on some channel or another)
    this looks at the remaining two data bytes and attempts to identify if this is
    a known message type (i.e. reserved by the spec).

    at some point in the future, we might want to want to make this user extensible
    so that one could register their own known control changes and maybe get
    an event or something yadda yadda ...

    returns an object containing information about a midi control message
*/
function _getControlInfo(byteOne, byteTwo) {
    var out = {
        channelMode = false;
    };

    // handle reserved channelMode messages
    if ((byteOne >= 120) && (byteOne <= 127)){
        switch (byteOne){
            case 120:
                if (byteTwo == 0){
                    out.controlName         = 'all sound off';
                    out.channelMode         = true;
                }
                break;
            case 121:
                out.controlName             = 'reset all controllers';
                out.channelMode             = true;
                break;
            case 122:
                switch (byteTwo) {
                    case 0:
                        out.controlName     = 'local control off';
                        out.channelMode     = true;
                        break;
                    case 127:
                        out.controlName     = 'local control on';
                        out.channelMode     = true;
                        break;
                    default:
                        out.controlName     = 'local control (unspecified)';
                        out.channelMode     = true;
                }
            case 123:
                if (byteTwo == 0){
                    out.controlName         = 'all notes off';
                    out.channelMode         = true;
                }
                break;
            case 124:
                if (byteTwo == 0){
                    out.controlName         = 'omni mode off';
                    out.channelMode         = true;
                }
                break;
            case 125:
                if (byteTwo == 0){
                    out.controlName         = 'omni mode on';
                    out.channelMode         = true;
                }
                break;
            case 126:
                if (byteTwo == 0){
                    out.controlName         = 'mono mode 0 (omni on)';
                    out.channelMode         = true;
                }else{
                    out.controlName         = 'mono mode (' + byteTwo + ')';
                    out.channelMode         = true;
                }
                break;
            case 127:
                if (byteTwo == 0){
                    out.controlName         = 'poly mode on';
                    out.channelMode         = true;
                }
        }
    // otherwise just look it up in the index and be done
    }else{
            out.controlName = controlNumbers[byteOne];
    }
    return(out);
}
