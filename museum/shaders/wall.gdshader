shader_type spatial;
render_mode cull_disabled;
// Plaster above, panelled dark-wood wainscot below, brass dado rail, faint panel seams.
uniform sampler2D tx : repeat_enable, filter_linear_mipmap;
uniform sampler2D tn : repeat_enable, filter_linear_mipmap;
varying vec3 wp;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	float u = wp.z + wp.x;
	vec2 uv = vec2(u, wp.y) * 0.1;
	float n = texture(tx, uv).r;
	float n2 = texture(tx, uv * 5.0).r;
	vec3 plaster = vec3(0.2, 0.19, 0.23) * (0.75 + 0.5 * n) * (0.9 + 0.2 * n2);
	float seam = smoothstep(0.0, 0.03, abs(fract(u / 4.0) - 0.5) - 0.485 + 0.03);
	plaster *= mix(0.8, 1.0, seam);
	plaster *= mix(1.0, 0.7, smoothstep(5.0, 9.0, wp.y));
	// wood wainscot
	float grain = texture(tx, vec2(u * 0.4, wp.y * 6.0) * 0.1).r;
	vec3 wood = vec3(0.13, 0.065, 0.045) * (0.7 + 0.6 * grain);
	float panel = smoothstep(0.0, 0.03, abs(fract(u / 2.0) - 0.5) - 0.44);
	wood *= mix(0.55, 1.0, panel);
	float wains = 1.0 - smoothstep(1.06, 1.1, wp.y);
	vec3 base = mix(plaster, wood, wains);
	float rail = smoothstep(0.035, 0.0, abs(wp.y - 1.13));
	base = mix(base, vec3(0.75, 0.55, 0.2), rail);
	ALBEDO = base;
	ROUGHNESS = mix(0.85, 0.35, wains);
	NORMAL_MAP = texture(tn, uv * 6.0).rgb;
	NORMAL_MAP_DEPTH = 0.4;
	EMISSION = base * 0.65;
}
