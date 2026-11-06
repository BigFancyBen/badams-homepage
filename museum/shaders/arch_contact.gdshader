shader_type spatial;
render_mode blend_mul, unshaded, depth_draw_never, cull_disabled, fog_disabled;
// Fake contact shadow: a soft dark quad multiplied onto what is behind it. The vertex colour alpha
// is the shadow amount (1 at the contact, 0 at the soft edge); rgb is the tint it darkens towards.
void fragment() {
	float a = clamp(COLOR.a, 0.0, 1.0);
	a = a * a * (3.0 - 2.0 * a);
	ALBEDO = mix(vec3(1.0), COLOR.rgb, a);
}
