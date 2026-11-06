shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, fog_disabled;
// Beam shaft: unit cone (apex at -Y/2 after the instance basis; vt runs 0 at the lens to 1 at the
// far end). Soft silhouette from the view angle, hot core near the lens, distance falloff, a
// fade over the last stretch (so a beam never paints over the picture it lands on) and a haze
// of scrolling 3D value noise in world space. No depth texture. Colour*intensity is the
// instance colour. t (song seconds) is set by show.gd; noise_oct 0 = flat, 1 = cheap (mobile).
uniform float edge_pow = 1.7;
uniform float t = 0.0;
uniform int noise_oct = 2;
varying vec4 vc;
varying float vt;
varying vec3 wp;

float h3(vec3 p) {
	p = fract(p * 0.3183099 + 0.1);
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec3 x) {
	vec3 i = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y),
		f.z);
}

void vertex() {
	vc = COLOR;
	vt = clamp(0.5 - VERTEX.y, 0.0, 1.0);
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float f = abs(dot(normalize(NORMAL), normalize(VIEW)));
	float edge = pow(f, edge_pow);
	float fall = 1.8 * exp(-vt * 1.5) * (1.0 - smoothstep(0.8, 1.0, vt));
	float core = exp(-vt * 9.0) * 2.2;
	float haze = 1.0;
	if (noise_oct > 0) {
		vec3 q = wp * 0.55 + vec3(0.0, -t * 0.22, t * 0.13);
		float n = vnoise(q);
		if (noise_oct > 1) {
			n = n * 0.65 + 0.35 * vnoise(q * 2.7 + vec3(t * 0.3, 0.0, 3.1));
		}
		haze = 0.45 + 1.1 * n;
	}
	float near = smoothstep(0.4, 3.5, length(VERTEX));
	float a = edge * (fall * haze + core * edge) * smoothstep(0.0, 0.05, vt) * near;
	vec3 c = vc.rgb;
	float m = max(c.r, max(c.g, c.b));
	ALBEDO = c * a + vec3(1.0, 0.8, 0.75) * (core * edge * edge * clamp(m - 0.25, 0.0, 1.0) * 0.5);
	ALPHA = 1.0;
}
