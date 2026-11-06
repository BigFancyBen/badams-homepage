shader_type spatial;
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, fog_disabled;
// Glass neon tubes of the marquee, drawn on a quad a few cm proud of the panel. The text is a
// signed-distance texture (sign_bake_tool.gd): the tube is the SDF dilated a little, the radial
// profile gives a white-pink core grading to saturated red at the glass edge, plus a specular
// glint line. Per-letter level (flicker) comes from lv[], dark paint-out gaps at letter joins
// from the id texture.
uniform sampler2D sdf : filter_linear_mipmap, repeat_disable;
uniform sampler2D idt : filter_nearest, repeat_disable;
uniform float lv[12];
uniform float level = 1.0;
uniform float flash = 0.0;
uniform float hw = 0.027;
uniform float dil = 0.011;
void fragment() {
	vec2 uv = UV;
	float d = texture(sdf, uv).r - 0.5;
	vec2 id = texture(idt, vec2(uv.x, 0.5)).rg;
	int gi = clamp(int(id.r * 255.0 / 16.0 + 0.5), 0, 11);
	float L = lv[gi];
	float t = d + dil;
	float w = fwidth(t) * 0.8 + 0.0004;
	float cover = smoothstep(-w, w, t);
	float R = hw + dil;
	float q = clamp(t / R, 0.0, 1.0);
	float r = 1.0 - q;
	float nz = sqrt(max(1.0 - r * r, 0.0));
	// glint: the tube side facing up-left
	vec2 px = vec2(2.5 / 2048.0, 2.5 / 444.0);
	vec2 g = vec2(textureLod(sdf, uv + vec2(px.x, 0.0), 0.5).r - textureLod(sdf, uv - vec2(px.x, 0.0), 0.5).r,
			textureLod(sdf, uv + vec2(0.0, px.y), 0.5).r - textureLod(sdf, uv - vec2(0.0, px.y), 0.5).r);
	float gl = dot(normalize(g + vec2(1e-5)), normalize(vec2(1.0, 1.0)));
	float band = smoothstep(0.18, 0.3, q) * (1.0 - smoothstep(0.42, 0.6, q));
	float glint = smoothstep(0.55, 0.95, gl) * band;
	vec3 edge = vec3(1.0, 0.035, 0.03);
	vec3 hot = vec3(1.0, 0.8, 0.76);
	vec3 lit = mix(edge * 0.5, edge * 1.25, smoothstep(0.0, 0.55, nz));
	lit = mix(lit, hot * 1.5, pow(nz, 3.2));
	lit = mix(lit, vec3(1.6, 1.15, 1.1), flash * pow(nz, 2.0));
	vec3 off = vec3(0.16, 0.025, 0.022) * (0.5 + 0.8 * nz);
	float Lk = L * level;
	vec3 col = mix(off, lit * (0.75 + 0.35 * level), clamp(Lk, 0.0, 1.0));
	col += vec3(1.0, 0.92, 0.9) * glint * (0.25 + 0.75 * L);
	// dark paint-out where one tube jumps to the next
	float gap = id.g;
	col = mix(col, vec3(0.025, 0.006, 0.006) * (0.6 + 0.6 * nz), gap);
	ALBEDO = col;
	ALPHA = cover;
}
