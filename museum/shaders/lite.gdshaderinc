// The hall's lighting, done in the fragment shader instead of by Godot's lit pipeline.
//
// Why: every lit spatial shader costs 2 to 5 s to compile on ANGLE/D3D11 (Windows Chrome) because
// the built-in light code is enormous, and the museum has a dozen of them: a cold first visit hung
// the tab for a minute. An `unshaded` shader of the same surface compiles in ~0.3 s. The hall only
// ever has one ambient colour and two real lights (a spot on the viewed bay and an omni room
// flash), so this evaluates just those: Lambert diffuse, a GGX highlight, Godot's ambient
// environment BRDF, Godot's omni/spot falloff. No shadows (the lights never cast any).
//
// Surfaces are `render_mode unshaded` and end with
//   ALBEDO = lite_shade(albedo, roughness, metallic, specular, ao, ao_affect, NORMAL, VERTEX, VIEW_MATRIX) + emission;
// where NORMAL and VERTEX are the view-space ones from fragment(). Fog still applies (it is not
// part of the lighting). The lights are fed by lite.gd as global shader parameters.

global uniform vec3 lt_ambient;
global uniform vec4 lt_spot_pos;   // world xyz, range
global uniform vec4 lt_spot_dir;   // world xyz: the way the light points, w: cos of the cone half angle
global uniform vec4 lt_spot_col;   // linear rgb * energy (black when off), a: distance falloff exponent
global uniform vec4 lt_omni_pos;   // world xyz, range
global uniform vec4 lt_omni_col;   // linear rgb * energy (black when off), a: distance falloff exponent

// Falloff of a positional light: Godot's (smooth to zero at the range, 1/d^decay inside it), and a
// steeper fall past 5 m, which is what Godot's lit shading of this hall measured (see the gains).
float lite_falloff(float d, float range, float decay) {
	float nd = d / range;
	nd *= nd;
	nd *= nd;
	nd = max(1.0 - nd, 0.0);
	float steep = pow(5.0 / max(d, 1.0), 2.0);
	return nd * nd * pow(max(d, 0.0001), -decay) * steep;
}

// Gains, matched against Godot's own lit shading of this hall (the same bays under the same spot,
// before and after: floor, plinth, pictures): diffuse brightness, and the highlight of a spot
// (Godot's light_specular is 0.5 for a spot; the omni the old code used had 1.0).
const float LITE_DIFFUSE = 6.0;
const float LITE_SPECULAR = 11.0;

vec3 lite_light(vec3 L, float att, vec3 lc, float spec_k, vec3 N, vec3 Vv, vec3 diff, vec3 f0, float rough, float ao_k) {
	float nl = clamp(dot(N, L), 0.0, 1.0);
	vec3 H = normalize(L + Vv);
	float nh = clamp(dot(N, H), 0.0, 1.0);
	float vh = clamp(dot(Vv, H), 0.0, 1.0);
	float a2 = pow(rough, 4.0);
	float dd = nh * nh * (a2 - 1.0) + 1.0;
	float D = a2 / (3.14159265 * dd * dd);
	vec3 F = f0 + (vec3(1.0) - f0) * pow(1.0 - vh, 5.0);
	vec3 spec = F * (D * 0.25 * 3.14159265);
	return lc * (att * nl * ao_k) * (diff * LITE_DIFFUSE + spec * spec_k * LITE_SPECULAR);
}

vec3 lite_shade(vec3 alb, float rough, float metal, float spec, float ao, float ao_affect, vec3 N, vec3 P, mat4 V) {
	vec3 Vv = normalize(-P);
	rough = clamp(rough, 0.04, 1.0);
	float nv = clamp(dot(N, Vv), 0.001, 1.0);
	vec3 f0 = mix(vec3(0.16 * spec * spec), alb, metal);
	vec3 diff = alb * (1.0 - metal);
	// ambient: diffuse plus the split-sum environment term (the ambient is a flat colour)
	vec4 r = rough * vec4(-1.0, -0.0275, -0.572, 0.022) + vec4(1.0, 0.0425, 1.04, -0.04);
	float a004 = min(r.x * r.x, exp2(-9.28 * nv)) * r.x + r.y;
	vec2 ab = vec2(-1.04, 1.04) * a004 + r.zw;
	vec3 col = lt_ambient * ao * (diff + f0 * ab.x + ab.y);
	float ao_k = mix(1.0, ao, ao_affect);
	if (lt_spot_col.r + lt_spot_col.g + lt_spot_col.b > 0.0) {
		vec3 Lv = (V * vec4(lt_spot_pos.xyz, 1.0)).xyz - P;
		float d = length(Lv);
		if (d < lt_spot_pos.w) {
			vec3 L = Lv / d;
			float att = lite_falloff(d, lt_spot_pos.w, lt_spot_col.a);
			vec3 sd = normalize((V * vec4(lt_spot_dir.xyz, 0.0)).xyz);
			float scos = max(dot(-L, sd), lt_spot_dir.w);
			float rim = max(0.0001, (1.0 - scos) / (1.0 - lt_spot_dir.w));
			att *= pow(1.0 - rim, 1.4);
			col += lite_light(L, att, lt_spot_col.rgb, 1.0, N, Vv, diff, f0, rough, ao_k);
		}
	}
	if (lt_omni_col.r + lt_omni_col.g + lt_omni_col.b > 0.0) {
		vec3 Lv = (V * vec4(lt_omni_pos.xyz, 1.0)).xyz - P;
		float d = length(Lv);
		if (d < lt_omni_pos.w) {
			float att = lite_falloff(d, lt_omni_pos.w, lt_omni_col.a);
			col += lite_light(Lv / d, att, lt_omni_col.rgb, 1.0, N, Vv, diff, f0, rough, ao_k);
		}
	}
	return col;
}
