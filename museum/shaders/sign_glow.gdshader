shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, fog_disabled;
// Soft wide neon glow around the letters (additive quad a hand's width in front of the tubes).
uniform sampler2D sdf : filter_linear_mipmap, repeat_disable;
uniform sampler2D idt : filter_nearest, repeat_disable;
uniform float lv[12];
uniform float level = 1.0;
uniform float flash = 0.0;
void fragment() {
	float d = textureLod(sdf, UV, 1.0).r - 0.5;
	float db = textureLod(sdf, UV, 3.0).r - 0.5;
	vec2 id = texture(idt, vec2(UV.x, 0.5)).rg;
	int gi = clamp(int(id.r * 255.0 / 16.0 + 0.5), 0, 11);
	float L = lv[gi] * level;
	float o = max(-d, 0.0);
	float ob = max(-db, 0.0);
	float g = exp(-o * 70.0) * 0.55 + exp(-o * 22.0) * 0.35 + exp(-ob * 7.0) * 0.12 + exp(-ob * 2.4) * 0.05;
	vec3 c = vec3(1.0, 0.07, 0.05) * g;
	c += vec3(1.0, 0.45, 0.35) * exp(-o * 180.0) * 0.5;
	c *= L * (1.0 + 0.9 * flash);
	ALBEDO = c;
}
