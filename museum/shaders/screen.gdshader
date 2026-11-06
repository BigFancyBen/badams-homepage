shader_type spatial;
render_mode unshaded, cull_disabled, fog_disabled;
// Stage LED screen: animated red pattern (rings, sweeping bar, pixel grid), driven by song beat.
uniform float beat = 0.0;
uniform float energy = 0.3;
uniform float kick = 0.0;
void fragment() {
	vec2 uv = UV;
	vec2 p = (uv - 0.5) * vec2(1.85, 1.0);
	float r = length(p);
	float rings = 0.5 + 0.5 * sin(r * 16.0 - beat * 3.14159 * (0.5 + energy));
	float core = smoothstep(0.7, 0.0, r);
	float sweep = smoothstep(0.08, 0.0, abs(fract(beat * 0.125) - uv.x));
	float cols = 0.5 + 0.5 * sin(uv.x * 40.0 + beat * 2.0 * energy + sin(uv.y * 6.0 + beat));
	float v = rings * core * 0.8 + sweep * 0.7 + cols * 0.12 * energy + kick * 0.25 * core;
	vec2 g = fract(uv * vec2(112.0, 60.0));
	float px = smoothstep(0.0, 0.18, min(g.x, g.y)) * smoothstep(1.0, 0.82, max(g.x, g.y));
	v = clamp(v, 0.0, 1.0) * (0.25 + 0.75 * energy);
	vec3 col = vec3(1.0, 0.05, 0.04) * v + vec3(1.0, 0.45, 0.35) * pow(v, 3.0) * 0.5;
	ALBEDO = col * (0.35 + 0.65 * px);
}
