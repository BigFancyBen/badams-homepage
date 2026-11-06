shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, fog_disabled;
// A fleck of light thrown by a mirror tile: a small bright square with a soft halo.
varying vec4 vc;
void vertex() {
	vc = COLOR;
}
void fragment() {
	vec2 p = abs(UV - 0.5) * 2.0;
	float sq = 1.0 - smoothstep(0.22, 0.42, max(p.x, p.y));
	float halo = exp(-dot(p, p) * 5.0) * 0.35;
	float a = sq + halo;
	ALBEDO = vc.rgb * a * smoothstep(1.0, 0.7, length(p));
	ALPHA = 1.0;
}
