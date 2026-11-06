shader_type spatial;
render_mode unshaded, cull_back;
// Marquee face: a recessed panel of deep red enamel over the CC0 blackened-steel scan (tinted),
// glossy, with a faint red spill from the neon (from the same SDF the tubes use), a soft contact
// shadow under the tubes, and darkening into the recess edges.
#include "res://shaders/lite.gdshaderinc"
uniform sampler2D alb : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D nrm : filter_linear_mipmap, repeat_enable;
uniform sampler2D rgh : filter_linear_mipmap, repeat_enable;
uniform sampler2D sdf : filter_linear_mipmap, repeat_disable;
uniform sampler2D idt : filter_nearest, repeat_disable;
uniform float lv[12];
uniform float level = 1.0;
uniform float flash = 0.0;
uniform vec2 psize = vec2(12.4, 2.69);
void fragment() {
	vec2 uvm = UV * psize * 0.6;
	vec3 a = texture(alb, uvm).rgb;
	vec3 enamel = a * vec3(1.55, 0.085, 0.1);
	float d = textureLod(sdf, UV, 2.0).r - 0.5;
	float ds = textureLod(sdf, UV - vec2(0.002, 0.006), 2.2).r - 0.5;
	vec2 id = texture(idt, vec2(UV.x, 0.5)).rg;
	int gi = clamp(int(id.r * 255.0 / 16.0 + 0.5), 0, 11);
	float L = lv[gi] * level;
	float o = max(-d, 0.0);
	float spill = exp(-o * 14.0) * 0.5 + exp(-o * 4.0) * 0.22 + exp(-o * 1.5) * 0.05;
	float shadow = smoothstep(-0.03, 0.02, ds) * (1.0 - smoothstep(0.0, 0.03, d));
	float ex = min(UV.x, 1.0 - UV.x) * psize.x;
	float ey = min(UV.y, 1.0 - UV.y) * psize.y;
	float ao = mix(0.35, 1.0, smoothstep(0.0, 0.5, min(ex, ey * 1.4)));
	float vg = mix(1.0, 0.7, UV.y);
	vec3 nm = texture(nrm, uvm).rgb * 2.0 - 1.0;
	vec3 N = normalize(mix(NORMAL, normalize(TANGENT * nm.x + BINORMAL * nm.y + NORMAL * nm.z), 0.5));
	vec3 red = vec3(1.0, 0.05, 0.035);
	vec3 lit = lite_shade(enamel * ao * (1.0 - shadow * 0.12), clamp(texture(rgh, uvm).r * 0.55 + 0.1, 0.1, 0.6), 0.15, 0.5, 1.0, 0.0, N, VERTEX, VIEW_MATRIX);
	ALBEDO = lit + red * spill * L * (1.0 + flash) * 0.8 * ao + enamel * ao * 0.22 * vg;
}
