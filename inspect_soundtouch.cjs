
global.window = global;
global.self = global;
global.define = undefined; // Disable AMD
global.module = { exports: {} };
global.exports = global.module.exports;

const fs = require('fs');
const path = require('path');

// Load the library
const SoundTouchAPI = require('./node_modules/soundtouchjs/dist/soundtouch.js');

// Check what we got
console.log('Loaded API:', SoundTouchAPI);

// If it exported SoundTouch directly or as a property
const SoundTouch = SoundTouchAPI.SoundTouch || SoundTouchAPI;
const SimpleFilter = SoundTouchAPI.SimpleFilter || global.SimpleFilter;

// Inspect SoundTouch
if (typeof SoundTouch !== 'undefined') {
    const lines = [];
    lines.push('SoundTouch found');
    const st = new SoundTouch();
    lines.push('Methods on prototype:');
    Object.getOwnPropertyNames(Object.getPrototypeOf(st)).forEach(k => lines.push(' - ' + k));
    lines.push('Properties on instance:');
    Object.getOwnPropertyNames(st).forEach(k => lines.push(' - ' + k));

    if (typeof SimpleFilter !== 'undefined') {
        lines.push('SimpleFilter found');
        const sf = new SimpleFilter(null, st);
        lines.push('Methods on SimpleFilter prototype:');
        Object.getOwnPropertyNames(Object.getPrototypeOf(sf)).forEach(k => lines.push(' - ' + k));
    }

    fs.writeFileSync('inspect_output.txt', lines.join('\n'));
} else {
    fs.writeFileSync('inspect_output.txt', 'SoundTouch NOT found');
}
