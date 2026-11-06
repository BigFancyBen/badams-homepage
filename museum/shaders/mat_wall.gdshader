shader_type spatial;
render_mode unshaded, cull_disabled;
// Hall walls: warm plaster scan; optional walnut panelled wainscot (wainscot_h > 0, 
// off by default; architecture builds those as geometry). Axis-aligned, one fetch per map.
#include "res://shaders/mat_common.gdshaderinc"
#include "res://shaders/lite.gdshaderinc"

uniform sampler2D pl_a : source_color, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D pl_n : hint_normal, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D pl_r : hint_default_white, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D wd_a : source_color, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D wd_n : hint_normal, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D wd_r : hint_default_white, repeat_enable, filter_linear_mipmap_anisotropic;
uniform float plaster_scale = 0.4;
uniform float wood_scale = 0.9;
uniform vec4 plaster_tint : source_color = vec4(0.56, 0.5, 0.41, 1.0);
uniform vec4 wood_tint : source_color = vec4(0.8, 0.75, 0.7, 1.0);
uniform float wainscot_h = 0.0;  // architecture builds wainscot and dado as geometry
uniform float panel_w = 1.0;

varying vec3 wp;
varying vec3 wn;

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize(MODEL_NORMAL_MATRIX * NORMAL);
}

void fragment() {
	vec3 n0 = normalize(wn);
	Tri tp = tri_setup(wp, n0, plaster_scale, false, 4.0, true);
	vec3 alb = tri_sample(pl_a, tp).rgb * plaster_tint.rgb;
	float rgh = tri_sample(pl_r, tp).r;
	vec3 wnn = tri_normal_s(pl_n, tp, n0, 1.0);
	float metal = 0.0;

	if (wainscot_h > 0.0) {
		float u = abs(n0.x) > abs(n0.z) ? wp.z : wp.x;
		float aa = max(fwidth(wp.y), 0.0005);
		float w_in = 1.0 - smoothstep(wainscot_h - aa, wainscot_h + aa, wp.y);
		Tri tw = tri_setup(wp, n0, wood_scale, false, 4.0, true);
		vec3 wa = tri_sample(wd_a, tw).rgb * wood_tint.rgb;
		float wr = tri_sample(wd_r, tw).r;
		vec3 wnw = tri_normal_s(wd_n, tw, n0, 1.0);
		// recessed grooves between panels and along the top and bottom
		float du = abs(fract(u / panel_w) - 0.5);
		float au = max(fwidth(u) / panel_w, 0.001);
		float gv = smoothstep(0.47 - au, 0.47 + au, du);
		float gy = smoothstep(wainscot_h - 0.12 - aa, wainscot_h - 0.12 + aa, wp.y) + (1.0 - smoothstep(0.14 - aa, 0.14 + aa, wp.y));
		float groove = clamp(max(gv, gy), 0.0, 1.0);
		wa *= 1.0 - 0.55 * groove;
		alb = mix(alb, wa, w_in);
		rgh = mix(rgh, clamp(wr, 0.05, 1.0), w_in);
		wnn = normalize(mix(wnn, wnw, w_in));
	}
	NORMAL = normalize((VIEW_MATRIX * vec4(wnn, 0.0)).xyz);
	ALBEDO = lite_shade(alb * COLOR.rgb, clamp(rgh, 0.05, 1.0), metal, 0.45, 1.0, 0.0, NORMAL, VERTEX, VIEW_MATRIX);
}
