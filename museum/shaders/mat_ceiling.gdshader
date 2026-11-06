shader_type spatial;
render_mode unshaded, cull_back;
// Coffered ceiling in the plaster scan: raised ribs, recessed panels (darker, bevelled normals)
// and a thin aged-brass line along each coffer's inner edge.
#include "res://shaders/mat_common.gdshaderinc"
#include "res://shaders/lite.gdshaderinc"

uniform sampler2D pl_a : source_color, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D pl_n : hint_normal, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D pl_r : hint_default_white, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D br_a : source_color, repeat_enable, filter_linear_mipmap_anisotropic;
uniform float plaster_scale = 0.35;
uniform float coffer = 3.0;
uniform vec4 plaster_tint : source_color = vec4(0.5, 0.45, 0.37, 1.0);
uniform vec4 brass_tint : source_color = vec4(0.65, 0.5, 0.28, 1.0);

varying vec3 wp;

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 g = wp.xz / coffer;
	vec2 f = fract(g);
	vec2 e = min(f, 1.0 - f) * coffer;
	float edge = min(e.x, e.y);
	float aa = max(length(dFdx(wp.xz)), length(dFdy(wp.xz)));
	float recess = smoothstep(0.09 - aa, 0.13 + aa, edge);
	float bevel = (1.0 - smoothstep(0.09 - aa, 0.13 + aa, edge)) * smoothstep(0.0, 0.03 + aa, edge);
	float use_x = step(e.x, e.y);
	vec2 inward = vec2(f.x < 0.5 ? 1.0 : -1.0, f.y < 0.5 ? 1.0 : -1.0);
	vec3 nb = normalize(vec3(inward.x * use_x * bevel * 0.9, -1.0, inward.y * (1.0 - use_x) * bevel * 0.9));

	Tri t = tri_setup(wp, nb, plaster_scale, false, 4.0, true);
	vec3 alb = tri_sample(pl_a, t).rgb * plaster_tint.rgb;
	float rgh = tri_sample(pl_r, t).r;
	vec3 wnn = tri_normal_s(pl_n, t, nb, 1.0);
	NORMAL = normalize((VIEW_MATRIX * vec4(wnn, 0.0)).xyz);

	float line = 1.0 - smoothstep(0.006 - aa, 0.006 + aa, abs(edge - 0.1));
	vec2 bu = wp.xz * 3.0;
	vec3 ba = textureGrad(br_a, bu, dFdx(bu), dFdy(bu)).rgb * brass_tint.rgb;
	alb *= mix(1.0, 0.62, recess) * (1.0 - 0.3 * bevel);
	alb = mix(alb, ba, line);
	ALBEDO = lite_shade(alb * COLOR.rgb, mix(clamp(rgh, 0.05, 1.0), 0.35, line), line * 0.8, 0.4, 1.0, 0.0, NORMAL, VERTEX, VIEW_MATRIX);
}
