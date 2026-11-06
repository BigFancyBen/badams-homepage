shader_type spatial;
render_mode unshaded, cull_back, fog_disabled;
// Marquee bulb: a glass sphere with a hot filament core. Instance colour.r = position along the
// run (0..1); the chase is a pure function of the song beat.
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
	float on = smoothstep(0.6, 0.0, ph);
	on = on * on * (3.0 - 2.0 * on);
	float nv = clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0);
	vec3 glass_off = vec3(0.2, 0.07, 0.055) * (0.4 + 0.6 * pow(1.0 - nv, 1.5));
	vec3 glass_on = mix(vec3(1.0, 0.18, 0.08), vec3(1.0, 0.55, 0.25), pow(nv, 2.0));
	vec3 c = mix(glass_off, glass_on * (0.8 + 0.6 * level), on);
	// filament: a small bright core, a dull orange wire when off
	float core = pow(nv, 14.0);
	c += vec3(1.0, 0.9, 0.7) * core * (0.12 + 2.2 * on) ;
	// glass rim and window highlight
	c += vec3(1.0, 0.5, 0.35) * pow(1.0 - nv, 3.0) * (0.15 + 0.5 * on);
	float hl = smoothstep(0.93, 0.985, dot(normalize(NORMAL), normalize(vec3(-0.45, 0.6, 0.66))));
	c += vec3(1.0) * hl * 0.8;
	ALBEDO = c;
}
