shader_type spatial;
render_mode unshaded, cull_back;
// Polished black marble floor: Marble002 scan, laid as individual slabs (each slab samples its own
// patch of the scan), hairline grout seams, low roughness for a sharp specular and a faint
// grazing-angle sheen. World-space, so the code-built floor box needs no UVs.
#include "res://shaders/lite.gdshaderinc"
uniform sampler2D tex_a : source_color, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_n : hint_normal, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_r : hint_default_white, repeat_enable, filter_linear_mipmap_anisotropic;
uniform float slab = 0.8;           // metres per slab edge
uniform float tex_scale = 0.5;      // scan repeats per metre (0.5 = one scan per 2 m)
uniform vec4 tint : source_color = vec4(1.0);
uniform float roughness_mult = 0.3;
uniform float normal_strength = 0.35;
uniform float seam_width = 0.0025;
uniform vec4 sheen_color : source_color = vec4(0.11, 0.095, 0.09, 1.0);

varying vec3 wp;

float hash21(vec2 c) {
	return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453);
}

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = wp.xz;
	vec2 g = p / slab;
	vec2 cell = floor(g);
	vec2 f = fract(g);
	float h = hash21(cell);
	vec2 off = vec2(h, hash21(cell + 17.0)) * 4.0;
	vec2 uv = p * tex_scale + off;
	vec2 dx = dFdx(p) * tex_scale;
	vec2 dy = dFdy(p) * tex_scale;
	vec3 alb = textureGrad(tex_a, uv, dx, dy).rgb;
	float rgh = textureGrad(tex_r, uv, dx, dy).r;
	vec3 tn = textureGrad(tex_n, uv, dx, dy).xyz * 2.0 - 1.0;

	// seams
	vec2 e = min(f, 1.0 - f) * slab;
	float edge = min(e.x, e.y);
	float aa = max(length(dFdx(p)), length(dFdy(p)));
	float far_fade = 1.0 - smoothstep(0.02, 0.06, aa);
	float seam = (1.0 - smoothstep(seam_width - aa, seam_width + aa, edge)) * far_fade;
	// slight chamfer either side of the seam
	float xs = e.x < e.y ? 1.0 : 0.0;
	vec2 sd = vec2(xs * (f.x < 0.5 ? -1.0 : 1.0), (1.0 - xs) * (f.y < 0.5 ? -1.0 : 1.0));
	float cham = (1.0 - smoothstep(seam_width, seam_width * 3.0 + aa, edge)) * far_fade;

	vec3 n = normalize(vec3(tn.x * normal_strength + sd.x * cham * 0.5, 1.0, -tn.y * normal_strength + sd.y * cham * 0.5));
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);

	float tone = 0.88 + 0.24 * h;
	vec3 albedo = pow(alb, vec3(0.85)) * tint.rgb * tone * (1.0 - 0.9 * seam);
	float rough = clamp(mix(rgh * roughness_mult, 0.55, seam), 0.04, 1.0);
	float fr = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	ALBEDO = lite_shade(albedo, rough, 0.0, 0.75, 1.0, 0.0, NORMAL, VERTEX, VIEW_MATRIX) + sheen_color.rgb * fr * (1.0 - seam);
}
