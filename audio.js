// All sound is synthesized with the Web Audio API - no external audio
// files to fetch, so it works fully offline.

class AudioManager {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.enabled = true;
        this.masterVolume = 0.5;
        this.musicPlaying = false;
        this._musicTimer = null;
    }

    init() {
        if (this.ctx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? this.masterVolume : 0;
        this.master.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.9;
        this.sfxGain.connect(this.master);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.35;
        this.musicGain.connect(this.master);
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    setEnabled(v) {
        this.enabled = v;
        if (this.master) this.master.gain.value = v ? this.masterVolume : 0;
    }

    setVolume(v) {
        this.masterVolume = v;
        if (this.master && this.enabled) this.master.gain.value = this.masterVolume;
    }

    _noiseBurst(duration, filterFreq, gain, destination) {
        const ctx = this.ctx;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(filter).connect(g).connect(destination);
        src.start();
        return src;
    }

    _tone(freq, duration, type, gain, destination, glideTo) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + duration);
        const g = ctx.createGain();
        g.gain.value = gain;
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(g).connect(destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    }

    playBreak(blockType) {
        if (!this.ctx || !this.enabled) return;
        const freq = blockType === 'stone' || blockType === 'cobblestone' ? 900 :
                     blockType === 'wood' || blockType === 'planks' ? 500 :
                     blockType === 'glass' ? 2200 : 700;
        this._noiseBurst(0.12, freq, 0.5, this.sfxGain);
    }

    playPlace(blockType) {
        if (!this.ctx || !this.enabled) return;
        this._noiseBurst(0.08, 500, 0.35, this.sfxGain);
    }

    playStep() {
        if (!this.ctx || !this.enabled) return;
        this._noiseBurst(0.05, 300, 0.15, this.sfxGain);
    }

    playSplash() {
        if (!this.ctx || !this.enabled) return;
        this._noiseBurst(0.3, 1500, 0.3, this.sfxGain);
    }

    playHurt() {
        if (!this.ctx || !this.enabled) return;
        this._tone(220, 0.25, 'sawtooth', 0.4, this.sfxGain, 110);
    }

    playDeath() {
        if (!this.ctx || !this.enabled) return;
        this._tone(300, 0.8, 'sawtooth', 0.4, this.sfxGain, 60);
    }

    playEat() {
        if (!this.ctx || !this.enabled) return;
        this._noiseBurst(0.15, 800, 0.3, this.sfxGain);
    }

    playPop() {
        if (!this.ctx || !this.enabled) return;
        this._tone(700, 0.1, 'sine', 0.3, this.sfxGain, 1100);
    }

    playCraft() {
        if (!this.ctx || !this.enabled) return;
        this._tone(500, 0.08, 'square', 0.2, this.sfxGain, 700);
        setTimeout(() => this._tone(700, 0.1, 'square', 0.2, this.sfxGain, 900), 60);
    }

    playAttack() {
        if (!this.ctx || !this.enabled) return;
        this._noiseBurst(0.1, 1200, 0.4, this.sfxGain);
    }

    playMobHurt(kind) {
        if (!this.ctx || !this.enabled) return;
        const freq = kind === 'zombie' ? 150 : 350;
        this._tone(freq, 0.2, 'triangle', 0.3, this.sfxGain, freq * 0.6);
    }

    playXp() {
        if (!this.ctx || !this.enabled) return;
        this._tone(800 + Math.random() * 400, 0.1, 'sine', 0.15, this.sfxGain);
    }

    playLevelUp() {
        if (!this.ctx || !this.enabled) return;
        this._tone(440, 0.15, 'square', 0.2, this.sfxGain);
        setTimeout(() => this._tone(554, 0.15, 'square', 0.2, this.sfxGain), 150);
        setTimeout(() => this._tone(659, 0.4, 'square', 0.2, this.sfxGain), 300);
    }

    startMusic() {
        if (!this.ctx || this.musicPlaying) return;
        this.musicPlaying = true;
        const notes = [261.6, 329.6, 392.0, 440.0, 523.3, 392.0, 329.6, 293.7];
        let i = 0;
        const playNext = () => {
            if (!this.musicPlaying) return;
            const freq = notes[i % notes.length];
            this._tone(freq, 2.2, 'sine', 0.18, this.musicGain);
            this._tone(freq / 2, 2.6, 'sine', 0.1, this.musicGain);
            i++;
            this._musicTimer = setTimeout(playNext, 1800 + Math.random() * 600);
        };
        playNext();
    }

    stopMusic() {
        this.musicPlaying = false;
        if (this._musicTimer) clearTimeout(this._musicTimer);
    }

    setRain(enabled) {
        if (!this.ctx || !this.enabled) return;
        if (enabled && !this._rainSrc) {
            const bufferSize = this.ctx.sampleRate * 2;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.3; // softer noise
            }
            this._rainSrc = this.ctx.createBufferSource();
            this._rainSrc.buffer = buffer;
            this._rainSrc.loop = true;
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 600; 
            
            this.rainGain = this.ctx.createGain();
            this.rainGain.gain.value = 0;
            this.rainGain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 2.0);
            
            this._rainSrc.connect(filter).connect(this.rainGain).connect(this.sfxGain);
            this._rainSrc.start();
        } else if (!enabled && this._rainSrc) {
            this.rainGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2.0);
            const src = this._rainSrc;
            setTimeout(() => {
                try { src.stop(); src.disconnect(); } catch (e) {}
            }, 2100);
            this._rainSrc = null;
            this.rainGain = null;
        }
    }
}

export const audio = new AudioManager();
