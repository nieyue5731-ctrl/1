class ParticlePool {
    constructor(maxSize = 500) {
        this.maxSize = maxSize;
        this.pool = [];
        this.active = [];
        this._createPool();
    }
    _createPool() {
        for (let i = 0; i < this.maxSize; i++) {
            this.pool.push({x:0, y:0, vx:0, vy:0, life:0, maxLife:0, color:'', size:0, active:false});
        }
    }
    spawn(x, y, vx, vy, color, size, life) {
        let particle = this.pool.length > 0 ? this.pool.pop() : null;
        // If pool empty and at capacity, recycle oldest active particle (O(1) swap-remove)
        if (!particle && this.active.length > 0) {
            particle = this.active[0];
            this.active[0] = this.active[this.active.length - 1];
            this.active.length--;
        }
        if (!particle) return null;
        particle.x = x; particle.y = y; particle.vx = vx; particle.vy = vy;
        particle.color = color; particle.size = size; particle.life = life;
        particle.maxLife = life; particle.active = true;
        this.active.push(particle);
        return particle;
    }
    update(dt) {
        // Swap-remove dead particles instead of O(n) splice
        let write = 0;
        for (let i = 0; i < this.active.length; i++) {
            const p = this.active[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
            if (p.life > 0) {
                this.active[write++] = p;
            } else {
                p.active = false;
                this.pool.push(p);
            }
        }
        this.active.length = write;
    }
    render(ctx, camX, camY) {
        for (const p of this.active) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - camX, p.y - camY, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }
}
window.TU.ParticlePool = ParticlePool;
