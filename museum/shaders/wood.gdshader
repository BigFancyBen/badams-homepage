shader_type spatial;
render_mode cull_back;
// Dark walnut with long grain, for plaque stands.
uniform sampler2D tx : repeat_enable, filter_linear_mipmap;
uniform sampler2D tn : repeat_enable, filter_linear_mipmap;
varying vec3 wp;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	float g1 = texture(tx, vec2((wp.x + wp.z) * 0.05, wp.y * 1.3 + (wp.x - wp.z) * 0.2)).r;
	float g2 = texture(tx, vec2((wp.x + wp.z) * 0.02, wp.y * 6.0)).r;
	vec3 wood = mix(vec3(0.07, 0.03, 0.015), vec3(0.2, 0.1, 0.05), g1) * (0.8 + 0.4 * g2);
	ALBEDO = wood;
	ROUGHNESS = 0.45;
	SPECULAR = 0.6;
	EMISSION = wood * 0.5;
}
