shader_type spatial;
render_mode unshaded, cull_disabled, fog_disabled;
// Stage LED screen: red pixel panel. The pattern lives in stage_screen.gdshaderinc; this adds the
// LED dot mask (faded out when the dots get smaller than a few pixels, so there is no moire at
// the far end of the hall).
#include "res://shaders/stage_screen.gdshaderinc"

uniform vec2 res = vec2(96.0, 52.0);
uniform float beat = 0.0;
uniform float bar = 0.0;
uniform float energy = 0.3;
uniform float kick = 0.0;
uniform float down = 0.0;
uniform float build = 0.0;
uniform float mode = 2.0;
uniform float blk = 1.0;
uniform float gain = 1.0;

void fragment() {
	vec2 uv = vec2(UV.x, 1.0 - UV.y);
	vec3 col = st_screen(uv, res, beat, bar, energy, kick, down, build, mode, blk);
	vec2 g = fract(uv * res) - 0.5;
	float m = smoothstep(0.5, 0.34, max(abs(g.x), abs(g.y)));
	float cellpx = 1.0 / max(fwidth(uv.x) * res.x, 0.0001);
	float mm = mix(1.0, 0.25 + 0.75 * m, smoothstep(2.0, 5.0, cellpx));
	ALBEDO = col * mm * gain;
}
