shader_type spatial;
render_mode cull_back;
// Fluted stone column (flutes from the object-space angle).
varying float ang;
varying float hy;
void vertex() {
	ang = atan(VERTEX.z, VERTEX.x);
	hy = VERTEX.y;
}
void fragment() {
	float fl = 0.5 + 0.5 * cos(ang * 16.0);
	float groove = smoothstep(0.0, 0.5, fl);
	vec3 stone = vec3(0.34, 0.32, 0.33) * (0.55 + 0.45 * groove);
	stone *= 0.85 + 0.15 * smoothstep(-4.5, 4.5, hy);
	ALBEDO = stone;
	ROUGHNESS = 0.45;
	EMISSION = stone * 0.3;
}
