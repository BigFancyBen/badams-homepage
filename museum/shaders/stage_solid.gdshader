shader_type spatial;
render_mode unshaded, cull_back;
// Stage hardware: blackened steel / rubber cases with a scan texture sampled along the dominant
// world axis (so scaled boxes need no UVs) and a fake red spill from the rig and the screen, since
// the hall has no real lights: edges toward the screen catch red, and the show level drives it.
#include "res://shaders/lite.gdshaderinc"
uniform sampler2D albedo_tex : source_color, repeat_enable, filter_linear_mipmap;
uniform sampler2D normal_tex : hint_normal, repeat_enable, filter_linear_mipmap;
uniform sampler2D rough_tex : hint_default_white, repeat_enable, filter_linear_mipmap;
uniform float tex_scale = 0.8;
uniform float metal = 0.85;
uniform float albedo_gain = 0.22;
uniform float rig = 0.3;
varying vec3 wp;
varying vec3 wn;
varying vec4 ic;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize(MODEL_NORMAL_MATRIX * NORMAL);
	ic = COLOR;
}
void fragment() {
	vec3 an = abs(wn);
	vec2 uv = wp.zy;
	if (an.y >= an.x && an.y >= an.z) {
		uv = wp.xz;
	} else if (an.z >= an.x) {
		uv = wp.xy;
	}
	uv *= tex_scale;
	vec3 al = texture(albedo_tex, uv).rgb;
	float ro = texture(rough_tex, uv).r;
	vec3 nm = texture(normal_tex, uv).rgb * 2.0 - 1.0;
	vec3 nw = wn;
	if (an.y >= an.x && an.y >= an.z) {
		nw = normalize(wn + vec3(nm.x, 0.0, -nm.y) * 0.6);
	} else if (an.z >= an.x) {
		nw = normalize(wn + vec3(nm.x, nm.y, 0.0) * 0.6);
	} else {
		nw = normalize(wn + vec3(0.0, nm.y, nm.x) * 0.6);
	}
	NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);
	float tint = ic.r;
	vec3 vw = normalize(INV_VIEW_MATRIX[3].xyz - wp);
	float fr = pow(1.0 - clamp(dot(nw, vw), 0.0, 1.0), 2.5);
	float zs = smoothstep(-100.0, -122.0, wp.z);
	float up = 0.35 + 0.65 * clamp(nw.y * 0.5 + 0.5, 0.0, 1.0);
	float lit = rig * (0.14 + 0.5 * zs) * up;
	vec3 base = lite_shade(al * albedo_gain * tint, clamp(ro * (0.55 + ic.g), 0.12, 1.0), metal * ic.b, 0.5, 1.0, 0.0, NORMAL, VERTEX, VIEW_MATRIX);
	ALBEDO = base + vec3(1.0, 0.07, 0.05) * lit * (0.25 + 1.3 * fr) * (0.4 + 0.6 * al.r * 2.5);
}
