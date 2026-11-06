shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, fog_disabled;
// Additive soft quad batch: floor pools, wall washes, lens flares / blinder halos, and the fake
// floor-reflection streaks. Colour*intensity comes from the MultiMesh instance colour; the
// instance colour's ALPHA is the sprite kind (set by fixtures.gd):
//   0 soft pool / wash     1 lens flare + halo (hot core, anamorphic streak)
//   2 floor reflection streak (bright at the hit end UV.y ~ 0.95, fading toward the camera)
//   3 uplight scallop on a wall (bright at the bottom edge)
// halo_boost > 1 widens the flare halo: the mobile tier has no screen-space glow, so the sprites
// carry the bloom themselves.
uniform float halo_boost = 1.0;
varying vec4 vc;
varying float sz;

float hash11(float p) {
	p = fract(p * 0.1031);
	p *= p + 33.33;
	p *= p + p;
	return fract(p);
}

void vertex() {
	vc = COLOR;
	sz = length(MODEL_MATRIX[0].xyz);
}

void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	int kind = int(vc.a + 0.5);
	vec3 col = vc.rgb;
	float m = max(col.r, max(col.g, col.b));
	vec3 hot_c = vec3(1.0, 0.86, 0.8);
	vec3 o = vec3(0.0);
	if (kind == 0) {
		float r = length(p);
		float a = exp(-r * r * 3.4) * (1.0 - smoothstep(0.6, 1.0, r));
		float h = pow(a, 7.0) * clamp(m - 0.5, 0.0, 2.0);
		o = col * a + hot_c * h * 0.55;
	} else if (kind == 1) {
		float hb = halo_boost;
		float r = length(p);
		float core = exp(-r * r * 90.0);
		float mid = exp(-r * r * (30.0 / hb));
		float tail = exp(-r * 6.0 / hb);
		float strk = exp(-abs(p.y) * 38.0) * exp(-abs(p.x) * 2.4) * smoothstep(0.5, 1.5, sz) * (1.0 - smoothstep(0.5, 1.0, abs(p.x)));
		float edge = 1.0 - smoothstep(0.7, 1.0, r);
		o = col * (mid * 0.5 + tail * 0.22) * edge + col * strk * 0.5;
		o += mix(col, hot_c * m, 0.85) * core * 1.6;
		o += hot_c * pow(core, 4.0) * clamp(m - 0.9, 0.0, 3.0);
	} else if (kind == 2) {
		float q = (0.94 - UV.y) / 0.94;
		float along = exp(-max(q, 0.0) * 2.8) * smoothstep(-0.12, 0.02, q);
		float wid = 16.0 - 9.0 * clamp(q, 0.0, 1.0);
		float across = exp(-p.x * p.x * wid);
		float wob = 0.8 + 0.4 * hash11(floor(UV.y * 46.0) + sz * 3.7);
		float a = along * across * wob * (1.0 + 1.6 * exp(-max(q, 0.0) * 12.0));
		o = col * a + hot_c * pow(across, 4.0) * exp(-max(q, 0.0) * 14.0) * clamp(m - 0.6, 0.0, 2.0) * 0.15;
	} else {
		float up = clamp(UV.y, 0.0, 1.0);
		float a = exp(-p.x * p.x * (1.6 + 5.5 * (1.0 - up))) * pow(up, 1.7) * (1.0 - smoothstep(0.85, 1.0, abs(p.x)));
		o = col * a;
	}
	ALBEDO = o;
	ALPHA = 1.0;
}
