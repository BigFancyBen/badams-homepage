shader_type spatial;
render_mode unshaded, cull_disabled, fog_disabled;
// Emissive LED cells: pixel bars, strobe tubes, blinder lamps, edge strips. One MultiMesh, the
// instance colour is the (HDR) cell colour, rewritten every frame by stage.gd.
varying vec4 vc;
void vertex() {
	vc = COLOR;
}
void fragment() {
	vec2 p = abs(UV - 0.5) * 2.0;
	float m = 1.0 - smoothstep(0.78, 1.0, max(p.x, p.y));
	ALBEDO = vc.rgb * (0.25 + 0.75 * m) + vec3(0.01, 0.0, 0.0);
}
