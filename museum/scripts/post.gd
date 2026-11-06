extends RefCounted
## Post: the look of the final image. Owns the WorldEnvironment (near-black background and
## ambient, thin warm-red distance haze, filmic tonemap, glow, contrast/saturation), the
## vignette + grain overlay, anti-aliasing, and the quality tiers.
##
## Tiers: DESKTOP has full-screen glow (wide soft halos on emissives), 4x MSAA, the colour grade
## and a lens-edge fringe in the overlay. MOBILE (phones in the browser, WebGL2) has no glow, no
## grade pass and a cheap overlay; fixtures.gd fakes the halos with fatter additive sprites
## instead (glow.gdshader halo_boost). Force a tier on any machine with the user arg
## `--tier=mobile` or `--tier=desktop` (after `--` on the command line).

const Lite := preload("res://scripts/lite.gd")

enum Tier { DESKTOP, MOBILE }

## The ambient the hall's surfaces are lit with (see lite.gd): not an Environment ambient, because
## surfaces light themselves.
const AMBIENT_COLOR := Color(0.62, 0.4, 0.38)
const AMBIENT_ENERGY := 0.15

static var tier: Tier = Tier.DESKTOP


static func build(root: Node3D, is_mobile: bool) -> void:
	var mob := is_mobile
	for a in OS.get_cmdline_user_args():
		if a == "--tier=mobile":
			mob = true
		elif a == "--tier=desktop":
			mob = false
	tier = Tier.MOBILE if mob else Tier.DESKTOP
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.004, 0.003, 0.004)
	# almost no ambient: just enough that the architecture's silhouette reads between the pools
	Lite.setup(AMBIENT_COLOR, AMBIENT_ENERGY)
	env.fog_enabled = true
	env.fog_light_color = Color(0.03, 0.006, 0.007)
	env.fog_density = 0.0055
	# filmic: AgX rolls hot reds off toward white, like a camera exposed for the highlights
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.3
	env.tonemap_white = 6.0
	if tier == Tier.DESKTOP:
		env.glow_enabled = true
		env.glow_intensity = 0.9
		env.glow_strength = 1.1
		env.glow_bloom = 0.0
		env.glow_hdr_threshold = 0.85
		env.glow_hdr_scale = 2.0
		env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SCREEN
		var lv := [0.0, 0.3, 0.6, 1.0, 1.0, 0.8, 0.5]
		for i in 7:
			env.set_glow_level(i, lv[i])
		env.adjustment_enabled = true
		env.adjustment_contrast = 1.08
		env.adjustment_saturation = 1.06
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	var vp := root.get_viewport()
	if vp != null:
		vp.msaa_3d = Viewport.MSAA_4X if tier == Tier.DESKTOP else Viewport.MSAA_2X
	_overlay(root)


const _OVERLAY_DESKTOP := "shader_type canvas_item;
uniform sampler2D scr : hint_screen_texture, filter_linear;
float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float r2 = dot(p * vec2(0.8, 1.0), p * vec2(0.8, 1.0));
	vec2 off = p * r2 * 0.0018;
	vec3 c = vec3(texture(scr, SCREEN_UV - off).r, texture(scr, SCREEN_UV).g, texture(scr, SCREEN_UV + off).b);
	float v = smoothstep(0.35, 1.7, r2 * 1.3);
	c *= 1.0 - v * 0.55;
	c += (hash(FRAGCOORD.xy + fract(TIME) * 61.0) - 0.5) * 0.012;
	COLOR = vec4(c, 1.0);
}
"

const _OVERLAY_MOBILE := "shader_type canvas_item;
float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float r2 = dot(p * vec2(0.8, 1.0), p * vec2(0.8, 1.0));
	float v = smoothstep(0.35, 1.7, r2 * 1.3);
	float g = (hash(FRAGCOORD.xy + fract(TIME) * 61.0) - 0.5) * 0.02;
	COLOR = vec4(vec3(max(g, 0.0)), clamp(v * 0.55 + max(-g, 0.0), 0.0, 1.0));
}
"


## Vignette and film grain over the finished frame. Desktop reads the screen back (which also
## gives the slight lens-edge colour fringe); mobile just alpha-blends black, with no copy.
static func _overlay(root: Node3D) -> void:
	var cl := CanvasLayer.new()
	cl.layer = 10
	var cr := ColorRect.new()
	cr.set_anchors_preset(Control.PRESET_FULL_RECT)
	cr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var vm := ShaderMaterial.new()
	var vs := Shader.new()
	vs.code = _OVERLAY_DESKTOP if tier == Tier.DESKTOP else _OVERLAY_MOBILE
	vm.shader = vs
	cr.material = vm
	cl.add_child(cr)
	root.add_child(cl)
