// Stage LED screen pattern, shared by the screen, the booth panel, the deck reflection and the
// mirror ball's reflection of the back wall. A pure function of the song clock values passed in.
// uv: x 0..1 left to right, y 0..1 bottom to top. mode: 0 idle (early break), 1 intro/outro,
// 2 groove, 3 build (last 4 bars of the break), 4 drop.

float st_h(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float st_digit(int d, vec2 p) {
	float t = 0.17;
	float a = step(1.0 - t, p.y);
	float g = step(abs(p.y - 0.5), t * 0.5);
	float dd = step(p.y, t);
	float f = step(p.x, t) * step(0.5, p.y);
	float b = step(1.0 - t, p.x) * step(0.5, p.y);
	float e = step(p.x, t) * step(p.y, 0.5);
	float c = step(1.0 - t, p.x) * step(p.y, 0.5);
	float m = a + b + c + dd + e + f;
	if (d == 1) {
		m = b + c;
	} else if (d == 2) {
		m = a + b + g + e + dd;
	} else if (d == 3) {
		m = a + b + g + c + dd;
	} else if (d == 4) {
		m = f + g + b + c;
	}
	return clamp(m, 0.0, 1.0) * step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
}

vec3 st_ramp(float v) {
	v = max(v, 0.0);
	vec3 c = vec3(0.55, 0.0, 0.015) * smoothstep(0.0, 0.35, v);
	c += vec3(1.0, 0.04, 0.03) * smoothstep(0.2, 0.75, v) * 1.2;
	c += vec3(1.0, 0.45, 0.35) * smoothstep(0.95, 1.5, v) * 0.9;
	return c;
}

vec3 st_screen(vec2 uv, vec2 res, float beat, float bar, float energy, float kick, float down, float build, float mode, float blk) {
	vec2 q = (floor(uv * res) + 0.5) / res;
	float asp = res.x / res.y;
	vec2 c = (q - 0.5) * vec2(asp * 0.54, 1.0);
	float ph = floor(bar);
	float pm = mod(ph, 4.0);
	float drop = step(3.5, mode);
	float bld = step(2.5, mode) * (1.0 - drop);
	float grv = step(1.5, mode) * (1.0 - step(2.5, mode));
	float intro = step(0.5, mode) * (1.0 - step(1.5, mode));
	float idle = 1.0 - step(0.5, mode);
	float px = floor(uv.x * res.x);

	// equaliser columns, 3 pixels wide with a gap
	float col = floor(px / 3.0);
	float gapm = 1.0 - step(1.5, mod(px, 3.0));
	float r1 = st_h(vec2(col, 3.0));
	float r2 = st_h(vec2(col, 9.0));
	float amp = 0.18 + 0.5 * abs(sin(beat * (0.35 + r1 * 0.5) * 3.1416 + r2 * 6.2832));
	amp = amp * (0.55 + 0.7 * energy) + kick * 0.3 * r2;
	float eq = step(q.y, amp) * gapm * (0.75 + 0.25 * step(0.5, fract(q.y * res.y * 0.25)));
	eq += step(abs(q.y - amp - 0.02), 0.012) * gapm * 1.2;

	// chevrons marching up
	float cd = q.y * 1.3 + abs(c.x) * 0.9;
	float spd = 0.5 + 1.5 * build * bld;
	float ch = step(0.62, fract(cd * 3.5 - beat * 0.25 * spd)) * (1.0 - clamp(eq, 0.0, 1.0));
	float chd = step(0.62, fract((1.0 - q.y) * 1.3 * 3.5 + abs(c.x) * 3.2 - beat * 0.25)) * (1.0 - clamp(eq, 0.0, 1.0));

	// rings off the centre on the kick
	float rr = length(c);
	float rg = step(0.55, fract(rr * 4.0 - beat * 0.5)) * smoothstep(0.85, 0.15, rr);
	rg += step(abs(rr - fract(bar * 4.0) * 1.1), 0.03) * 1.2;

	// wipe: a bright column sweeping on each bar
	float wx = fract(bar);
	wx = wx * wx * (3.0 - 2.0 * wx);
	float wp = step(abs(q.x - wx), 0.035 + 0.02 * down) + step(q.x, wx) * step(wx - 0.3, q.x) * 0.25;

	// checker hits
	float chk = step(0.5, mod(floor(q.x * 12.0) + floor(q.y * 7.0) + floor(beat * 2.0), 2.0));

	float v = 0.0;
	float dp0 = 1.0 - step(0.5, pm);
	float dp1 = step(0.5, pm) * (1.0 - step(1.5, pm));
	float dp2 = step(1.5, pm) * (1.0 - step(2.5, pm));
	float dp3 = step(2.5, pm);
	v += drop * (dp0 * (eq * 0.95 + ch * 0.45) + dp1 * (rg * 0.9 + wp * 0.9 + chk * 0.25 * down) + dp2 * (ch * 0.7 + chd * 0.7 + chk * 0.35 * kick + eq * 0.3) + dp3 * (eq * 0.9 + wp * 1.0 + chk * 0.2));
	v += grv * (eq * 0.6 + ch * 0.35 + rg * 0.2 + wp * 0.3);
	v += intro * (rg * 0.45 + eq * 0.25);
	v += idle * (rg * 0.22 + step(abs(q.y - fract(beat * 0.02)), 0.01) * 0.5);
	v += bld * (ch * (0.15 + 0.5 * build) + eq * (0.1 + 0.35 * build) * step(q.y, 0.2 + 0.8 * build));

	// build: big seven-segment countdown 4 3 2 1 and a progress bar
	float dg = clamp(4.0 - floor(build * 3.999), 1.0, 4.0);
	vec2 dp = (q - vec2(0.5 - 0.09, 0.3)) / vec2(0.18, 0.4);
	float dgm = st_digit(int(dg), dp);
	float pulse = 0.55 + 0.45 * exp(-fract(beat) * 3.0);
	v += bld * dgm * (0.7 + 0.5 * pulse);
	v *= 1.0 - bld * 0.55 * (1.0 - dgm) * step(abs(dp.x - 0.5), 0.75) * step(abs(dp.y - 0.5), 0.65);
	float pb = step(q.y, 0.07) * step(0.04, q.y) * step(q.x, 0.06 + 0.88 * build) * step(0.06, q.x);
	pb += step(q.y, 0.07) * step(0.04, q.y) * step(0.06, q.x) * step(q.x, 0.94) * 0.12;
	v += bld * pb * 0.9;

	// downbeat hits
	float hit = down * (drop * 0.5 + grv * 0.12 + bld * 0.2);
	v += hit * (0.4 + 0.6 * st_h(vec2(floor(q.y * 26.0), floor(bar))));
	// the bar-8 stutter on the drop
	float stut = drop * step(6.5, mod(ph, 8.0)) * step(fract(bar * 8.0), 0.4);
	v = mix(v, 1.2, stut * 0.55);
	v += kick * 0.08 * (grv + drop);
	v *= (0.35 + 0.65 * energy + 0.1 * drop) * blk;
	return st_ramp(v);
}
