
(function () {
  'use strict';

  if (!window.TU || !window.TU.Game || !window.TU.Game.prototype) return;

  const proto = window.TU.Game.prototype;
  if (proto.__TU_FINAL_SPREADLIGHT_PATCHED__) return;

  const _orig = proto._spreadLight;

  proto._spreadLight = function (sx, sy, level) {
    try {
      const world = this.world;
      if (!world || !world.tiles || !world.light) {
        if (typeof _orig === 'function') return _orig.call(this, sx, sy, level);
        return;
      }

      const w = world.w | 0;
      const h = world.h | 0;
      if (w <= 0 || h <= 0) {
        if (typeof _orig === 'function') return _orig.call(this, sx, sy, level);
        return;
      }

      const tiles = world.tiles;
      const light = world.light;

      // SOLID lookup table（优先使用 TU.BLOCK_SOLID）
      const SOLID = (window.TU && window.TU.BLOCK_SOLID) || window.BLOCK_SOLID;
      const solidArr = (SOLID && typeof SOLID.length === 'number') ? SOLID : null;
      if (!solidArr) {
        if (typeof _orig === 'function') return _orig.call(this, sx, sy, level);
        return;
      }

      // 访问标记数组（避免 Set 分配）
      const size = w * h;
      if (!this._lightVisited || this._lightVisited.length !== size) {
        this._lightVisited = new Uint32Array(size);
        this._lightVisitMark = 1;
      }
      let mark = (++this._lightVisitMark) >>> 0;
      if (mark === 0) {
        this._lightVisited.fill(0);
        mark = 1;
        this._lightVisitMark = 1;
      }
      const visited = this._lightVisited;

      const qx = this._lightQx || (this._lightQx = []);
      const qy = this._lightQy || (this._lightQy = []);
      const ql = this._lightQl || (this._lightQl = []);
      qx.length = 0; qy.length = 0; ql.length = 0;

      sx = sx | 0;
      sy = sy | 0;
      level = level | 0;
      if (level <= 0) return;

      qx.push(sx); qy.push(sy); ql.push(level);

      let head = 0;
      while (head < qx.length) {
        const x = qx[head] | 0;
        const y = qy[head] | 0;
        const l = ql[head] | 0;
        head++;

        if (l <= 0 || x < 0 || x >= w || y < 0 || y >= h) continue;

        const idx = x + y * w;
        if (visited[idx] === mark) continue;
        visited[idx] = mark;

        const colL = light[x];
        if (!colL) continue;
        if (l > colL[y]) colL[y] = l;

        const colT = tiles[x];
        if (!colT) continue;
        const id = colT[y] | 0;

        const nl = l - (solidArr[id] ? 2 : 1);
        if (nl > 0) {
          qx.push(x - 1, x + 1, x, x);
          qy.push(y, y, y - 1, y + 1);
          ql.push(nl, nl, nl, nl);
        }

        // Hard cap: prevent runaway queue growth
        if (qx.length > 12000) break;
      }
    } catch (e) {
      try { if (typeof _orig === 'function') return _orig.call(this, sx, sy, level); } catch (_) {}
    }
  };

  proto.__TU_FINAL_SPREADLIGHT_PATCHED__ = true;
  console.log('🛠️ Final SpreadLight Patch Applied (safe)');
})();

