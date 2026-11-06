shader_type spatial;
render_mode cull_back;
// Coffered ceiling: recessed square panels, raised ribs, gilded inner moulding.
varying vec3 wp;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 f = fract(wp.xz / 3.0);
	vec2 e = min(f, 1.0 - f);
	float edge = min(e.x, e.y);
	float recess = smoothstep(0.07, 0.11, edge);
	float bevel = smoothstep(0.11, 0.07, edge) * smoothstep(0.0, 0.04, edge);
	vec3 rib = vec3(0.2, 0.19, 0.23);
	vec3 inner = vec3(0.07, 0.07, 0.11) * (0.8 + 0.4 * (1.0 - edge * 2.0));
	vec3 col = mix(rib, inner, recess);
	col = mix(col, vec3(0.7, 0.5, 0.18), smoothstep(0.012, 0.0, abs(edge - 0.1)));
	col *= 1.0 - bevel * 0.25;
	ALBEDO = col;
	ROUGHNESS = 0.8;
	EMISSION = col * 0.35;
}
