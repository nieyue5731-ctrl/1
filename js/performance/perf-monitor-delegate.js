window.PERF_MONITOR = {
    record(ft) { if (window.PerfMonitor) window.PerfMonitor.frame(performance.now()); },
    getAverageFPS() { return window.PerfMonitor ? window.PerfMonitor.getAverageFPS() : 60; }
};
