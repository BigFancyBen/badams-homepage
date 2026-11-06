shader_type spatial;
render_mode unshaded, cull_back;
// Materials.pbr(): a scanned PBR set (albedo, normal, roughness, optional metallic and AO),
// world-space triplanar or plain UV, with tint, roughness and normal controls and an optional
// grazing-angle sheen (velvet) and an optional constant emission. Lit by lite.gdshaderinc.
#include "res://shaders/mat_common.gdshaderinc"
#include "res://shaders/lite.gdshaderinc"

uniform sampler2D tex_a : source_color, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_n : hint_normal, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_r : hint_default_white, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_m : hint_default_black, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_ao : hint_default_white, repeat_enable, filter_linear_mipmap;
uniform bool use_m = false;
uniform bool use_ao = false;
uniform bool triplanar = true;
uniform bool cheap = false;
uniform bool grain_swap = false;
uniform float uv_scale = 1.0;
uniform vec4 tint : source_color = vec4(1.0);
uniform float roughness_mult = 1.0;
uniform float normal_strength = 1.0;
uniform float metallic = 0.0;
uniform float spec = 0.5;
uniform vec4 sheen_color : source_color = vec4(0.0);
uniform float sheen_pow = 3.0;
uniform vec4 emission : source_color = vec4(0.0);

varying vec3 wp;
varying vec3 wn;

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize(MODEL_NORMAL_MATRIX * NORMAL);
}

void fragment() {
	vec3 alb; float rgh; float mtl = metallic; float ao = 1.0;
	if (triplanar) {
		vec3 n0 = normalize(wn);
		Tri t = tri_setup(wp, n0, uv_scale, grain_swap, 6.0, cheap);
		alb = tri_sample(tex_a, t).rgb;
		rgh = tri_sample(tex_r, t).r;
		if (use_m) mtl = tri_sample(tex_m, t).r * metallic;
		if (use_ao) ao = tri_sample(tex_ao, t).r;
		vec3 wnn = tri_normal_s(tex_n, t, n0, normal_strength);
		NORMAL = normalize((VIEW_MATRIX * vec4(wnn, 0.0)).xyz);
	} else {
		vec2 uv = UV * uv_scale;
		alb = texture(tex_a, uv).rgb;
		rgh = texture(tex_r, uv).r;
		if (use_m) mtl = texture(tex_m, uv).r * metallic;
		if (use_ao) ao = texture(tex_ao, uv).r;
		vec3 nm = texture(tex_n, uv).xyz * 2.0 - 1.0;
		nm.xy *= normal_strength;
		NORMAL = normalize(TANGENT * nm.x + BINORMAL * nm.y + NORMAL * nm.z);
	}
	float fr = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), sheen_pow);
	vec3 lit = lite_shade(alb * tint.rgb * COLOR.rgb, clamp(rgh * roughness_mult, 0.03, 1.0), mtl, spec, ao, 0.5, NORMAL, VERTEX, VIEW_MATRIX);
	ALBEDO = lit + sheen_color.rgb * fr + emission.rgb;
}
