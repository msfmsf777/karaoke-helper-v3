/**
 * SoundTouchJS AudioWorklet Processor
 * 
 * Expected to be concatenated with soundtouch.js library code.
 */

class SoundTouchProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        // Buffer state
        this.bufferLength = 0;
        this.playing = false;

        // SoundTouch instance
        this.soundTouch = new SoundTouch();
        this.soundTouch.rate = 1.0;
        this.soundTouch.tempo = 1.0;
        this.soundTouch.pitch = 1.0;

        // Source adapter for SimpleFilter
        this.source = {
            extract: (target, numFrames, position) => {
                return this.pullSamples(target, numFrames, position);
            }
        };

        this.filter = new SimpleFilter(this.source, this.soundTouch);

        // Parameters
        this.tempo = 1.0;
        this.pitchSemitones = 0;

        this.instrVolume = 1.0;
        this.vocalVolume = 1.0;

        this.port.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'load') {
                this.loadBuffer(payload);
            } else if (type === 'play') {
                this.playing = true;
            } else if (type === 'pause') {
                this.playing = false;
                this.filter.clear();
            } else if (type === 'stop') {
                this.playing = false;
                this.filter.clear();
                this.soundTouch.clear();
                this.filter.sourcePosition = 0; // Reset position
                this.port.postMessage({ type: 'time', time: 0 });
            } else if (type === 'seek') {
                this.seek(payload);
            } else if (type === 'setPlaybackTransform') {
                this.updateTransform(payload);
            } else if (type === 'volumes') {
                this.instrVolume = payload.instr;
                this.vocalVolume = payload.vocal;
            }
        };
    }

    loadBuffer(payload) {
        this.instrLeft = payload.instrLeft;
        this.instrRight = payload.instrRight;
        this.vocalLeft = payload.vocalLeft;
        this.vocalRight = payload.vocalRight;

        this.bufferLength = 0;
        if (this.instrLeft) this.bufferLength = Math.max(this.bufferLength, this.instrLeft.length);
        if (this.vocalLeft) this.bufferLength = Math.max(this.bufferLength, this.vocalLeft.length);

        this.playing = false;
        this.filter.clear();
        this.soundTouch.clear();
        this.filter.sourcePosition = 0;

        this.port.postMessage({ type: 'loaded', duration: this.bufferLength / sampleRate });
    }

    seek(time) {
        let cursor = Math.floor(time * sampleRate);
        if (cursor < 0) cursor = 0;
        if (cursor >= this.bufferLength) cursor = this.bufferLength - 1;

        this.filter.clear();
        this.soundTouch.clear();
        this.filter.sourcePosition = cursor;
        this.port.postMessage({ type: 'time', time: cursor / sampleRate });
    }

    updateTransform({ speed, transpose }) {
        this.tempo = speed;
        this.pitchSemitones = transpose;

        this.soundTouch.tempo = this.tempo;
        this.soundTouch.pitch = Math.pow(2, this.pitchSemitones / 12.0);
    }

    pullSamples(target, numFrames, position) {
        // target is Float32Array (interleaved)
        // position is sample index

        let framesRead = 0;
        // target.length is usually numFrames * 2 (stereo)

        for (let i = 0; i < numFrames; i++) {
            const idx = position + i;

            if (idx >= this.bufferLength) {
                // End of buffer
                break;
            }

            const iL = this.instrLeft ? (this.instrLeft[idx] || 0) : 0;
            const iR = this.instrRight ? (this.instrRight[idx] || 0) : 0;
            const vL = this.vocalLeft ? (this.vocalLeft[idx] || 0) : 0;
            const vR = this.vocalRight ? (this.vocalRight[idx] || 0) : 0;

            // Mix
            const left = (iL * this.instrVolume) + (vL * this.vocalVolume);
            const right = (iR * this.instrVolume) + (vR * this.vocalVolume);

            target[i * 2] = left;
            target[i * 2 + 1] = right;

            framesRead++;
        }

        return framesRead;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const outputLength = output[0].length;

        if (this.bufferLength === 0 || !this.playing) {
            return true;
        }

        // Prepare a temp buffer for interleaved output
        // We reuse a buffer to avoid GC if possible, but for now new Float32Array is safer
        const tempBuffer = new Float32Array(outputLength * 2);

        const framesExtracted = this.filter.extract(tempBuffer, outputLength);

        if (framesExtracted > 0) {
            const leftOut = output[0];
            const rightOut = output.length > 1 ? output[1] : null;

            for (let i = 0; i < framesExtracted; i++) {
                leftOut[i] = tempBuffer[i * 2];
                if (rightOut) rightOut[i] = tempBuffer[i * 2 + 1];
            }
        }

        // Check for end
        if (framesExtracted < outputLength) {
            // If we couldn't extract enough, and we are at the end of source
            if (this.filter.sourcePosition >= this.bufferLength) {
                this.playing = false;
                this.port.postMessage({ type: 'ended' });
            }
        }

        if (currentTime % 0.1 < 0.01) {
            this.port.postMessage({ type: 'time', time: this.filter.sourcePosition / sampleRate });
        }

        return true;
    }
}

registerProcessor('soundtouch-processor', SoundTouchProcessor);
