shader_type spatial;
render_mode unshaded, cull_back, fog_disabled;
// Mirror ball. The sphere is cut into flat tiles (quantised facet normals, rows of equal height
// and a column count that shrinks toward the poles), each with a slightly different tilt and a
// thin dark grout between. Every tile mirrors the hall: its reflected ray is intersected with the
// hall box and shaded procedurally (red wall washes at the bay positions, ceiling truss lines,
// the stage screen, the deck). The spot beams that hit the ball add hot per-tile glints that
// flash as the ball turns. All driven by the song clock; the ball itself is rotated by stage.gd.
#include "res://shaders/stage_screen.gdshaderinc"

uniform float rows = 18.0;
uniform vec3 spot_pos[3];
uniform float spot_i[3];
uniform vec2 scr_res = vec2(96.0, 52.0);
uniform float beat = 0.0;
uniform float bar = 0.0;
uniform float energy = 0.3;
uniform float kick = 0.0;
uniform float down = 0.0;
uniform float build = 0.0;
uniform float mode = 2.0;
uniform float blk = 1.0;
uniform float lvl = 0.5;

varying vec3 vdir;
varying vec3 wpos;


void vertex() {
	vdir = normalize(VERTEX);
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

// tile centre direction (object space) for the tile containing d; cellf is the position inside it
vec3 facet(vec3 d, out vec2 cellf, out vec2 id) {
	float lat = asin(clamp(d.y, -1.0, 1.0));
	float fr = (lat + PI * 0.5) / PI * rows;
	float ri = min(floor(fr), rows - 1.0);
	float lat_c = ((ri + 0.5) / rows - 0.5) * PI;
	float step_a = PI / rows;
	float cols = max(floor(2.0 * PI * cos(lat_c) / step_a + 0.5), 3.0);
	float lon = atan(d.z, d.x);
	float fc = (lon / (2.0 * PI) + 0.5) * cols;
	float ci = min(floor(fc), cols - 1.0);
	cellf = vec2(fract(fc), fr - ri);
	id = vec2(ci, ri);
	float lon_c = ((ci + 0.5) / cols - 0.5) * 2.0 * PI;
	return vec3(cos(lat_c) * cos(lon_c), sin(lat_c), cos(lat_c) * sin(lon_c));
}

float blob(vec2 d, float s) {
	return exp(-dot(d, d) / s);
}

vec3 hall_env(vec3 P, vec3 R) {
	float t = 1e5;
	int face = 0;
	if (R.x > 0.001) {
		t = (6.95 - P.x) / R.x;
		face = 1;
	} else if (R.x < -0.001) {
		t = (-6.95 - P.x) / R.x;
		face = 1;
	}
	if (R.y > 0.001) {
		float ty = (9.0 - P.y) / R.y;
		if (ty < t) {
			t = ty;
			face = 2;
		}
	} else if (R.y < -0.001) {
		float yf = 0.0;
		float ty = (yf - P.y) / R.y;
		if (P.z + R.z * ty < -104.0) {
			ty = (1.2 - P.y) / R.y;
		}
		if (ty < t) {
			t = ty;
			face = 3;
		}
	}
	if (R.z > 0.001) {
		float tz = (11.9 - P.z) / R.z;
		if (tz < t) {
			t = tz;
			face = 4;
		}
	} else if (R.z < -0.001) {
		float tz = (-122.9 - P.z) / R.z;
		if (tz < t) {
			t = tz;
			face = 5;
		}
	}
	vec3 H = P + R * t;
	float L = 0.25 + 0.75 * lvl;
	vec3 red = vec3(1.0, 0.07, 0.05);
	vec3 col = vec3(0.006, 0.002, 0.003);
	float zone = smoothstep(-100.0, -108.0, H.z);
	// roaming rig hits on the walls
	float roam = 0.0;
	for (int k = 0; k < 4; k++) {
		float fk = float(k);
		vec2 c = vec2(-111.0 + 10.0 * sin(beat * 0.31 + fk * 1.7), 2.0 + 4.5 * abs(sin(beat * 0.2 + fk * 2.3)));
		roam += blob(vec2(H.z - c.x, H.y - c.y), 0.7);
	}
	if (face == 1) {
		float side = sign(R.x);
		float n = clamp(floor((-H.z - 4.0) / 8.0), 0.0, 11.0);
		float dz = H.z - (-8.0 - 8.0 * n);
		float want = 1.0;
		if (side < 0.0) {
			want = 0.0;
		}
		float on = 1.0 - abs(mod(n, 2.0) - want);
		float pool = blob(vec2(dz * 0.9, H.y - 2.9), 0.9) * on * step(H.z, -4.0) * step(-100.0, H.z);
		float cove = blob(vec2(0.0, H.y - 8.6), 0.1) * 0.15;
		col += red * (pool * 3.0 + cove) * L;
		col += red * zone * roam * 3.0 * lvl;
		col += red * zone * 0.12 * lvl;
		col += vec3(0.3, 0.02, 0.01) * smoothstep(0.55, 0.0, H.y) * 0.1;
	} else if (face == 2) {
		float rz = abs(mod(H.z + 4.6, 8.0) - 4.0);
		float cross_line = blob(vec2(rz * 4.0, 0.0), 0.5);
		float rail = blob(vec2((abs(H.x) - 3.6) * 4.0, 0.0), 0.5);
		float lamp = blob(vec2(abs(H.x) - 3.6, abs(mod(H.z + 8.0, 8.0) - 4.0) - 3.4), 0.4);
		col += red * (cross_line * 0.5 + rail * 0.4 + lamp * 3.5) * L * (1.0 - zone);
		// the stage rows: lit truss lines and a dot for every head
		float row_l = 0.0;
		float dots = 0.0;
		for (int k = 0; k < 3; k++) {
			float zr = -109.6 - 4.0 * float(k);
			row_l += blob(vec2((H.z - zr) * 3.0, 0.0), 0.6);
			float dx = mod(H.x + 0.95, 1.9) - 0.95;
			dots += blob(vec2(dx * 1.6, (H.z - zr) * 1.6), 0.25);
		}
		col += red * zone * (row_l * 0.9 + dots * 3.5 * (0.4 + 0.6 * kick)) * (0.3 + 0.7 * lvl);
	} else if (face == 3) {
		float deck = smoothstep(-103.0, -105.0, H.z);
		float pools = 0.0;
		for (int k = 0; k < 3; k++) {
			float zr = -111.0 - 3.0 * float(k) + 1.5 * sin(beat * 0.5 + float(k));
			float dx = mod(H.x + 0.95, 1.9) - 0.95;
			pools += blob(vec2(dx * 1.3, (H.z - zr) * 1.2), 0.4);
		}
		col += red * deck * (pools * 3.0 + 0.1) * (0.3 + 0.7 * lvl);
		col += red * blob(vec2(H.x * 0.25, (H.z + 122.0) * 0.5), 1.0) * deck * lvl * 0.8;
		col += red * blob(vec2(abs(H.x) - 5.0, abs(mod(H.z + 8.0, 8.0) - 4.0) - 3.0), 1.4) * 0.9 * L * (1.0 - deck);
	} else if (face == 4) {
		float neon = step(abs(H.x), 4.5) * step(abs(H.y - 6.2), 0.5);
		col += red * (neon * 2.5 + 0.03) * L;
	} else {
		vec2 su = vec2((H.x + 5.8) / 11.6, (H.y - 2.1) / 6.4);
		float inside = step(0.0, su.x) * step(su.x, 1.0) * step(0.0, su.y) * step(su.y, 1.0);
		if (inside > 0.5) {
			col += st_screen(su, scr_res * 0.5, beat, bar, energy, kick, down, build, mode, blk) * 1.2;
		} else {
			col += red * 0.15 * lvl;
		}
	}
	// things get dimmer the farther away they are
	col *= 1.0 / (1.0 + t * 0.004);
	return col;
}

void fragment() {
	vec3 d = normalize(vdir);
	vec2 cf;
	vec2 id;
	vec3 fc = facet(d, cf, id);
	float h1 = st_h(id + vec2(3.7, 1.3));
	float h2 = st_h(id + vec2(8.1, 5.9));
	float h3 = st_h(id + vec2(1.9, 9.4));
	// each tile is tilted a little differently
	vec3 jn = normalize(fc + (vec3(h1, h2, h3) - 0.5) * 0.3);
	vec3 nw = normalize(mat3(MODEL_MATRIX) * jn);
	vec3 cam = INV_VIEW_MATRIX[3].xyz;
	vec3 I = normalize(wpos - cam);
	vec3 R = reflect(I, nw);
	vec3 env = hall_env(wpos, R);
	float fres = pow(1.0 - clamp(dot(nw, -I), 0.0, 1.0), 2.0);
	env = pow(max(env - 0.03, vec3(0.0)), vec3(1.2));
	vec3 col = env * (1.3 + 1.6 * fres) * (0.5 + 1.0 * h3) + vec3(0.03, 0.006, 0.008) * (0.4 + h2);
	col += vec3(0.5, 0.2, 0.18) * pow(fres, 2.5) * (0.12 + 0.5 * lvl);
	// spot beams: lit tiles brighten, and a tile whose mirror image of the spot points at the
	// camera flashes
	for (int k = 0; k < 3; k++) {
		vec3 Lin = normalize(wpos - spot_pos[k]);
		float lit = max(dot(nw, -Lin), 0.0);
		vec3 Rs = reflect(Lin, nw);
		float g = smoothstep(0.93, 0.99, dot(Rs, -I));
		float on = spot_i[k];
		col += vec3(1.0, 0.1, 0.07) * lit * lit * on * 0.55 * (0.2 + 1.4 * h1 * h1);
		col += vec3(1.0, 0.62, 0.52) * g * on * 5.0;
	}
	// grout
	float tw = PI / rows;
	float ed = min(min(cf.x, 1.0 - cf.x), min(cf.y, 1.0 - cf.y)) * tw;
	float fw = fwidth(ed);
	float tile = smoothstep(0.012 * 0.5, 0.012 * 0.5 + max(fw, 0.004), ed);
	col = mix(vec3(0.004, 0.0015, 0.002), col, tile);
	ALBEDO = col;
}
