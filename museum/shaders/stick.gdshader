shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, fog_disabled;
// Laser: a flat ribbon (unit quad in XZ, Z along the beam) that always faces the camera, with a
// pixel-sized gaussian core (so it never aliases to a 1 px line), a wider glow and a faint haze
// sheet around it. The instance basis gives axis (Z) and length; X scale is the nominal width.
varying vec4 vc;
varying float px;     // half-width of the core in world units, 1 px at this distance
varying float lenm;

void vertex() {
	vc = COLOR;
	vec3 c = MODEL_MATRIX[3].xyz;
	vec3 zc = MODEL_MATRIX[2].xyz;
	lenm = length(zc);
	vec3 a = zc / lenm;
	float w = length(MODEL_MATRIX[0].xyz);
	vec3 pw = c + a * (VERTEX.z * lenm);
	vec3 to = pw - CAMERA_POSITION_WORLD;
	float dist = max(length(to), 0.1);
	px = max(w * 0.5, dist * 0.0021);
	vec3 side = cross(a, to / dist);
	side = side / max(length(side), 0.0001);
	pw += side * (VERTEX.x * 2.0) * px * 14.0;
	POSITION = PROJECTION_MATRIX * (VIEW_MATRIX * vec4(pw, 1.0));
}

void fragment() {
	float x = abs(UV.x * 2.0 - 1.0) * 14.0;
	float core = exp(-x * x * 0.55);
	float glow = exp(-x * 0.55) * 0.3;
	float haze = exp(-x * 0.22) * (1.0 - smoothstep(9.0, 14.0, x)) * 0.1;
	float along = UV.y * lenm;
	float shim = 0.85 + 0.15 * sin(along * 1.7 + vc.r * 40.0);
	float ends = smoothstep(0.0, 0.25, along) * smoothstep(0.0, 0.25, lenm - along);
	vec3 c = vc.rgb;
	float m = max(c.r, max(c.g, c.b));
	vec3 hot = mix(c, vec3(1.0, 0.82, 0.78) * m, 0.65);
	ALBEDO = (hot * core * 1.8 + c * (glow + haze * shim)) * ends;
	ALPHA = 1.0;
}
