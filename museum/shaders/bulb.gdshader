shader_type spatial;
render_mode unshaded, cull_back, fog_disabled;
// Marquee chaser bulb. Instance colour.r = position along the run (0..1); the chase is a
// function of the song beat so it stays locked to the music.
uniform float beat = 0.0;
uniform float level = 0.7;
uniform float speed = 0.5;
uniform float count = 24.0;
varying float t;
void vertex() {
	t = COLOR.r;
}
void fragment() {
	float ph = fract(t * count - beat * speed * 2.0);
	float on = smoothstep(0.55, 0.0, ph);
	vec3 off_c = vec3(0.32, 0.04, 0.03);
	vec3 on_c = vec3(1.0, 0.62, 0.38);
	vec3 c = mix(off_c, on_c, on) * (0.55 + 0.45 * level);
	float sh = 0.65 + 0.35 * clamp(NORMAL.z, 0.0, 1.0);
	ALBEDO = c * sh;
}
