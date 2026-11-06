shader_type spatial;
render_mode unshaded, cull_back;
// Engraved brass plaque. Over the CC0 brass scan (albedo, normal, roughness; toned to aged gold,
// brushing turned along the plate), the text mask baked by signage.gd (title, ornament
// rule, inset rule) becomes engraving: dark patinated recesses with a different
// roughness, a lit bevel edge and a normal derived from the mask's gradient. Corner screw heads
// with slots, edge wear and corner patina are drawn here too.
#include "res://shaders/lite.gdshaderinc"
uniform sampler2D mask : filter_linear_mipmap, repeat_disable;
uniform sampler2D alb : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D nrm : filter_linear_mipmap, repeat_enable;
uniform sampler2D rgh : filter_linear_mipmap, repeat_enable;
uniform sampler2D tx : repeat_enable, filter_linear_mipmap;
uniform float seed = 0.0;
uniform vec2 msize = vec2(1536.0, 634.0);
const vec2 PS = vec2(2.64, 1.09);
const float SCREW_R = 0.043;

void fragment() {
	vec2 uv = UV;
	vec2 wp = uv * PS;
	float m = texture(mask, uv).r;
	vec2 px = 1.0 / msize;
	float h1 = 1.6;
	float mx1 = textureLod(mask, uv + vec2(px.x * h1, 0.0), 0.8).r;
	float mx0 = textureLod(mask, uv - vec2(px.x * h1, 0.0), 0.8).r;
	float my1 = textureLod(mask, uv + vec2(0.0, px.y * h1), 0.8).r;
	float my0 = textureLod(mask, uv - vec2(0.0, px.y * h1), 0.8).r;
	vec2 g = vec2(mx1 - mx0, my1 - my0);
	float rec = smoothstep(0.3, 0.7, m);
	float edgeband = clamp(abs(g.x) + abs(g.y), 0.0, 1.0);

	// brushed brass scan, brushing along the plate (scan streaks are vertical, so swap uv axes)
	vec2 bu = vec2(wp.y, wp.x) * 0.55 + seed;
	vec3 a = texture(alb, bu).rgb;
	a = mix(a, max(a, vec3(0.74, 0.68, 0.5)), 0.85);
	vec3 bn = texture(nrm, bu).rgb * 2.0 - 1.0;
	bn.xy = vec2(bn.y, bn.x);
	float br = texture(rgh, bu).r;
	float fine = texture(tx, uv * vec2(1.0, 60.0) + seed * 3.0).r;
	float low = texture(tx, uv * 2.2 + seed).r;
	vec3 brass = a * vec3(0.84, 0.67, 0.35);
	brass *= 0.88 + 0.24 * fine;
	brass *= mix(0.9, 1.04, smoothstep(0.25, 0.8, low));

	// edge wear and corner patina
	float e = min(min(uv.x, 1.0 - uv.x) * PS.x, min(uv.y, 1.0 - uv.y) * PS.y);
	float wear = (1.0 - smoothstep(0.0, 0.035, e)) * (0.4 + 0.9 * texture(tx, uv * 9.0 + seed).r);
	float cdist = length((abs(uv - 0.5) * PS) - PS * 0.5);
	float patina = (1.0 - smoothstep(0.0, 0.55, cdist)) * (0.5 + 0.8 * low);
	vec3 verd = vec3(0.16, 0.2, 0.12);
	brass = mix(brass, brass * vec3(0.6, 0.5, 0.38), patina * 0.7);
	brass = mix(brass, verd * (0.5 + a.r * 0.5), clamp(patina - 0.55, 0.0, 1.0) * 0.5);
	brass = mix(brass, brass * 1.4 + vec3(0.12, 0.08, 0.02), wear * 0.5);

	// recess: dark filled engraving with patina
	float pat2 = texture(tx, uv * vec2(5.0, 9.0) + seed * 2.0).r;
	vec3 rec_c = mix(vec3(0.035, 0.022, 0.012), vec3(0.05, 0.075, 0.055), smoothstep(0.35, 0.8, pat2));
	rec_c *= 0.7 + 0.5 * a.r;
	vec3 col = mix(brass, rec_c, rec);
	// lit bevel: the wall of the cut facing the top-left catches the light
	float hl = clamp(-(g.x + g.y) * 3.0, -1.0, 1.0);
	col += vec3(1.0, 0.82, 0.5) * max(hl, 0.0) * 0.55 * (1.0 - rec);
	col *= 1.0 - max(-hl, 0.0) * 0.4 * (1.0 - rec * 0.5);

	// corner screws
	vec2 sgn = sign(uv - 0.5);
	vec2 sc = (abs(uv - 0.5) * PS - (PS * 0.5 - vec2(0.135, 0.135))) * sgn;
	float sr = length(sc);
	float screw = 1.0 - smoothstep(SCREW_R - 0.002, SCREW_R + 0.002, sr);
	float ring = smoothstep(SCREW_R + 0.011, SCREW_R, sr) * (1.0 - screw);
	float ang = (sgn.x * 0.6 + sgn.y * 1.1 + seed * 5.0);
	vec2 sd = vec2(cos(ang), sin(ang));
	float slot = (1.0 - smoothstep(0.0035, 0.006, abs(dot(sc, vec2(-sd.y, sd.x))))) * (1.0 - smoothstep(0.034, 0.038, abs(dot(sc, sd))));
	float dome = sqrt(max(1.0 - pow(sr / SCREW_R, 2.0), 0.0));
	vec3 screw_c = brass * (0.8 + 0.7 * dome) * vec3(1.0, 0.95, 0.85) + vec3(0.25, 0.18, 0.07) * pow(dome, 6.0);
	screw_c = mix(screw_c, vec3(0.02, 0.012, 0.008), slot);
	col = mix(col, vec3(0.03, 0.02, 0.01), ring * 0.8);
	col = mix(col, screw_c, screw);

	// normal: brass scan + engraving walls + screw dome
	vec2 gn = g * 1.7 * (1.0 - screw);
	vec3 n = normalize(vec3(bn.xy * 0.7 - vec2(gn.x, -gn.y), 1.0));
	n.xy += -sc * (screw * 7.0 * (1.0 - dome * 0.0)) * vec2(1.0, -1.0) * (1.0 - slot);
	n = normalize(n);
	vec3 N = normalize(TANGENT * n.x + BINORMAL * n.y + NORMAL * n.z);

	float r_brass = clamp(0.25 + br * 0.55 + 0.25 * fine + wear * 0.2, 0.2, 0.8);
	float rough = mix(r_brass, 0.82, rec);
	float metal = mix(0.92, 0.25, rec);

	// fake environment: soft strip reflections that slide across the brass as the camera moves
	vec3 rw = (INV_VIEW_MATRIX * vec4(reflect(-VIEW, N), 0.0)).xyz;
	float up = pow(max(rw.y, 0.0), 1.2);
	float strips = 0.3 + 0.7 * smoothstep(0.45, 0.9, 0.5 + 0.5 * sin(rw.z * 6.0 + rw.x * 2.5));
	vec3 sheen = mix(vec3(1.0, 0.9, 0.7), vec3(1.0, 0.35, 0.25), 0.1) * up * strips;
	float shine = (1.0 - rec) * (1.0 - ring * 0.5) * (1.1 - r_brass);
	vec3 emis = col * sheen * shine * 0.95 + col * 0.22 + vec3(1.0, 0.8, 0.45) * edgeband * (1.0 - rec) * 0.12;
	ALBEDO = lite_shade(col, rough, metal, 0.5, 1.0, 0.0, N, VERTEX, VIEW_MATRIX) + emis;
}
