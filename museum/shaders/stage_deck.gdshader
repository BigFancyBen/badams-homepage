shader_type spatial;
render_mode unshaded, cull_back;
// Stage deck: black painted planks (scan) with a wet sheen that reflects the LED screen. The
// reflection is analytic: mirror the view ray about the deck plane, hit the back wall, and read
// the same screen pattern there. Plus red spill that is strongest near the screen.
#include "res://shaders/stage_screen.gdshaderinc"
#include "res://shaders/lite.gdshaderinc"

uniform sampler2D albedo_tex : source_color, repeat_enable, filter_linear_mipmap;
uniform sampler2D normal_tex : hint_normal, repeat_enable, filter_linear_mipmap;
uniform sampler2D rough_tex : hint_default_white, repeat_enable, filter_linear_mipmap;
uniform vec2 res = vec2(96.0, 52.0);
uniform vec3 scr_c = vec3(0.0, 5.3, -122.94);
uniform vec2 scr_h = vec2(5.8, 3.2);
uniform float beat = 0.0;
uniform float bar = 0.0;
uniform float energy = 0.3;
uniform float kick = 0.0;
uniform float down = 0.0;
uniform float build = 0.0;
uniform float mode = 2.0;
uniform float blk = 1.0;
uniform float refl = 1.0;
uniform float rig = 0.3;
varying vec3 wp;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 uv = wp.xz * 0.45;
	vec3 al = texture(albedo_tex, uv).rgb;
	float ro = texture(rough_tex, uv).r;
	vec3 nm = texture(normal_tex, uv).rgb * 2.0 - 1.0;
	vec3 nw = normalize(vec3(nm.x * 0.5, 1.0, -nm.y * 0.5));
	NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);
	vec3 cam = INV_VIEW_MATRIX[3].xyz;
	vec3 vd = normalize(wp - cam);
	vec3 rd = reflect(vd, nw);
	float fres = 0.05 + 0.95 * pow(1.0 - clamp(dot(nw, -vd), 0.0, 1.0), 4.0);
	vec3 r = vec3(0.0);
	if (rd.z < -0.01 && rd.y > 0.0) {
		float t = (scr_c.z - wp.z) / rd.z;
		vec3 h = wp + rd * t;
		vec2 su = (h.xy - scr_c.xy) / (scr_h * 2.0) + 0.5;
		// blur the lookup with the plank grain so it streaks rather than mirrors
		su.x += nm.x * 0.006;
		float inside = step(0.0, su.x) * step(su.x, 1.0) * step(0.0, su.y) * step(su.y, 1.0);
		if (inside > 0.5) {
			float dy = 0.05 + 0.05 * (1.0 - su.y);
			for (int k = -1; k <= 1; k++) {
				vec2 s2 = vec2(su.x, clamp(su.y + float(k) * dy, 0.0, 1.0));
				r += st_screen(s2, res * 0.35, beat, bar, energy, kick, down, build, mode, blk) * 0.333;
			}
			r *= smoothstep(0.0, 0.08, su.y);
		}
	}
	float zs = smoothstep(-104.0, -123.0, wp.z);
	vec3 spill = vec3(1.0, 0.06, 0.04) * rig * (0.06 + 0.5 * zs * zs) * (0.5 + 0.8 * al.r * 3.0);
	vec3 lit = lite_shade(al * 0.16, clamp(ro * 0.8, 0.2, 1.0), 0.0, 0.7, 1.0, 0.0, NORMAL, VERTEX, VIEW_MATRIX);
	ALBEDO = lit + r * fres * 1.2 * refl * (1.0 - ro * 0.5) + spill;
}
