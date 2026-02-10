// Safe utilities for robust code
// Only define simple safe helpers if more robust versions haven't been
// provided by TU_Defensive. These fallbacks are intentionally minimal and
// should not override the enhanced implementations (e.g. those bound to
// BoundaryChecks or SafeAccess) defined earlier. If `window.safeGet` or
// other helpers already exist, we leave them intact.
if (typeof window.safeGet === 'undefined') {
    window.safeGet = function(arr, index, defaultValue) {
        if (!arr || index < 0 || index >= arr.length) return defaultValue;
        return arr[index];
    };
}
if (typeof window.safeGetProp === 'undefined') {
    window.safeGetProp = function(obj, prop, defaultValue) {
        if (!obj || typeof obj !== 'object') return defaultValue;
        return obj[prop] !== undefined ? obj[prop] : defaultValue;
    };
}
if (typeof window.safeJSONParse === 'undefined') {
    window.safeJSONParse = function(str, defaultValue) {
        try { return JSON.parse(str); } catch (e) { return defaultValue; };
    };
}
if (typeof window.clamp === 'undefined') {
    window.clamp = function(v, min, max) {
        return Math.max(min, Math.min(max, v));
    };
}
if (typeof window.lerp === 'undefined') {
    window.lerp = function(a, b, t) {
        return a + (b - a) * t;
    };
}

// Ring buffer for input prediction
class RingBuffer {
    constructor(size) {
        this.size = size;
        this.buffer = new Array(size);
        this.head = 0;
        this.count = 0;
    }
    push(item) {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.size;
        if (this.count < this.size) this.count++;
    }
    get(index) {
        if (index < 0 || index >= this.count) return null;
        const i = (this.head - this.count + index + this.size) % this.size;
        return this.buffer[i];
    }
    clear() {
        this.head = 0;
        this.count = 0;
    }
}
window.RingBuffer = RingBuffer;

