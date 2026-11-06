shader_type spatial;
render_mode unshaded, cull_back;
// Fluted limestone column: plaster scan in world space, 16 flutes cut into the normal (and
// darkened in the grooves) from the object-space angle.
#include "res://shaders/mat_common.gdshaderinc"
#include "res://shaders/lite.gdshaderinc"

uniform sampler2D tex_a : source_color, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_n : hint_normal, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_r : hint_default_white, repeat_enable, filter_linear_mipmap_anisotropic;
uniform float uv_scale = 0.6;
uniform float flutes = 16.0;
uniform float flute_depth = 0.5;
uniform vec4 tint : source_color = vec4(0.5, 0.45, 0.38, 1.0);

varying vec3 wp;
varying vec3 wn;
varying float ang;
varying float side;

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize(MODEL_NORMAL_MATRIX * NORMAL);
	ang = atan(VERTEX.z, VERTEX.x);
	side = 1.0 - smoothstep(0.3, 0.7, abs(NORMAL.y));
}

void fragment() {
	float a = ang * flutes;
	float groove = 0.5 + 0.5 * cos(a);
	float slope = -sin(a) * flute_depth * side;
	vec3 tang = normalize(vec3(-wn.z, 0.0, wn.x) + vec3(0.0001));
	vec3 nf = normalize(wn - tang * slope);
	Tri t = tri_setup(wp, nf, uv_scale, false, 4.0, false);
	vec3 alb = tri_sample(tex_a, t).rgb * tint.rgb;
	float rgh = tri_sample(tex_r, t).r;
	vec3 wnn = tri_normal_s(tex_n, t, nf, 1.0);
	NORMAL = normalize((VIEW_MATRIX * vec4(wnn, 0.0)).xyz);
	float ao = mix(1.0, 0.35 + 0.65 * smoothstep(0.0, 0.6, groove), side);
	ALBEDO = lite_shade(alb * COLOR.rgb, clamp(rgh * 0.9, 0.05, 1.0), 0.0, 0.45, ao, 1.0, NORMAL, VERTEX, VIEW_MATRIX);
}
