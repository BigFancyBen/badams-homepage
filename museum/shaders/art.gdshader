shader_type spatial;
render_mode unshaded, fog_disabled;
// A picture on the wall, shown true-colour. The scene's tonemap (AgX) and grade desaturate and
// lift everything that is not an emissive, so the picture is pre-compensated: `lut` is the
// measured inverse of the whole pipeline (tonemap + grade) for the active tier, built from
// calibration renders of the Post tonemap + grade (24^3 colour patches per tier, inverted numerically); regenerate textures/art_lut_*.bin if Post changes. A source pixel goes in as the colour it should
// have on screen, and comes out as the linear value that the tonemap turns back into it.
// No fog (the red haze must not tint it), no lighting. `level` scales the displayed brightness.
// sampled raw (no source_color): the picture's sRGB-encoded values are what the LUT is indexed by
uniform sampler2D albedo_tex : filter_linear_mipmap_anisotropic, repeat_disable;
uniform sampler3D lut : filter_linear, repeat_disable;
uniform float level = 0.97;
const float LUT_N = 40.0;

void fragment() {
	vec3 enc = texture(albedo_tex, UV).rgb;
	vec3 t = clamp(enc * level, 0.0, 1.0);
	ALBEDO = texture(lut, t * ((LUT_N - 1.0) / LUT_N) + 0.5 / LUT_N).rgb;
}
