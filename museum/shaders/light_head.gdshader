shader_type spatial;
render_mode unshaded, cull_back, fog_disabled;
// Moving-head / profile-spot body. One mesh: barrel, rear cap, lens (UV.y = 1) and a yoke with a
// stem (UV.x = 1). The yoke only follows the head's yaw, like the real hardware: it is rebuilt in a
// yaw-only frame from the instance basis. Lit by hand (the room has almost no ambient): a cool
// top key, a red rim from the room's own light, and the lens glows with the instance colour.
uniform float room = 0.4;
varying float lens;

void vertex() {
	lens = UV.y;
	if (UV.x > 0.5) {
		mat3 b = mat3(normalize(MODEL_MATRIX[0].xyz), normalize(MODEL_MATRIX[1].xyz), normalize(MODEL_MATRIX[2].xyz));
		vec3 zc = MODEL_MATRIX[2].xyz;
		vec3 bz = normalize(vec3(zc.x, 0.0, zc.z) + vec3(0.0, 0.0, 0.0001));
		vec3 by = vec3(0.0, 1.0, 0.0);
		vec3 bx = cross(by, bz);
		VERTEX = transpose(b) * (bx * VERTEX.x + by * VERTEX.y + bz * VERTEX.z);
		NORMAL = transpose(b) * (bx * NORMAL.x + by * NORMAL.y + bz * NORMAL.z);
	}
}

void fragment() {
	vec3 n = normalize(NORMAL);
	vec3 v = normalize(VIEW);
	if (lens > 0.5) {
		vec3 c = COLOR.rgb;
		float m = max(c.r, max(c.g, c.b));
		float face = pow(clamp(dot(n, v), 0.0, 1.0), 0.6);
		ALBEDO = vec3(0.02) + c * (1.5 + 2.0 * face) + vec3(1.0, 0.85, 0.8) * clamp(m - 0.6, 0.0, 2.0) * face;
	} else {
		vec3 up = normalize((VIEW_MATRIX * vec4(0.15, 1.0, 0.25, 0.0)).xyz);
		float key = max(dot(n, up), 0.0);
		float fr = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.5);
		float spec = pow(max(dot(reflect(-up, n), v), 0.0), 18.0);
		vec3 base = vec3(0.045, 0.047, 0.055);
		ALBEDO = base * (0.35 + 0.9 * key) + vec3(0.3, 0.04, 0.035) * fr * room + vec3(0.5, 0.5, 0.55) * spec * 0.18 + vec3(0.02, 0.025, 0.035) * fr;
	}
}
