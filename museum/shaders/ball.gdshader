shader_type spatial;
render_mode unshaded, cull_back, fog_disabled;
// Mirror ball: faceted cells in object space that twinkle on the beat.
uniform float beat = 0.0;
uniform vec3 tint = vec3(1.0, 0.6, 0.9);
varying vec3 on;
void vertex() {
	on = NORMAL;
}
void fragment() {
	vec3 cell = floor(on * 9.0);
	float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
	float tw = step(0.82, fract(h * 13.0 + beat * (0.4 + h)));
	vec3 base = vec3(0.16, 0.18, 0.24) * (0.5 + 1.1 * h);
	ALBEDO = base + mix(vec3(1.0), tint, 0.5) * tw * 0.85;
}
