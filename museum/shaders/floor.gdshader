shader_type spatial;
render_mode cull_back;
// Polished veined marble in 2 m slabs: procedural noise veins, micro normal, sheen at grazing angles.
uniform sampler2D tx : repeat_enable, filter_linear_mipmap;
uniform sampler2D tn : repeat_enable, filter_linear_mipmap;
varying vec3 wp;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 p = wp.xz;
	vec2 cell = floor(p / 2.0);
	float th = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
	vec2 o = vec2(th, fract(th * 7.0));
	float n1 = texture(tx, p * 0.05 + o).r;
	float n2 = texture(tx, p * 0.12 + o * 3.0 + 0.37).r;
	float vein = pow(1.0 - abs(n1 * 2.0 - 1.0), 10.0);
	float vein2 = pow(1.0 - abs(n2 * 2.0 - 1.0), 16.0);
	vec3 base = mix(vec3(0.035, 0.04, 0.065), vec3(0.085, 0.09, 0.125), n2 * 0.7 + th * 0.3);
	vec3 col = base + vec3(0.28, 0.29, 0.33) * (vein * 0.28 + vein2 * 0.2);
	vec2 f = abs(fract(p / 2.0) - 0.5);
	float seam = smoothstep(0.492, 0.5, max(f.x, f.y));
	col = mix(col, vec3(0.015), seam * 0.8);
	ALBEDO = col;
	ROUGHNESS = mix(0.05, 0.22, n2 * 0.6);
	METALLIC = 0.15;
	SPECULAR = 0.9;
	NORMAL_MAP = texture(tn, p * 0.35).rgb;
	NORMAL_MAP_DEPTH = 0.2;
	float fr = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	EMISSION = vec3(0.04, 0.05, 0.09) * (0.4 + 3.0 * fr) + col * 0.25;
}
