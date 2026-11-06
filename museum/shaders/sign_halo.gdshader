shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, fog_disabled;
// Additive halo billboard behind each marquee bulb; same chase as sign_bulb.
uniform float beat = 0.0;
uniform float level = 0.7;
uniform float speed = 0.5;
uniform float count = 24.0;
uniform vec3 tint = vec3(1.0, 0.3, 0.14);
varying float on;
void vertex() {
	float ph = fract(COLOR.r * count - beat * speed * 2.0);
	on = smoothstep(0.6, 0.0, ph);
	on = on * on * (3.0 - 2.0 * on);
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0), vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
}
void fragment() {
	float d = length(UV * 2.0 - 1.0);
	float a = clamp(1.0 - d, 0.0, 1.0);
	a = a * a * a;
	ALBEDO = tint * a * (0.06 + 0.9 * on) * (0.5 + 0.7 * level);
}
